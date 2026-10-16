/**
 * Construye los recordatorios que se envían al servidor (con su texto ya redactado).
 * Función pura para poder probarla.
 */
import type { Appointment } from '../db/db'
import type { ReminderSettings } from '../db/settings'
import { addDays, diffDays, formatDayMonth, today as todayISO, type ISODate } from '../domain/dates'
import { MAX_EVENTS } from '../domain/reminderEvents'
import { buildEventReminders, cycleDayWindows } from '../domain/reminderEvents'
import type { AppMode } from '../domain/modes'
import type { Prediction } from '../domain/prediction'
import { t } from '../i18n'

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
  /** Periodos previstos siguientes: el servidor sigue avisando aunque no se abra la app. */
  next?: { from: ISODate; until: ISODate }[]
  /** Texto del botón "Ha empezado" de la notificación. */
  startedAction?: string
}

export interface EventReminder {
  date: ISODate
  time: string
  title: string
  body: string
}

export interface PillReminder extends TimedReminder {
  /** Envase con días de descanso: el servidor no avisa en ellos. */
  pack?: { active: number; start: ISODate }
  /** Texto del botón "Ya la he tomado" de la notificación. */
  takenAction?: string
}

/** Hábito que se repite a una hora (temperatura, peso, medicación). */
export interface RoutineReminder extends TimedReminder {
  /** 'temperature', 'weight', 'medication' o el id de un recordatorio libre. */
  id: string
  /** Días de la semana (0 = domingo); sin definir = todos. */
  weekdays?: number[]
  /** Solo dentro de estas fechas (días del ciclo ya pasados a fechas). */
  windows?: { from: ISODate; until: ISODate }[]
}

export interface PillOptions {
  pack?: PillReminder['pack']
  /** Se registran las tomas: la notificación lleva el botón "Ya la he tomado". */
  trackTaken?: boolean
}

export interface RemindersPayload {
  daily?: TimedReminder
  pill?: PillReminder
  period?: PeriodReminder
  events?: EventReminder[]
  routines?: RoutineReminder[]
}

export function buildReminders(
  r: ReminderSettings,
  prediction: Prediction | null,
  today: ISODate = todayISO(),
  mode: AppMode = 'cycle',
  pill: PillOptions = {},
  /** Citas médicas con aviso (los que aún no han pasado). */
  appointments: Appointment[] = [],
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
    if (pill.pack) out.pill.pack = pill.pack
    if (pill.trackTaken) out.pill.takenAction = r.discreet ? n.discreet.done : n.pillTaken
  }

  // Solo se programa si hay un próximo periodo previsto en el futuro (no con retraso).
  const kind = prediction?.status.kind
  const next = prediction?.nextPeriods[0]
  if (r.periodEnabled && next && (kind === 'upcoming' || kind === 'period')) {
    const window = (start: ISODate) => ({ from: addDays(start, -r.periodDaysBefore), until: start })
    const following = prediction!.nextPeriods.slice(1).map((p) => window(p.start))
    out.period = {
      title: title('period'),
      ...window(next.start),
      ...(following.length ? { next: following } : {}),
      startedAction: r.discreet ? n.discreet.markToday : n.periodStarted,
      bodies: Array.from({ length: r.periodDaysBefore + 1 }, (_, i) =>
        r.discreet ? n.discreet.period : n.period(i),
      ),
    }
  }

  // Recordatorios con fecha: anticonceptivo con pauta, ventana fértil, autoexploración.
  const pillPack = r.pillEnabled && pill.pack ? { ...pill.pack, time: r.pillTime } : null
  const checkup = r.checkupEnabled && r.checkupDate ? { date: r.checkupDate, yearly: r.checkupYearly } : null
  const events = buildEventReminders({ ...r, pillPack, checkup }, prediction, today).map((e) => ({
    date: e.date,
    time: e.time,
    title: r.discreet ? n.discreetTitle : n.events[e.type].title,
    body: r.discreet ? n.discreet.event : n.events[e.type].body,
  }))
  // Avisos de citas médicas, el día y la hora elegidos.
  for (const a of appointments) {
    if (!a.reminder || a.reminder.date < today) continue
    events.push({
      date: a.reminder.date,
      time: a.reminder.time,
      title: r.discreet ? n.discreetTitle : n.appointment.title,
      body: r.discreet ? n.discreet.event : appointmentBody(a),
    })
  }
  events.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time))
  events.splice(MAX_EVENTS)
  if (events.length) out.events = events

  // Hábitos: comparten una sola cadena de avisos en el servidor.
  const routines: RoutineReminder[] = []
  const routine = (id: string, time: string, msg: { title: string; body: string }) => {
    const item: RoutineReminder = {
      id,
      time,
      title: r.discreet ? n.discreetTitle : msg.title,
      body: r.discreet ? n.discreet.routine : msg.body,
    }
    routines.push(item)
    return item
  }
  if (r.temperatureEnabled) routine('temperature', r.temperatureTime, n.routines.temperature)
  if (r.weightEnabled) {
    const w = routine('weight', r.weightTime, n.routines.weight)
    if (r.weightDay !== null) w.weekdays = [r.weightDay]
  }
  if (r.medicationEnabled) {
    const name = r.medicationName.trim().slice(0, MEDICATION_NAME_MAX)
    routine('medication', r.medicationTime, { title: n.routines.medicationTitle, body: n.routines.medicationBody(name) })
  }
  // Recordatorios libres: todos los días o solo unos días del ciclo (necesitan previsión).
  for (const c of r.custom) {
    const name = c.name.trim().slice(0, MEDICATION_NAME_MAX)
    const msg = { title: name || n.routines.customTitle, body: n.routines.medicationBody(name) }
    if (!c.cycleDays) {
      routine(c.id, c.time, msg)
      continue
    }
    const windows = mode === 'cycle' ? cycleDayWindows(prediction, c.cycleDays.from, c.cycleDays.to, today) : []
    if (windows.length) routine(c.id, c.time, msg).windows = windows
  }
  if (routines.length) out.routines = routines
  return out
}

/** "Ginecología (Dra. López): mañana a las 10:30." — referido al día del aviso. */
function appointmentBody(a: Appointment): string {
  const n = t.notifications.appointment
  const type = t.appointments.types[a.type]
  const who = a.title ? `${type} (${a.title.slice(0, 60)})` : type
  const days = diffDays(a.reminder!.date, a.date)
  const when = days === 0 ? n.today : days === 1 ? n.tomorrow : n.on(formatDayMonth(a.date))
  return n.body(who, when, a.time).slice(0, 200)
}

/** Largo máximo del nombre de la medicación (cabe de sobra en el límite del servidor). */
export const MEDICATION_NAME_MAX = 40

export const hasReminders = (p: RemindersPayload) =>
  !!(p.daily || p.pill || p.period || p.events?.length || p.routines?.length)
