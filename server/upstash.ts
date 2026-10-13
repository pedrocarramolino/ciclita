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
      upsert: async (scheduleId, cron, message) => {
        await qstash.schedules.create({
          scheduleId,
          cron,
          destination: `${env.APP_URL}/api/deliver`,
          body: JSON.stringify(message),
          headers: { 'Content-Type': 'application/json' },
          retries: 3,
        })
      },
      remove: async (scheduleId) => {
        try {
          await qstash.schedules.delete(scheduleId)
        } catch {
          // No existe: nada que borrar.
        }
      },
    },
    pusher: {
      send: async (subscription, payload, ttl) => {
        try {
          await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: ttl, urgency: 'normal' })
          return { gone: false }
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) return { gone: true }
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

  cached = { env, redis, deps, receiver, ratelimit }
  return cached
}
