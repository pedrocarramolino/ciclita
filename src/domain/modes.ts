/**
 * Modos de la app: ciclo menstrual (por defecto), embarazo y perimenopausia.
 * Cálculos puros para la pantalla de inicio de cada modo.
 */
import type { Period } from '../db/db'
import { addDays, diffDays, type ISODate } from './dates'

export type AppMode = 'cycle' | 'pregnancy' | 'perimenopause'

/** Duración estándar de un embarazo desde la última regla (regla de Naegele). */
export const PREGNANCY_DAYS = 280

export interface PregnancyInfo {
  /** Semanas y días cumplidos (p. ej. 12 semanas y 3 días). */
  weeks: number
  days: number
  trimester: 1 | 2 | 3
  dueDate: ISODate
  daysLeft: number
  /** Progreso 0–1 sobre las 40 semanas. */
  progress: number
}

/**
 * Datos del embarazo a partir del primer día de la última regla. La fecha probable de
 * parto es esa fecha + 280 días; es una estimación.
 */
export function pregnancyInfo(lastPeriodStart: ISODate, today: ISODate): PregnancyInfo {
  const elapsed = Math.max(0, diffDays(lastPeriodStart, today))
  const weeks = Math.floor(elapsed / 7)
  const dueDate = addDays(lastPeriodStart, PREGNANCY_DAYS)
  return {
    weeks,
    days: elapsed % 7,
    trimester: weeks < 14 ? 1 : weeks < 28 ? 2 : 3,
    dueDate,
    daysLeft: diffDays(today, dueDate),
    progress: Math.min(1, elapsed / PREGNANCY_DAYS),
  }
}

/** Primer día de la última regla a partir de una fecha probable de parto. */
export const lastPeriodFromDueDate = (dueDate: ISODate) => addDays(dueDate, -PREGNANCY_DAYS)

export interface PerimenopauseInfo {
  lastStart: ISODate | null
  daysSinceLast: number | null
  /** Periodos que empezaron en los últimos 12 meses. */
  periodsLastYear: number
  /** 12 meses o más sin periodo: definición clínica de menopausia. */
  twelveMonthsWithout: boolean
}

export function perimenopauseInfo(periods: Period[], today: ISODate): PerimenopauseInfo {
  const starts = periods.map((p) => p.startDate).filter((s) => s <= today).sort()
  const lastStart = starts.at(-1) ?? null
  const yearAgo = addDays(today, -365)
  const daysSinceLast = lastStart ? diffDays(lastStart, today) : null
  return {
    lastStart,
    daysSinceLast,
    periodsLastYear: starts.filter((s) => s > yearAgo).length,
    twelveMonthsWithout: daysSinceLast !== null && daysSinceLast >= 365,
  }
}
