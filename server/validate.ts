import { ECDH } from 'node:crypto'
import type {
  EventReminder,
  Message,
  PeriodReminder,
  PillReminder,
  RegisterInput,
  Reminders,
  RoutineReminder,
  TimedReminder,
} from './types.js'

export class ValidationError extends Error {}

const ID_RE = /^[0-9a-f-]{36}$/i
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_TEXT = 200

/**
 * Servicios push de los navegadores. Solo se aceptan suscripciones a estos dominios:
 * así nadie puede usar el servidor para enviar peticiones a direcciones arbitrarias.
 */
const PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']

export function isPushServiceUrl(url: URL): boolean {
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false
  const host = url.hostname.toLowerCase()
  return PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
}

function fail(msg: string): never {
  throw new ValidationError(msg)
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function text(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim() || v.length > MAX_TEXT) fail(`${field} no válido`)
  return v.trim()
}

function fromBase64Url(s: string): Buffer | null {
  return /^[A-Za-z0-9_-]+=*$/.test(s) ? Buffer.from(s, 'base64url') : null
}

/**
 * Claves de la suscripción push: p256dh debe ser un punto válido de la curva P-256
 * (65 bytes) y auth un secreto de 16 bytes. Si no, el cifrado del push fallaría siempre.
 */
export function isValidPushKeys(p256dh: string, auth: string): boolean {
  const pub = fromBase64Url(p256dh)
  const secret = fromBase64Url(auth)
  if (!pub || pub.length !== 65 || !secret || secret.length !== 16) return false
  try {
    ECDH.convertKey(pub, 'prime256v1')
    return true
  } catch {
    return false
  }
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function message(v: Record<string, unknown>, field: string): Message {
  return { title: text(v.title, `${field}.title`), body: text(v.body, `${field}.body`) }
}

function timed(v: unknown, field: string): TimedReminder | undefined {
  if (v === undefined || v === null) return undefined
  if (!isObj(v)) fail(`${field} no válido`)
  if (typeof v.time !== 'string' || !TIME_RE.test(v.time)) fail(`${field}.time no válido`)
  return { time: v.time, ...message(v, field) }
}

function pillReminder(v: unknown): PillReminder | undefined {
  const base = timed(v, 'pill')
  if (!base) return undefined
  const pack = (v as Record<string, unknown>).pack
  if (pack === undefined || pack === null) return base
  if (!isObj(pack)) fail('pill.pack no válido')
  if (typeof pack.active !== 'number' || !Number.isInteger(pack.active) || pack.active < 1 || pack.active > 28) {
    fail('pill.pack.active no válido')
  }
  if (typeof pack.start !== 'string' || !DATE_RE.test(pack.start)) fail('pill.pack.start no válido')
  return { ...base, pack: { active: pack.active, start: pack.start } }
}

function withTakenAction(pill: PillReminder | undefined, v: unknown): PillReminder | undefined {
  const a = isObj(v) ? v.takenAction : undefined
  if (!pill || a === undefined || a === null) return pill
  return { ...pill, takenAction: text(a, 'pill.takenAction') }
}

/** Periodos previstos adicionales que se pueden enviar. */
export const MAX_NEXT_PERIODS = 5

function period(v: unknown): PeriodReminder | undefined {
  if (v === undefined || v === null) return undefined
  if (!isObj(v)) fail('period no válido')
  const { from, until, bodies } = v
  if (typeof from !== 'string' || !DATE_RE.test(from)) fail('period.from no válido')
  if (typeof until !== 'string' || !DATE_RE.test(until) || until < from) fail('period.until no válido')
  if (!Array.isArray(bodies) || bodies.length < 1 || bodies.length > 8) fail('period.bodies no válido')
  const out: PeriodReminder = {
    title: text(v.title, 'period.title'),
    from,
    until,
    bodies: bodies.map((b, i) => text(b, `period.bodies[${i}]`)),
  }
  if (v.startedAction !== undefined && v.startedAction !== null) {
    out.startedAction = text(v.startedAction, 'period.startedAction')
  }
  if (v.next !== undefined && v.next !== null) {
    if (!Array.isArray(v.next) || v.next.length > MAX_NEXT_PERIODS) fail('period.next no válido')
    let prev = until
    out.next = v.next.map((w, i) => {
      if (!isObj(w)) fail(`period.next[${i}] no válido`)
      const { from: wf, until: wu } = w
      // Cada intervalo, correcto y posterior al anterior (sin solaparse).
      if (typeof wf !== 'string' || !DATE_RE.test(wf) || typeof wu !== 'string' || !DATE_RE.test(wu)) {
        fail(`period.next[${i}] no válido`)
      }
      if (wu < wf || wf <= prev) fail(`period.next[${i}] no válido`)
      prev = wu
      return { from: wf, until: wu }
    })
  }
  return out
}

/** Máximo de recordatorios con fecha por dispositivo. */
export const MAX_EVENTS = 30

function events(v: unknown): EventReminder[] | undefined {
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v) || v.length > MAX_EVENTS) fail('events no válido')
  return v.map((e, i) => {
    if (!isObj(e)) fail(`events[${i}] no válido`)
    if (typeof e.date !== 'string' || !DATE_RE.test(e.date)) fail(`events[${i}].date no válido`)
    if (typeof e.time !== 'string' || !TIME_RE.test(e.time)) fail(`events[${i}].time no válido`)
    return { date: e.date, time: e.time, ...message(e, `events[${i}]`) }
  })
}

/** Máximo de hábitos por dispositivo. */
export const MAX_ROUTINES = 6
const ROUTINE_ID_RE = /^[a-z0-9-]{1,24}$/

function routines(v: unknown): RoutineReminder[] | undefined {
  if (v === undefined || v === null) return undefined
  if (!Array.isArray(v) || v.length > MAX_ROUTINES) fail('routines no válido')
  const seen = new Set<string>()
  return v.map((r, i) => {
    const base = timed(r, `routines[${i}]`)!
    const { id, weekdays } = r as Record<string, unknown>
    if (typeof id !== 'string' || !ROUTINE_ID_RE.test(id) || seen.has(id)) fail(`routines[${i}].id no válido`)
    seen.add(id)
    const out: RoutineReminder = { id, ...base }
    if (weekdays !== undefined && weekdays !== null) {
      if (
        !Array.isArray(weekdays) ||
        weekdays.length < 1 ||
        weekdays.length > 7 ||
        weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
        new Set(weekdays).size !== weekdays.length
      ) {
        fail(`routines[${i}].weekdays no válido`)
      }
      out.weekdays = weekdays as number[]
    }
    return out
  })
}

/** Valida el cuerpo de registro de un dispositivo. Lanza ValidationError. */
export function validateRegister(raw: unknown): RegisterInput {
  if (!isObj(raw)) fail('Cuerpo no válido')
  const { deviceId, secret, subscription, timezone, reminders } = raw
  if (typeof deviceId !== 'string' || !ID_RE.test(deviceId)) fail('deviceId no válido')
  if (typeof secret !== 'string' || !SECRET_RE.test(secret)) fail('secret no válido')

  if (!isObj(subscription) || !isObj(subscription.keys)) fail('subscription no válida')
  const { endpoint, keys } = subscription as { endpoint: unknown; keys: Record<string, unknown> }
  let url: URL
  try {
    url = new URL(String(endpoint))
  } catch {
    fail('subscription.endpoint no válido')
  }
  if (!isPushServiceUrl(url) || String(endpoint).length > 1000) fail('subscription.endpoint no válido')
  if (
    typeof keys.p256dh !== 'string' ||
    typeof keys.auth !== 'string' ||
    keys.p256dh.length > 200 ||
    keys.auth.length > 100 ||
    !isValidPushKeys(keys.p256dh, keys.auth)
  ) {
    fail('subscription.keys no válidas')
  }

  if (typeof timezone !== 'string' || !isValidTimezone(timezone)) fail('timezone no válida')
  if (!isObj(reminders)) fail('reminders no válido')

  const r: Reminders = {}
  const daily = timed(reminders.daily, 'daily')
  const pill = withTakenAction(pillReminder(reminders.pill), reminders.pill)
  const per = period(reminders.period)
  if (daily) r.daily = daily
  if (pill) r.pill = pill
  if (per) r.period = per
  const ev = events(reminders.events)
  if (ev?.length) r.events = ev
  const ro = routines(reminders.routines)
  if (ro?.length) r.routines = ro

  return {
    deviceId: deviceId.toLowerCase(),
    secret,
    subscription: { endpoint: String(endpoint), keys: { p256dh: keys.p256dh, auth: keys.auth } },
    timezone,
    reminders: r,
  }
}

export function validateCredentials(raw: unknown): { deviceId: string; secret: string } {
  if (!isObj(raw)) fail('Cuerpo no válido')
  const { deviceId, secret } = raw
  if (typeof deviceId !== 'string' || !ID_RE.test(deviceId)) fail('deviceId no válido')
  if (typeof secret !== 'string' || !SECRET_RE.test(secret)) fail('secret no válido')
  return { deviceId: deviceId.toLowerCase(), secret }
}
