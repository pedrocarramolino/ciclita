/**
 * Lógica del servidor de notificaciones, independiente de Upstash y de Vercel:
 * las dependencias se inyectan para poder probarla sin red.
 *
 * Flujo:
 *  1. El dispositivo llama a register() con su suscripción y sus recordatorios.
 *  2. Se guarda el registro y se crea (o actualiza) una programación cron en QStash
 *     por recordatorio activo; se borran las de los recordatorios desactivados.
 *  3. A la hora indicada QStash llama a deliver(), que envía el Web Push.
 */
import { createHash, timingSafeEqual } from 'node:crypto'
import {
  REMINDER_KINDS,
  type DeliverMessage,
  type DeviceRecord,
  type PushPayload,
  type PushSubscriptionJSON,
  type RegisterInput,
  type ReminderKind,
} from './types.js'

/** Hora local a la que se comprueba el aviso de periodo. */
export const PERIOD_CHECK_TIME = '09:00'
/** Los dispositivos sin actividad se borran solos tras este tiempo. */
export const DEVICE_TTL_SECONDS = 60 * 60 * 24 * 90

export interface Store {
  get(deviceId: string): Promise<DeviceRecord | null>
  set(deviceId: string, record: DeviceRecord, ttlSeconds: number): Promise<void>
  del(deviceId: string): Promise<void>
}

export interface Scheduler {
  /** Crea o reemplaza la programación `scheduleId`. */
  upsert(scheduleId: string, cron: string, message: DeliverMessage): Promise<void>
  /** Borra la programación; no falla si no existe. */
  remove(scheduleId: string): Promise<void>
}

export interface Pusher {
  /** Envía el push. `gone` indica que la suscripción ya no existe (404/410). */
  send(subscription: PushSubscriptionJSON, payload: PushPayload, ttlSeconds: number): Promise<{ gone: boolean }>
}

export interface Deps {
  store: Store
  scheduler: Scheduler
  pusher: Pusher
  now: () => Date
}

export class AuthError extends Error {}

export const scheduleId = (deviceId: string, kind: ReminderKind) => `ciclo-${deviceId}-${kind}`

export const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex')

function secretMatches(secret: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(secret), 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Expresión cron diaria a una hora local, en el formato de QStash. */
export function cronFor(time: string, timezone: string): string {
  const [h, m] = time.split(':').map(Number)
  return `CRON_TZ=${timezone} ${m} ${h} * * *`
}

/** Fecha local (YYYY-MM-DD) de un instante en una zona horaria. */
export function localDate(now: Date, timezone: string): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now)
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

async function loadAuthorized(deps: Deps, deviceId: string, secret: string) {
  const record = await deps.store.get(deviceId)
  if (record && !secretMatches(secret, record.secretHash)) throw new AuthError('Credenciales no válidas')
  return record
}

export async function register(deps: Deps, input: RegisterInput): Promise<void> {
  const existing = await loadAuthorized(deps, input.deviceId, input.secret)
  const period = input.reminders.period
  const record: DeviceRecord = {
    secretHash: existing?.secretHash ?? hashSecret(input.secret),
    subscription: input.subscription,
    timezone: input.timezone,
    reminders: input.reminders,
    // Si cambia el periodo previsto, se podrá volver a avisar.
    periodSentFor: period && existing?.periodSentFor === period.until ? period.until : undefined,
    updatedAt: deps.now().getTime(),
  }
  await deps.store.set(input.deviceId, record, DEVICE_TTL_SECONDS)

  for (const kind of REMINDER_KINDS) {
    const id = scheduleId(input.deviceId, kind)
    const reminder = input.reminders[kind]
    if (!reminder) {
      await deps.scheduler.remove(id)
      continue
    }
    const time = kind === 'period' ? PERIOD_CHECK_TIME : (reminder as { time: string }).time
    await deps.scheduler.upsert(id, cronFor(time, input.timezone), { deviceId: input.deviceId, kind })
  }
}

async function removeDevice(deps: Deps, deviceId: string) {
  await Promise.all(REMINDER_KINDS.map((k) => deps.scheduler.remove(scheduleId(deviceId, k))))
  await deps.store.del(deviceId)
}

export async function unregister(deps: Deps, deviceId: string, secret: string): Promise<void> {
  const record = await loadAuthorized(deps, deviceId, secret)
  if (!record) return
  await removeDevice(deps, deviceId)
}

export type DeliverResult = 'sent' | 'skipped' | 'removed'

/** Llamado por QStash. Envía el aviso si toca y limpia dispositivos que ya no existen. */
export async function deliver(deps: Deps, msg: DeliverMessage): Promise<DeliverResult> {
  const record = await deps.store.get(msg.deviceId)
  if (!record) {
    // Dispositivo borrado o caducado: quitamos su programación para no seguir llamando.
    await removeDevice(deps, msg.deviceId)
    return 'removed'
  }

  let payload: PushPayload | null = null
  let ttl = 4 * 3600
  const r = record.reminders

  if (msg.kind === 'period' && r.period) {
    const today = localDate(deps.now(), record.timezone)
    const left = daysBetween(today, r.period.until)
    if (today >= r.period.from && left >= 0 && record.periodSentFor !== r.period.until) {
      const body = r.period.bodies[Math.min(left, r.period.bodies.length - 1)]
      payload = { title: r.period.title, body, tag: 'ciclo-period', url: '/#/home' }
      ttl = 12 * 3600
    }
  } else if ((msg.kind === 'daily' || msg.kind === 'pill') && r[msg.kind]) {
    const { title, body } = r[msg.kind]!
    payload = { title, body, tag: `ciclo-${msg.kind}`, url: '/#/home' }
  }

  if (!payload) return 'skipped'

  const { gone } = await deps.pusher.send(record.subscription, payload, ttl)
  if (gone) {
    await removeDevice(deps, msg.deviceId)
    return 'removed'
  }
  if (msg.kind === 'period') {
    await deps.store.set(msg.deviceId, { ...record, periodSentFor: r.period!.until }, DEVICE_TTL_SECONDS)
  }
  return 'sent'
}
