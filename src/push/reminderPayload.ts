/**
 * Construye los recordatorios que se envían al servidor (con su texto ya redactado).
 * Función pura para poder probarla.
 */
import type { ReminderSettings } from '../db/settings'
import { addDays, today as todayISO, type ISODate } from '../domain/dates'
import { buildEventReminders } from '../domain/reminderEvents'
import type { AppMode } from '../domain/modes'
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

export interface EventReminder {
  date: ISODate
  time: string
  title: string
  body: string
}

export interface RemindersPayload {
  daily?: TimedReminder
  pill?: TimedReminder
  period?: PeriodReminder
  events?: EventReminder[]
}

export function buildReminders(
  r: ReminderSettings,
  prediction: Prediction | null,
  today: ISODate = todayISO(),
  mode: AppMode = 'cycle',
): RemindersPayload {
  // En embarazo y perimenopausia no hay previsiones fiables de periodo ni de fertilidad.
  if (mode !== 'cycle') r = { ...r, periodEnabled: false, fertileEnabled: false }
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

  // Recordatorios con fecha: anticonceptivo con pauta, ventana fértil, autoexploración.
  const events = buildEventReminders(r, prediction, today).map((e) => ({
    date: e.date,
    time: e.time,
    title: r.discreet ? n.discreetTitle : n.events[e.type].title,
    body: r.discreet ? n.discreet.event : n.events[e.type].body,
  }))
  if (events.length) out.events = events
  return out
}

export const hasReminders = (p: RemindersPayload) => !!(p.daily || p.pill || p.period || p.events?.length)
