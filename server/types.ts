/**
 * Tipos compartidos del servidor de notificaciones (funciones de Vercel + Upstash).
 *
 * Qué se guarda en Upstash Redis por dispositivo (y nada más):
 *  - la suscripción Web Push del navegador,
 *  - la zona horaria,
 *  - los recordatorios activos con su hora y su texto,
 *  - para el aviso de periodo, el intervalo de fechas en que debe sonar.
 * No hay cuentas: cada dispositivo se identifica con un id aleatorio y un secreto
 * que solo conoce ese dispositivo (en Redis se guarda su hash).
 */

export interface PushSubscriptionJSON {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface Message {
  title: string
  body: string
}

export interface TimedReminder extends Message {
  /** 'HH:MM' en la zona horaria del dispositivo. */
  time: string
}

export interface PeriodReminder {
  title: string
  /** Primer día (YYYY-MM-DD) en que se avisa. */
  from: string
  /** Inicio previsto del periodo: último día en que se avisa. */
  until: string
  /** Texto según los días que falten: bodies[n] = faltan n días. */
  bodies: string[]
}

/**
 * Recordatorio en una fecha concreta (anticonceptivos con pauta, ventana fértil,
 * autoexploración...). El dispositivo calcula las próximas fechas y su texto.
 */
export interface EventReminder extends Message {
  /** YYYY-MM-DD */
  date: string
  /** HH:MM en la zona horaria del dispositivo */
  time: string
}

export interface Reminders {
  daily?: TimedReminder
  pill?: TimedReminder
  period?: PeriodReminder
  events?: EventReminder[]
}

export type ReminderKind = keyof Reminders
export const REMINDER_KINDS: ReminderKind[] = ['daily', 'pill', 'period', 'events']

export interface RegisterInput {
  deviceId: string
  secret: string
  subscription: PushSubscriptionJSON
  timezone: string
  reminders: Reminders
}

/** Mensaje programado pendiente de un recordatorio. */
export interface Job {
  /** Cambia cada vez que se reprograma: los mensajes con otra versión se ignoran. */
  version: string
  /** Id del mensaje en QStash (para cancelarlo al cambiar o borrar). */
  messageId?: string
}

export interface DeviceRecord {
  secretHash: string
  subscription: PushSubscriptionJSON
  timezone: string
  reminders: Reminders
  jobs: Partial<Record<ReminderKind, Job>>
  /** Inicio previsto del periodo sobre el que ya se avisó (para no repetir). */
  periodSentFor?: string
  updatedAt: number
}

/** Cuerpo de los mensajes que QStash entrega a /api/deliver. */
export interface DeliverMessage {
  deviceId: string
  kind: ReminderKind
  version: string
  /** Para los recordatorios con fecha: instante (ms) al que corresponde el aviso. */
  at?: number
}

export interface PushPayload extends Message {
  tag: string
  url: string
}
