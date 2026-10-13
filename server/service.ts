/**
 * Lógica del servidor de notificaciones, independiente de Upstash y de Vercel:
 * las dependencias se inyectan para poder probarla sin red.
 *
 * Flujo (sin "schedules" de QStash, que tienen un cupo muy bajo en el plan gratuito):
 *  1. El dispositivo llama a register() con su suscripción y sus recordatorios.
 *  2. Por cada recordatorio activo se publica en QStash UN mensaje diferido para su
 *     próxima hora (en la zona horaria del dispositivo), con una versión aleatoria.
 *  3. A esa hora QStash llama a deliver(): se publica el mensaje del día siguiente y
 *     se envía el Web Push. Así cada recordatorio es una cadena de mensajes diarios.
 *  4. Al cambiar o borrar un recordatorio cambia su versión: los mensajes antiguos
 *     que aún lleguen se ignoran (y además se intentan cancelar).
 */
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { localDate, nextOccurrence } from './time.js'
import {
  REMINDER_KINDS,
  type DeliverMessage,
  type DeviceRecord,
  type Job,
  type PushPayload,
  type PushSubscriptionJSON,
  type RegisterInput,
  type ReminderKind,
  type Reminders,
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
  /**
   * Publica `message` para que se entregue en `at`. `dedupId` evita duplicados si
   * se reintenta. Devuelve el id del mensaje.
   */
  publishAt(message: DeliverMessage, at: Date, dedupId: string): Promise<string | undefined>
  /** Cancela un mensaje pendiente; no falla si ya no existe. */
  cancel(messageId: string): Promise<void>
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
  newVersion?: () => string
}

export class AuthError extends Error {}

export const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex')

function secretMatches(secret: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(secret), 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/** Hora local a la que debe sonar cada tipo de recordatorio. */
function fireTime(kind: ReminderKind, reminders: Reminders): string | null {
  const r = reminders[kind]
  if (!r) return null
  return kind === 'period' ? PERIOD_CHECK_TIME : (r as { time: string }).time
}

/** Publica el siguiente mensaje de un recordatorio y devuelve su Job. */
async function scheduleNext(
  deps: Deps,
  deviceId: string,
  kind: ReminderKind,
  time: string,
  timezone: string,
  version: string,
): Promise<Job> {
  const at = nextOccurrence(time, timezone, deps.now())
  const messageId = await deps.scheduler.publishAt(
    { deviceId, kind, version },
    at,
    `ciclita-${deviceId}-${kind}-${version}-${at.getTime()}`,
  )
  return { version, messageId }
}

async function cancelJobs(deps: Deps, jobs: DeviceRecord['jobs'] | undefined, kinds = REMINDER_KINDS) {
  await Promise.all(
    kinds.map((k) => (jobs?.[k]?.messageId ? deps.scheduler.cancel(jobs[k]!.messageId!) : Promise.resolve())),
  )
}

async function loadAuthorized(deps: Deps, deviceId: string, secret: string) {
  const record = await deps.store.get(deviceId)
  if (record && !secretMatches(secret, record.secretHash)) throw new AuthError('Credenciales no válidas')
  return record
}

export async function register(deps: Deps, input: RegisterInput): Promise<void> {
  const existing = await loadAuthorized(deps, input.deviceId, input.secret)
  const newVersion = deps.newVersion ?? randomUUID

  const jobs: DeviceRecord['jobs'] = {}
  for (const kind of REMINDER_KINDS) {
    const time = fireTime(kind, input.reminders)
    if (!time) continue
    jobs[kind] = await scheduleNext(deps, input.deviceId, kind, time, input.timezone, newVersion())
  }
  // Los mensajes anteriores quedan obsoletos por la nueva versión; además se cancelan.
  await cancelJobs(deps, existing?.jobs).catch(() => {})

  const period = input.reminders.period
  await deps.store.set(
    input.deviceId,
    {
      secretHash: existing?.secretHash ?? hashSecret(input.secret),
      subscription: input.subscription,
      timezone: input.timezone,
      reminders: input.reminders,
      jobs,
      // Si cambia el periodo previsto, se podrá volver a avisar.
      periodSentFor: period && existing?.periodSentFor === period.until ? period.until : undefined,
      updatedAt: deps.now().getTime(),
    },
    DEVICE_TTL_SECONDS,
  )
}

async function removeDevice(deps: Deps, deviceId: string, record: DeviceRecord | null) {
  await cancelJobs(deps, record?.jobs).catch(() => {})
  await deps.store.del(deviceId)
}

export async function unregister(deps: Deps, deviceId: string, secret: string): Promise<void> {
  const record = await loadAuthorized(deps, deviceId, secret)
  if (!record) return
  await removeDevice(deps, deviceId, record)
}

export type DeliverResult = 'sent' | 'skipped' | 'stale' | 'removed'

/** Llamado por QStash. Programa el siguiente aviso, envía este si toca y limpia lo caducado. */
export async function deliver(deps: Deps, msg: DeliverMessage): Promise<DeliverResult> {
  const record = await deps.store.get(msg.deviceId)
  if (!record) return 'removed'
  const job = record.jobs?.[msg.kind]
  // Mensaje de una programación anterior (recordatorio cambiado o desactivado).
  if (!job || job.version !== msg.version) return 'stale'

  const r = record.reminders
  const today = localDate(deps.now(), record.timezone)
  let payload: PushPayload | null = null
  let ttl = 4 * 3600
  let continueChain = true

  if (msg.kind === 'period' && r.period) {
    const left = daysBetween(today, r.period.until)
    if (today >= r.period.from && left >= 0 && record.periodSentFor !== r.period.until) {
      const body = r.period.bodies[Math.min(left, r.period.bodies.length - 1)]
      payload = { title: r.period.title, body, tag: 'ciclita-period', url: '/#/home' }
      ttl = 12 * 3600
    }
    // Pasada la fecha prevista no hay nada más que comprobar hasta que la app
    // vuelva a sincronizar con el siguiente periodo.
    if (today >= r.period.until) continueChain = false
  } else if ((msg.kind === 'daily' || msg.kind === 'pill') && r[msg.kind]) {
    const { title, body } = r[msg.kind]!
    payload = { title, body, tag: `ciclita-${msg.kind}`, url: '/#/home' }
  }

  // 1) Programar el siguiente (idempotente gracias a dedupId si QStash reintenta).
  const next: Job = continueChain
    ? await scheduleNext(deps, msg.deviceId, msg.kind, fireTime(msg.kind, r)!, record.timezone, job.version)
    : { version: job.version }
  const updated: DeviceRecord = { ...record, jobs: { ...record.jobs, [msg.kind]: next } }

  // 2) Enviar el push de hoy, si toca.
  if (payload) {
    const { gone } = await deps.pusher.send(record.subscription, payload, ttl)
    if (gone) {
      await removeDevice(deps, msg.deviceId, updated)
      return 'removed'
    }
    if (msg.kind === 'period') updated.periodSentFor = r.period!.until
  }

  await deps.store.set(msg.deviceId, updated, DEVICE_TTL_SECONDS)
  return payload ? 'sent' : 'skipped'
}
