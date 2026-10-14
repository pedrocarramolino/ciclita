/**
 * Temperatura basal por ciclo y detección de la subida que sigue a la ovulación
 * (regla "3 sobre 6"). Funciones puras.
 *
 * Regla: tres tomas seguidas más altas que las seis anteriores, y la tercera al menos
 * 0,2 °C por encima de la más alta de esas seis ("línea de base"). La ovulación suele
 * ser el día anterior a la primera toma alta. Es una estimación, no un diagnóstico.
 */
import type { DayLog, Period } from '../db/db'
import { addDays, diffDays, type ISODate } from './dates'

export interface TempPoint {
  date: ISODate
  /** Día del ciclo (1 = primer día del periodo). */
  day: number
  temp: number
}

export interface TempCycle {
  start: ISODate
  /** Último día del ciclo (el anterior al siguiente periodo, o hoy si es el actual). */
  end: ISODate
  /** Días del ciclo (end - start + 1). */
  length: number
  /** Días de periodo, como días del ciclo. */
  periodDays: number[]
  points: TempPoint[]
  shift: TempShift | null
}

export interface TempShift {
  /** Línea de base: la más alta de las seis tomas anteriores a la subida. */
  coverline: number
  /** Día del ciclo de la primera toma alta. */
  firstHighDay: number
  /** Día probable de ovulación (el anterior a la primera toma alta). */
  ovulationDay: number
}

export const SHIFT_BEFORE = 6
export const SHIFT_HIGH = 3
export const SHIFT_MIN_RISE = 0.2

/** Busca la subida de temperatura en las tomas de un ciclo (ordenadas por día). */
export function detectShift(points: TempPoint[]): TempShift | null {
  for (let i = SHIFT_BEFORE; i + SHIFT_HIGH <= points.length; i++) {
    const coverline = Math.max(...points.slice(i - SHIFT_BEFORE, i).map((p) => p.temp))
    const highs = points.slice(i, i + SHIFT_HIGH)
    // Tomas en días seguidos: un hueco rompe la secuencia.
    const consecutive = highs.every((p, k) => k === 0 || p.day === highs[k - 1].day + 1)
    if (
      consecutive &&
      highs.every((p) => p.temp > coverline) &&
      highs[SHIFT_HIGH - 1].temp >= round2(coverline + SHIFT_MIN_RISE)
    ) {
      return { coverline, firstHighDay: highs[0].day, ovulationDay: highs[0].day - 1 }
    }
  }
  return null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Ciclos (del más antiguo al más reciente) que tienen alguna toma de temperatura. */
export function temperatureCycles(periods: Period[], days: DayLog[], today: ISODate): TempCycle[] {
  const starts = [...periods].map((p) => p.startDate).sort()
  const temps = days
    .filter((d) => d.temperature !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
  const out: TempCycle[] = []
  starts.forEach((start, i) => {
    if (start > today) return
    const next = starts[i + 1]
    const end = next ? addDays(next, -1) : today
    const points = temps
      .filter((d) => d.date >= start && d.date <= end)
      .map((d) => ({ date: d.date, day: diffDays(start, d.date) + 1, temp: d.temperature! }))
    if (!points.length) return
    const period = periods.find((p) => p.startDate === start)!
    const periodEnd = period.endDate ?? (end < today ? end : today)
    const periodDays: number[] = []
    for (let d = start; d <= periodEnd && d <= end; d = addDays(d, 1)) periodDays.push(diffDays(start, d) + 1)
    out.push({ start, end, length: diffDays(start, end) + 1, periodDays, points, shift: detectShift(points) })
  })
  return out
}
