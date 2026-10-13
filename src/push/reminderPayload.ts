/**
 * Construye los recordatorios que se envían al servidor (con su texto ya redactado).
 * Función pura para poder probarla.
 */
import type { ReminderSettings } from '../db/settings'
import { addDays, type ISODate } from '../domain/dates'
import type { Prediction } from '../domain/prediction'
import { t } from '../i18n/es'

export interface TimedReminder {
  time: string
  title: string
  body: string
}

export interface PeriodReminder {
  title: string
  from: ISODate
  until: ISODate
  bodies: string[]
}

export interface RemindersPayload {
  daily?: TimedReminder
  pill?: TimedReminder
  period?: PeriodReminder
}

export function buildReminders(r: ReminderSettings, prediction: Prediction | null): RemindersPayload {
  const n = t.notifications
  const title = (kind: 'daily' | 'pill' | 'period') => (r.discreet ? n.discreetTitle : n.titles[kind])
  const out: RemindersPayload = {}

  if (r.dailyEnabled) {
    out.daily = { time: r.dailyTime, title: title('daily'), body: r.discreet ? n.discreet.daily : n.daily }
  }
  if (r.pillEnabled) {
    out.pill = { time: r.pillTime, title: title('pill'), body: r.discreet ? n.discreet.pill : n.pill }
  }

  // Solo se programa si hay un próximo periodo previsto en el futuro (no con retraso).
  const kind = prediction?.status.kind
  const next = prediction?.nextPeriods[0]
  if (r.periodEnabled && next && (kind === 'upcoming' || kind === 'period')) {
    out.period = {
      title: title('period'),
      from: addDays(next.start, -r.periodDaysBefore),
      until: next.start,
      bodies: Array.from({ length: r.periodDaysBefore + 1 }, (_, i) =>
        r.discreet ? n.discreet.period : n.period(i),
      ),
    }
  }
  return out
}

export const hasReminders = (p: RemindersPayload) => !!(p.daily || p.pill || p.period)
