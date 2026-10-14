import type { Period } from '../db/db'
import { addDays, diffDays, type ISODate } from './dates'

/**
 * Un periodo "en curso" (sin fecha de fin) se muestra hasta hoy, pero nunca más
 * de este número de días, por si la usuaria olvida marcar el final.
 */
export const MAX_ONGOING_DAYS = 14

/** Último día que cubre un periodo, resolviendo los periodos en curso. */
export function periodEnd(p: Period, today: ISODate): ISODate {
  if (p.endDate) return p.endDate
  const cap = addDays(p.startDate, MAX_ONGOING_DAYS - 1)
  const end = today < cap ? today : cap
  return end < p.startDate ? p.startDate : end
}

/** Todas las fechas de un periodo, ambos extremos incluidos. */
export function expandPeriod(p: Period, today: ISODate): ISODate[] {
  const end = periodEnd(p, today)
  const n = diffDays(p.startDate, end)
  return Array.from({ length: n + 1 }, (_, i) => addDays(p.startDate, i))
}

export function periodDateSet(periods: Period[], today: ISODate): Set<ISODate> {
  return new Set(periods.flatMap((p) => expandPeriod(p, today)))
}

/**
 * Marca o desmarca un día como día de periodo y devuelve la nueva lista de
 * periodos (sin ids), reagrupando los días consecutivos.
 *
 * Así, añadir un día junto a un periodo lo alarga, añadirlo entre dos los une,
 * y quitar un día intermedio parte el periodo en dos.
 *
 * Si había un periodo en curso, sigue en curso mientras su último día no cambie;
 * si la usuaria recorta su final, se considera terminado.
 */
export function togglePeriodDay(
  periods: Period[],
  date: ISODate,
  on: boolean,
  today: ISODate,
): Period[] {
  const ongoing = periods.find((p) => p.endDate === null)
  const ongoingEnd = ongoing ? periodEnd(ongoing, today) : null

  const days = periodDateSet(periods, today)
  if (on) days.add(date)
  else days.delete(date)

  const sorted = [...days].sort()
  const runs: ISODate[][] = []
  for (const d of sorted) {
    const run = runs.at(-1)
    if (run && diffDays(run.at(-1)!, d) === 1) run.push(d)
    else runs.push([d])
  }

  return runs.map((run) => {
    const end = run.at(-1)!
    return { startDate: run[0], endDate: end === ongoingEnd ? null : end }
  })
}

/** Días por encima de la duración habitual tras los que se pregunta si el periodo terminó. */
export const ASK_END_EXTRA_DAYS = 2

export interface PeriodEndQuestion {
  start: ISODate
  /** Días que lleva en curso (hoy incluido). */
  days: number
  /** Último día que se puede elegir como final (hoy, o el tope de un periodo en curso). */
  lastPossible: ISODate
}

/**
 * Si hay un periodo en curso que ya dura más de lo habitual (+2 días), devuelve los
 * datos para preguntar si ha terminado; null si no toca o se pospuso.
 */
export function periodEndQuestion(
  periods: Period[],
  periodLength: number,
  today: ISODate,
  snooze: { start: ISODate; until: ISODate } | null = null,
): PeriodEndQuestion | null {
  const ongoing = periods.find((p) => p.endDate === null)
  if (!ongoing || ongoing.startDate > today) return null
  const days = diffDays(ongoing.startDate, today) + 1
  if (days <= periodLength + ASK_END_EXTRA_DAYS) return null
  if (snooze && snooze.start === ongoing.startDate && today < snooze.until) return null
  const cap = addDays(ongoing.startDate, MAX_ONGOING_DAYS - 1)
  return { start: ongoing.startDate, days, lastPossible: today < cap ? today : cap }
}
