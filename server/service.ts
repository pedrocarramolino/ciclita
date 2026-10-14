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
import { localDate, nextOccurrence, zonedToUtc } from './time.js'
import {
  periodWindows,
  PERIOD_STARTED_ACTION,
  PILL_TAKEN_ACTION,
  REMINDER_KINDS,
  type DeliverMessage,
  type PillPack,
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
  /** Cupo global de dispositivos nuevos (protege la cuota de QStash). Sin definir = sin límite. */
  allowNewDevice?: () => Promise<boolean>
}

export class AuthError extends Error {}
/** Se ha alcanzado el límite global de dispositivos nuevos por día. */
export class QuotaError extends Error {}

export const hashSecret = (secret: string) => createHash('sha256').update(secret).digest('hex')

function secretMatches(secret: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(secret), 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/** Instante de cada recordatorio con fecha, en UTC. */
const eventInstant = (e: { date: string; time: string }, timezone: string) => zonedToUtc(e.date, e.time, timezone)

/**
 * Cuándo debe sonar a continuación cada tipo de recordatorio (o null si ya no queda
 * nada pendiente). Los diarios, a su hora; el de periodo, a las 9:00; los de fecha,
 * en la más próxima de su lista.
 */
export function nextFireAt(kind: ReminderKind, reminders: Reminders, timezone: string, now: Date): Date | null {
  if (kind === 'events') {
    const upcoming = (reminders.events ?? [])
      .map((e) => eventInstant(e, timezone))
      .filter((d) => d > now)
      .sort((a, b) => a.getTime() - b.getTime())
    return upcoming[0] ?? null
  }
  const r = reminders[kind]
  if (!r) return null
  const time = kind === 'period' ? PERIOD_CHECK_TIME : (r as { time: string }).time
  let at = nextOccurrence(time, timezone, now)
  // Píldora: se saltan los días de descanso del envase (como mucho 27 seguidos).
  const pack = kind === 'pill' ? reminders.pill?.pack : undefined
  for (let i = 0; pack && i < 28 && !isPillDay(localDate(at, timezone), pack); i++) {
    at = nextOccurrence(time, timezone, at)
  }
  return at
}

/** El día `ymd` toca píldora según el envase (ciclos de 28 días desde `start`). */
export function isPillDay(ymd: string, pack: PillPack): boolean {
  const diff = daysBetween(pack.start, ymd)
  return (((diff % 28) + 28) % 28) < pack.active
}

/** Publica el siguiente mensaje de un recordatorio (si queda alguno) y devuelve su Job. */
async function scheduleNext(
  deps: Deps,
  deviceId: string,
  kind: ReminderKind,
  at: Date | null,
  version: string,
): Promise<Job> {
  if (!at) return { version }
  const messageId = await deps.scheduler.publishAt(
    { deviceId, kind, version, at: at.getTime() },
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
  if (!existing && deps.allowNewDevice && !(await deps.allowNewDevice())) {
    throw new QuotaError('Se ha alcanzado el límite diario de dispositivos nuevos. Inténtalo mañana.')
  }
  const newVersion = deps.newVersion ?? randomUUID

  const jobs: DeviceRecord['jobs'] = {}
  for (const kind of REMINDER_KINDS) {
    if (!input.reminders[kind]) continue
    const at = nextFireAt(kind, input.reminders, input.timezone, deps.now())
    jobs[kind] = await scheduleNext(deps, input.deviceId, kind, at, newVersion())
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
      periodSentFor:
        period && periodWindows(period).some((w) => w.until === existing?.periodSentFor) ? existing?.periodSentFor : undefined,
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
  const extra: PushPayload[] = []
  let ttl = 4 * 3600
  let continueChain = true

  let sentFor: string | undefined
  if (msg.kind === 'period' && r.period) {
    const windows = periodWindows(r.period)
    // El intervalo en curso o el siguiente.
    const w = windows.find((x) => today <= x.until)
    const left = w ? daysBetween(today, w.until) : -1
    if (w && today >= w.from && record.periodSentFor !== w.until) {
      const body = r.period.bodies[Math.min(left, r.period.bodies.length - 1)]
      payload = { title: r.period.title, body, tag: 'ciclita-period', url: '/#/home' }
      if (r.period.startedAction) payload.actions = [{ action: PERIOD_STARTED_ACTION, title: r.period.startedAction }]
      sentFor = w.until
      ttl = 12 * 3600
    }
    // Pasado el último periodo previsto no hay nada más que comprobar hasta que la
    // app vuelva a sincronizar.
    if (today >= windows.at(-1)!.until) continueChain = false
  } else if ((msg.kind === 'daily' || msg.kind === 'pill') && r[msg.kind]) {
    const { title, body } = r[msg.kind]!
    // Por si llega un mensaje programado antes de cambiar el envase: en descanso no se avisa.
    const pack = msg.kind === 'pill' ? r.pill?.pack : undefined
    if (!pack || isPillDay(today, pack)) {
      payload = { title, body, tag: `ciclita-${msg.kind}`, url: '/#/home' }
      const action = msg.kind === 'pill' ? r.pill?.takenAction : undefined
      if (action) payload.actions = [{ action: PILL_TAKEN_ACTION, title: action }]
    }
  } else if (msg.kind === 'events' && r.events && msg.at !== undefined) {
    // Todos los recordatorios con fecha que caen en este mismo instante.
    const due = r.events.filter((e) => Math.abs(eventInstant(e, record.timezone).getTime() - msg.at!) < 60_000)
    due.forEach((e, i) => {
      const p = { title: e.title, body: e.body, tag: `ciclita-event-${e.date}-${i}`, url: '/#/home' }
      if (i === 0) payload = p
      else extra.push(p)
    })
    ttl = 12 * 3600
  }

  // 1) Programar el siguiente (idempotente gracias a dedupId si QStash reintenta).
  const next: Job = continueChain
    ? await scheduleNext(deps, msg.deviceId, msg.kind, nextFireAt(msg.kind, r, record.timezone, deps.now()), job.version)
    : { version: job.version }
  const updated: DeviceRecord = { ...record, jobs: { ...record.jobs, [msg.kind]: next } }

  // 2) Enviar el push de hoy, si toca.
  if (payload) {
    for (const p of [payload, ...extra]) {
      const { gone } = await deps.pusher.send(record.subscription, p, ttl)
      if (gone) {
        await removeDevice(deps, msg.deviceId, updated)
        return 'removed'
      }
    }
    if (sentFor) updated.periodSentFor = sentFor
  }

  await deps.store.set(msg.deviceId, updated, DEVICE_TTL_SECONDS)
  return payload ? 'sent' : 'skipped'
}
