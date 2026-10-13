/**
 * Recordatorios en fechas concretas, calculados en el dispositivo:
 *  - Anticonceptivos con pauta, a partir de la fecha de inicio:
 *      · Anillo vaginal: 3 semanas puesto + 1 de descanso (ciclos de 28 días).
 *        Se avisa al retirarlo (día 21) y al poner uno nuevo (día 28).
 *      · Parche: uno nuevo cada semana durante 3 semanas y 1 de descanso.
 *        Se avisa de cada cambio (días 7 y 14), al retirarlo (21) y al poner uno nuevo (28).
 *      · Inyección trimestral: cada 12 semanas, con aviso una semana antes.
 *  - El día antes de cada ventana fértil prevista.
 *  - Autoexploración de mama: una semana después del inicio de cada periodo.
 * Solo se generan las de los próximos meses (el servidor admite un máximo).
 */
import { addDays, diffDays, type ISODate } from './dates'
import type { Prediction } from './prediction'

export type ContraceptionMethod = 'none' | 'ring' | 'patch' | 'injection'

export type EventType =
  | 'ring-remove'
  | 'ring-insert'
  | 'patch-change'
  | 'patch-remove'
  | 'patch-new'
  | 'injection-soon'
  | 'injection-due'
  | 'fertile'
  | 'breast'

export interface ReminderEvent {
  date: ISODate
  time: string
  type: EventType
}

export interface EventSettings {
  fertileEnabled: boolean
  breastExamEnabled: boolean
  contraception: { method: ContraceptionMethod; start: ISODate | null; time: string }
}

/** Hora de los avisos que no son de anticonceptivos. */
export const EVENT_TIME = '09:00'
/** Hasta cuántos días por delante se calculan, y cuántos como máximo. */
export const EVENTS_HORIZON_DAYS = 120
export const MAX_EVENTS = 30

const CYCLE = 28
const INJECTION_EVERY = 84

/** Fechas de la pauta del anticonceptivo entre `from` y `to` (ambas incluidas). */
export function contraceptionEvents(
  method: ContraceptionMethod,
  start: ISODate,
  from: ISODate,
  to: ISODate,
): { date: ISODate; type: EventType }[] {
  const out: { date: ISODate; type: EventType }[] = []
  const offsets: [number, EventType][] =
    method === 'ring'
      ? [
          [21, 'ring-remove'],
          [28, 'ring-insert'],
        ]
      : method === 'patch'
        ? [
            [7, 'patch-change'],
            [14, 'patch-change'],
            [21, 'patch-remove'],
            [28, 'patch-new'],
          ]
        : method === 'injection'
          ? [
              [INJECTION_EVERY - 7, 'injection-soon'],
              [INJECTION_EVERY, 'injection-due'],
            ]
          : []
  if (!offsets.length) return out
  const period = method === 'injection' ? INJECTION_EVERY : CYCLE
  // Primer ciclo de la pauta que puede tener fechas a partir de `from`.
  let n = Math.max(0, Math.floor(diffDays(start, from) / period) - 1)
  for (; ; n++) {
    const base = addDays(start, n * period)
    if (base > to) break
    for (const [offset, type] of offsets) {
      const date = addDays(base, offset)
      if (date >= from && date <= to) out.push({ date, type })
    }
  }
  return out
}

export function buildEventReminders(s: EventSettings, prediction: Prediction | null, today: ISODate): ReminderEvent[] {
  const to = addDays(today, EVENTS_HORIZON_DAYS)
  const events: ReminderEvent[] = []

  const c = s.contraception
  if (c.method !== 'none' && c.start) {
    for (const e of contraceptionEvents(c.method, c.start, today, to)) events.push({ ...e, time: c.time })
  }

  const usable = prediction && (prediction.status.kind === 'upcoming' || prediction.status.kind === 'period')
  if (s.fertileEnabled && usable) {
    for (const w of prediction.fertileWindows) {
      const date = addDays(w.start, -1)
      if (date >= today && date <= to) events.push({ date, time: EVENT_TIME, type: 'fertile' })
    }
  }

  if (s.breastExamEnabled && prediction?.lastStart) {
    const starts = [prediction.lastStart, ...(usable ? prediction.nextPeriods.map((p) => p.start) : [])]
    for (const start of starts) {
      const date = addDays(start, 7)
      if (date >= today && date <= to) events.push({ date, time: EVENT_TIME, type: 'breast' })
    }
  }

  return events
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, MAX_EVENTS)
}
