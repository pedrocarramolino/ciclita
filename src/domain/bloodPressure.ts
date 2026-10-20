/**
 * Resumen de la tensión arterial y el pulso registrados. Función pura.
 *
 * No diagnostica nada: solo avisa de que conviene comentarlo con un profesional si la
 * media reciente llega a 140/90, el umbral que usan las guías para tensión alta.
 */
import type { DayLog } from '../db/db'
import { addDays, type ISODate } from './dates'

/** Días que cuenta la media reciente. */
export const RECENT_DAYS = 30
/** Tomas mínimas en ese tiempo para avisar de una media alta. */
const MIN_READINGS_FOR_WARNING = 3
export const HIGH_SYSTOLIC = 140
export const HIGH_DIASTOLIC = 90

export interface PressureReading {
  date: ISODate
  systolic?: number
  diastolic?: number
  pulse?: number
}

export interface PressureSummary {
  /** Todas las tomas, de la más reciente a la más antigua. */
  readings: PressureReading[]
  last: PressureReading
  /** Medias de los últimos 30 días (null si no hay tomas de ese dato). */
  recent: {
    count: number
    systolic: number | null
    diastolic: number | null
    pulse: number | null
  }
  /** La media reciente llega a 140/90 con al menos 3 tomas. */
  high: boolean
}

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

export function pressureSummary(days: DayLog[], today: ISODate): PressureSummary | null {
  const readings: PressureReading[] = days
    .filter((d) => d.systolic !== undefined || d.pulse !== undefined)
    .map(({ date, systolic, diastolic, pulse }) => ({ date, systolic, diastolic, pulse }))
    .sort((a, b) => b.date.localeCompare(a.date))
  if (!readings.length) return null

  const since = addDays(today, -(RECENT_DAYS - 1))
  const recent = readings.filter((r) => r.date >= since && r.date <= today)
  const withPressure = recent.filter((r) => r.systolic !== undefined && r.diastolic !== undefined)
  const systolic = mean(withPressure.map((r) => r.systolic!))
  const diastolic = mean(withPressure.map((r) => r.diastolic!))
  const pulse = mean(recent.flatMap((r) => (r.pulse === undefined ? [] : [r.pulse])))
  const high =
    withPressure.length >= MIN_READINGS_FOR_WARNING &&
    (systolic! >= HIGH_SYSTOLIC || diastolic! >= HIGH_DIASTOLIC)

  return { readings, last: readings[0], recent: { count: recent.length, systolic, diastolic, pulse }, high }
}
