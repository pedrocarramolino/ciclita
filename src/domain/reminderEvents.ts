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
 *  - Píldora con descanso (21 + 7, 24 + 4): el último día de descanso, a la hora de la
 *    píldora, "mañana empiezas un envase nuevo" (retrasarlo es el olvido más arriesgado).
 *  - Revisión médica (DIU, implante, citología…): una semana antes y el mismo día; si se
 *    repite cada año, también en los años siguientes.
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
  | 'pill-new-pack'
  | 'checkup-soon'
  | 'checkup-due'

export interface ReminderEvent {
  date: ISODate
  time: string
  type: EventType
}

export interface EventSettings {
  fertileEnabled: boolean
  breastExamEnabled: boolean
  contraception: { method: ContraceptionMethod; start: ISODate | null; time: string }
  /** Envase de la píldora con descanso, si hay recordatorio de píldora. */
  pillPack?: { active: number; start: ISODate; time: string } | null
  /** Revisión médica, si está activada. */
  checkup?: { date: ISODate; yearly: boolean } | null
}

/** Hora de los avisos que no son de anticonceptivos. */
export const EVENT_TIME = '09:00'
/** Hasta cuántos días por delante se calculan, y cuántos como máximo. */
export const EVENTS_HORIZON_DAYS = 120
export const MAX_EVENTS = 30

const CYCLE = 28
const INJECTION_EVERY = 84

/** Intervalos de fechas como máximo para un recordatorio por días del ciclo. */
export const MAX_CYCLE_WINDOWS = 4

/**
 * Fechas de los días `from` a `to` del ciclo actual y de los siguientes previstos
 * (día 1 = primer día del periodo). Solo los que no han terminado aún.
 */
export function cycleDayWindows(
  prediction: Pick<Prediction, 'lastStart' | 'nextPeriods'> | null,
  from: number,
  to: number,
  today: ISODate,
): { from: ISODate; until: ISODate }[] {
  if (!prediction?.lastStart) return []
  const starts = [...new Set([prediction.lastStart, ...prediction.nextPeriods.map((p) => p.start)])].sort()
  return starts
    .map((s) => ({ from: addDays(s, from - 1), until: addDays(s, to - 1) }))
    .filter((w) => w.until >= today)
    .slice(0, MAX_CYCLE_WINDOWS)
}

/** La misma fecha `n` años después (el 29 de febrero pasa al 28 si no es bisiesto). */
export function addYears(date: ISODate, n: number): ISODate {
  const [y, m, d] = date.split('-').map(Number)
  const last = new Date(Date.UTC(y + n, m, 0)).getUTCDate()
  return `${y + n}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

/** Avisos de la revisión entre `from` y `to`: una semana antes y el mismo día. */
export function checkupEvents(
  checkup: { date: ISODate; yearly: boolean },
  from: ISODate,
  to: ISODate,
): { date: ISODate; type: EventType }[] {
  const out: { date: ISODate; type: EventType }[] = []
  const firstYear = checkup.yearly ? Math.max(0, Number(from.slice(0, 4)) - Number(checkup.date.slice(0, 4)) - 1) : 0
  for (let n = firstYear; n <= firstYear + 2 && (checkup.yearly || n === 0); n++) {
    const day = addYears(checkup.date, n)
    for (const [date, type] of [
      [addDays(day, -7), 'checkup-soon'],
      [day, 'checkup-due'],
    ] as const) {
      if (date >= from && date <= to) out.push({ date, type })
    }
  }
  return out
}

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

  const pill = s.pillPack
  if (pill && pill.active < CYCLE) {
    // Último día de descanso de cada envase: día 28 (desde el primer envase que pueda caer en el intervalo).
    let n = Math.max(0, Math.floor(diffDays(pill.start, today) / CYCLE) - 1)
    for (; ; n++) {
      const date = addDays(pill.start, n * CYCLE + CYCLE - 1)
      if (date > to) break
      if (date >= today) events.push({ date, time: pill.time, type: 'pill-new-pack' })
    }
  }

  if (s.checkup) {
    for (const e of checkupEvents(s.checkup, today, to)) events.push({ ...e, time: EVENT_TIME })
  }

  return events
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, MAX_EVENTS)
}
