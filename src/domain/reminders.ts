/**
 * Recordatorios locales: decide qué avisos tocan "ahora". Es una función pura;
 * quien la llama (la app abierta o el service worker) muestra las notificaciones
 * y guarda en el registro que ya se mostraron.
 */
import type { ReminderLog, ReminderSettings } from '../db/settings'
import { diffDays, toISODate, type ISODate } from './dates'
import type { Prediction } from './prediction'

export type ReminderKind = 'period' | 'daily' | 'pill'

/** Hora a la que se avisa del próximo periodo. */
export const PERIOD_REMINDER_TIME = '09:00'

export interface DueReminder {
  kind: ReminderKind
  /** Valor que se guarda en el registro para no repetir el aviso. */
  logValue: ISODate
  /** Días que faltan (solo para el aviso de periodo). */
  daysUntil?: number
}

export interface DueInput {
  settings: ReminderSettings
  log: ReminderLog
  prediction: Prediction | null
  now: Date
  /** Si ya hay un registro de hoy, no hace falta recordar que se registre. */
  todayLogged: boolean
}

const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export function dueReminders({ settings, log, prediction, now, todayLogged }: DueInput): DueReminder[] {
  const today = toISODate(now)
  const time = hhmm(now)
  const due: DueReminder[] = []

  // Aviso X días antes del próximo periodo previsto. Si ese día no se abrió la app,
  // se avisa en cuanto se pueda mientras el periodo aún no haya llegado.
  const next = prediction?.nextPeriods[0]
  const status = prediction?.status.kind
  if (settings.periodEnabled && next && (status === 'upcoming') && time >= PERIOD_REMINDER_TIME) {
    const daysUntil = diffDays(today, next.start)
    if (daysUntil >= 0 && daysUntil <= settings.periodDaysBefore && log.period !== next.start) {
      due.push({ kind: 'period', logValue: next.start, daysUntil })
    }
  }

  if (settings.dailyEnabled && !todayLogged && time >= settings.dailyTime && log.daily !== today) {
    due.push({ kind: 'daily', logValue: today })
  }

  if (settings.pillEnabled && time >= settings.pillTime && log.pill !== today) {
    due.push({ kind: 'pill', logValue: today })
  }

  return due
}
