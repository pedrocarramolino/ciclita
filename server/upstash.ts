/** Implementaciones reales de las dependencias: Upstash Redis, Upstash QStash y Web Push. */
import { Client, Receiver } from '@upstash/qstash'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import webpush from 'web-push'
import { getEnv, type Env } from './env.js'
import type { Deps } from './service.js'
import type { DeviceRecord } from './types.js'

const key = (deviceId: string) => `ciclo:device:${deviceId}`

let cached: { env: Env; redis: Redis; deps: Deps; receiver: Receiver; ratelimit: Ratelimit } | null = null

export function upstash() {
  if (cached) return cached
  const env = getEnv()
  const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
  const qstash = new Client({ token: env.QSTASH_TOKEN })
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)

  const deps: Deps = {
    store: {
      get: (id) => redis.get<DeviceRecord>(key(id)),
      set: async (id, record, ttl) => {
        await redis.set(key(id), record, { ex: ttl })
      },
      del: async (id) => {
        await redis.del(key(id))
      },
    },
    scheduler: {
      // Mensajes diferidos (no "schedules": el plan gratuito de QStash solo permite 10).
      publishAt: async (message, at, dedupId) => {
        const res = await qstash.publishJSON({
          url: `${env.APP_URL}/api/deliver`,
          body: message,
          notBefore: Math.floor(at.getTime() / 1000),
          deduplicationId: dedupId,
          retries: 3,
        })
        return 'messageId' in res ? res.messageId : undefined
      },
      cancel: async (messageId) => {
        try {
          await qstash.messages.cancel(messageId)
        } catch {
          // Ya entregado o inexistente: nada que cancelar.
        }
      },
    },
    pusher: {
      send: async (subscription, payload, ttl) => {
        try {
          await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: ttl, urgency: 'normal' })
          return { gone: false }
        } catch (e) {
          const { statusCode, code } = e as { statusCode?: number; code?: string }
          // 404/410: la suscripción ya no existe. Error de cifrado: claves inservibles.
          // En ambos casos reintentar no sirve, así que se trata como suscripción caducada.
          if (statusCode === 404 || statusCode === 410 || code?.startsWith('ERR_CRYPTO')) return { gone: true }
          throw e
        }
      },
    },
    now: () => new Date(),
  }

  const receiver = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  })

  // Límite de peticiones por IP a los endpoints públicos de registro.
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 h'),
    prefix: 'ciclo:ratelimit',
  })
  // Límite global de dispositivos nuevos al día, para que nadie agote la cuota de QStash.
  const newDevices = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(50, '1 d'),
    prefix: 'ciclo:new-devices',
  })
  deps.allowNewDevice = async () => (await newDevices.limit('global')).success

  cached = { env, redis, deps, receiver, ratelimit }
  return cached
}
