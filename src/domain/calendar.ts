import { addDays, diffDays, toISODate, type ISODate } from './dates'
import type { DateRange, Prediction } from './prediction'

function rangeDates({ start, end }: DateRange): ISODate[] {
  return Array.from({ length: diffDays(start, end) + 1 }, (_, i) => addDays(start, i))
}

/** Fechas de los periodos previstos y de las ventanas fértiles, para pintar el calendario. */
export function predictionDates(p: Prediction) {
  return {
    predicted: new Set(p.nextPeriods.flatMap(rangeDates)),
    fertile: new Set(p.fertileWindows.flatMap(rangeDates)),
    ovulation: new Set(p.fertileWindows.map((w) => w.ovulation)),
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
