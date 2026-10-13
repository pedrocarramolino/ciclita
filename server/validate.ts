import type { Message, PeriodReminder, RegisterInput, Reminders, TimedReminder } from './types.js'

export class ValidationError extends Error {}

const ID_RE = /^[0-9a-f-]{36}$/i
const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_TEXT = 200

function fail(msg: string): never {
  throw new ValidationError(msg)
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function text(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim() || v.length > MAX_TEXT) fail(`${field} no válido`)
  return v.trim()
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

function period(v: unknown): PeriodReminder | undefined {
  if (v === undefined || v === null) return undefined
  if (!isObj(v)) fail('period no válido')
  const { from, until, bodies } = v
  if (typeof from !== 'string' || !DATE_RE.test(from)) fail('period.from no válido')
  if (typeof until !== 'string' || !DATE_RE.test(until) || until < from) fail('period.until no válido')
  if (!Array.isArray(bodies) || bodies.length < 1 || bodies.length > 8) fail('period.bodies no válido')
  return {
    title: text(v.title, 'period.title'),
    from,
    until,
    bodies: bodies.map((b, i) => text(b, `period.bodies[${i}]`)),
  }
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
  if (url.protocol !== 'https:' || String(endpoint).length > 1000) fail('subscription.endpoint no válido')
  if (typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string' || keys.p256dh.length > 200 || keys.auth.length > 100) {
    fail('subscription.keys no válidas')
  }

  if (typeof timezone !== 'string' || !isValidTimezone(timezone)) fail('timezone no válida')
  if (!isObj(reminders)) fail('reminders no válido')

  const r: Reminders = {}
  const daily = timed(reminders.daily, 'daily')
  const pill = timed(reminders.pill, 'pill')
  const per = period(reminders.period)
  if (daily) r.daily = daily
  if (pill) r.pill = pill
  if (per) r.period = per

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
