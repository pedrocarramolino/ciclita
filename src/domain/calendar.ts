import { addDays, diffDays, toISODate, type ISODate } from './dates'
import type { DateRange, Prediction } from './prediction'

function rangeDates({ start, end }: DateRange): ISODate[] {
  return Array.from({ length: diffDays(start, end) + 1 }, (_, i) => addDays(start, i))
}

/**
 * Fechas de los periodos previstos y de las ventanas fértiles, para pintar el
 * calendario. "Posibles" son los días que solo entran por el margen de la previsión.
 */
export function predictionDates(p: Prediction) {
  const predicted = new Set(p.nextPeriods.flatMap(rangeDates))
  const fertile = new Set(p.fertileWindows.flatMap(rangeDates))
  const possiblePeriod = new Set(
    p.nextPeriods
      .flatMap((r) => rangeDates({ start: r.earliestStart, end: addDays(r.latestStart, diffDays(r.start, r.end)) }))
      .filter((d) => !predicted.has(d)),
  )
  const possibleFertile = new Set(
    p.fertileWindows
      .flatMap((w) => rangeDates({ start: w.possibleStart, end: w.possibleEnd }))
      .filter((d) => !fertile.has(d) && !predicted.has(d) && !possiblePeriod.has(d)),
  )
  return {
    predicted,
    fertile,
    ovulation: new Set(p.fertileWindows.map((w) => w.ovulation)),
    possiblePeriod,
    possibleFertile,
    hasMargin: p.nextPeriods.some((r) => r.margin > 0),
  }
}

export interface GridDay {
  date: ISODate
  day: number
  inMonth: boolean
}

/** Semanas (de lunes a domingo) que cubren el mes indicado. `month` va de 0 a 11. */
export function monthGrid(year: number, month: number): GridDay[][] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // lunes = 0
  const start = addDays(toISODate(first), -offset)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeks = Math.ceil((offset + daysInMonth) / 7)

  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d)
      const [, m, day] = date.split('-').map(Number)
      return { date, day, inMonth: m - 1 === month }
    }),
  )
}
