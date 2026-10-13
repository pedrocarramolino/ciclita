/**
 * Estadísticas a partir del historial. Funciones puras, sin acceso a la base de datos.
 */
import type { DayLog, Period } from '../db/db'
import { locale } from '../i18n'
import { addDays, diffDays, type ISODate } from './dates'
import { periodDateSet } from './periods'
import { fertileWindowFor } from './prediction'

/** Ciclos que se muestran en la gráfica. */
export const CHART_CYCLES = 12

export interface CycleRecord {
  start: ISODate
  /** Días hasta el inicio del siguiente periodo. */
  length: number
  /** Días de periodo (null si sigue en curso). */
  periodLength: number | null
}

/** Ciclos completos (con periodo siguiente registrado), de más antiguo a más reciente. */
export function completedCycles(periods: Period[]): CycleRecord[] {
  const sorted = [...periods].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const out: CycleRecord[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const p = sorted[i]
    out.push({
      start: p.startDate,
      length: diffDays(p.startDate, sorted[i + 1].startDate),
      periodLength: p.endDate ? diffDays(p.startDate, p.endDate) + 1 : null,
    })
  }
  return out
}

export interface CycleExtremes {
  shortest: CycleRecord
  longest: CycleRecord
}

export function cycleExtremes(cycles: CycleRecord[]): CycleExtremes | null {
  if (!cycles.length) return null
  let shortest = cycles[0]
  let longest = cycles[0]
  for (const c of cycles) {
    if (c.length < shortest.length) shortest = c
    if (c.length > longest.length) longest = c
  }
  return { shortest, longest }
}

/**
 * Fases del ciclo (aproximadas):
 *  - menstrual: días de periodo
 *  - folicular: tras el periodo y antes de la ventana fértil
 *  - ovulatoria: ventana fértil estimada
 *  - lútea: tras la ovulación y hasta el siguiente periodo
 */
export type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'
export const PHASES: Phase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal']

/**
 * Fase de un día pasado. El ciclo va del último inicio de periodo anterior o igual
 * al día hasta el siguiente inicio registrado; si aún no lo hay, se estima con la
 * duración media. Devuelve null si el día es anterior al primer periodo registrado.
 */
export function phaseOf(
  date: ISODate,
  periods: Period[],
  avgCycle: number,
  avgPeriod: number,
  today: ISODate,
): Phase | null {
  return phaseFinder(periods, avgCycle, avgPeriod, today)(date)
}

/**
 * Prepara una vez lo que es común a todos los días (inicios ordenados y días de
 * periodo) y devuelve una función rápida para situar cada día en su fase.
 */
function phaseFinder(periods: Period[], avgCycle: number, avgPeriod: number, today: ISODate) {
  const starts = periods.map((p) => p.startDate).sort()
  const periodDays = periodDateSet(periods, today)
  return (date: ISODate): Phase | null => {
    const idx = starts.findLastIndex((s) => s <= date)
    if (idx < 0) return null
    if (periodDays.has(date)) return 'menstrual'

    const start = starts[idx]
    const next = starts[idx + 1] ?? addDays(start, avgCycle)
    const w = fertileWindowFor(start, next, avgPeriod)
    if (date < w.start) return 'follicular'
    if (date <= w.end) return 'ovulatory'
    return 'luteal'
  }
}

export interface SymptomStat {
  name: string
  count: number
  byPhase: Record<Phase, number>
  /** Fase en la que aparece más veces (null si no se puede situar en ningún ciclo). */
  topPhase: Phase | null
}

/** Síntomas ordenados de más a menos frecuente, con su reparto por fase. */
export function symptomStats(
  days: DayLog[],
  periods: Period[],
  avgCycle: number,
  avgPeriod: number,
  today: ISODate,
): SymptomStat[] {
  const map = new Map<string, SymptomStat>()
  const phaseOfDay = phaseFinder(periods, avgCycle, avgPeriod, today)
  for (const d of days) {
    if (!d.symptoms?.length) continue
    const phase = phaseOfDay(d.date)
    for (const name of d.symptoms) {
      let s = map.get(name)
      if (!s) {
        s = { name, count: 0, byPhase: { menstrual: 0, follicular: 0, ovulatory: 0, luteal: 0 }, topPhase: null }
        map.set(name, s)
      }
      s.count++
      if (phase) s.byPhase[phase]++
    }
  }
  const out = [...map.values()]
  for (const s of out) {
    const best = PHASES.reduce((a, b) => (s.byPhase[b] > s.byPhase[a] ? b : a))
    s.topPhase = s.byPhase[best] > 0 ? best : null
  }
  return out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, locale))
}
