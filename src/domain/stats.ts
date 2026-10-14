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

/**
 * Momento del ciclo en que suele aparecer un síntoma. Los números positivos son días
 * del ciclo (1 = primer día del periodo); los negativos, días antes del periodo
 * siguiente (-2 = dos días antes). Así los síntomas premenstruales no quedan partidos
 * entre el final de un ciclo y el principio del siguiente.
 */
export interface SymptomTiming {
  from: number
  to: number
}

/** Días antes del periodo siguiente que se cuentan "hacia atrás". */
export const BEFORE_PERIOD_DAYS = 10
/** Apariciones mínimas para hablar de un momento habitual. */
export const MIN_TIMING_COUNT = 3
/** Si el tramo central es más ancho que esto, no hay un momento claro. */
export const MAX_TIMING_SPAN = 10

export interface SymptomStat {
  name: string
  count: number
  byPhase: Record<Phase, number>
  /** Fase en la que aparece más veces (null si no se puede situar en ningún ciclo). */
  topPhase: Phase | null
  /** Momento del ciclo en que suele aparecer (null si hay pocos datos o no hay patrón). */
  timing: SymptomTiming | null
}

/** Posición de un día en su ciclo (ver SymptomTiming); null si es anterior al primer periodo. */
function positionFinder(periods: Period[], avgCycle: number) {
  const starts = periods.map((p) => p.startDate).sort()
  return (date: ISODate): number | null => {
    const idx = starts.findLastIndex((s) => s <= date)
    if (idx < 0) return null
    const start = starts[idx]
    const next = starts[idx + 1] ?? addDays(start, avgCycle)
    const day = diffDays(start, date) + 1
    const untilNext = diffDays(date, next)
    return untilNext >= 1 && untilNext <= BEFORE_PERIOD_DAYS && day > avgCycle / 2 ? -untilNext : day
  }
}

/** Orden en el ciclo: primero los días del ciclo, luego los de antes del periodo siguiente. */
const cycleOrder = (pos: number) => (pos > 0 ? pos : 1000 + pos)

/** Tramo donde se concentra el 60 % central de las apariciones, si es estrecho. */
export function symptomTiming(positions: number[]): SymptomTiming | null {
  if (positions.length < MIN_TIMING_COUNT) return null
  // Se prueban dos órdenes: el natural (día 1 → día 28) y uno que pone los días antes
  // del periodo justo delante del día 1, para los síntomas alrededor de la regla.
  const candidates = [cycleOrder, (p: number) => p].map((key) => {
    const s = [...positions].sort((a, b) => key(a) - key(b))
    const from = s[Math.floor(0.2 * (s.length - 1))]
    const to = s[Math.ceil(0.8 * (s.length - 1))]
    return { from, to, span: spanOf(from, to) }
  })
  const best = candidates.reduce((a, b) => (b.span < a.span ? b : a))
  return best.span <= MAX_TIMING_SPAN ? { from: best.from, to: best.to } : null
}

/** Días entre dos posiciones (de "antes del periodo" a "día del ciclo" se cruza el día 1). */
function spanOf(from: number, to: number): number {
  if (from < 0 && to > 0) return -from + to - 1
  return Math.abs(to - from)
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
  const positions = new Map<string, number[]>()
  const phaseOfDay = phaseFinder(periods, avgCycle, avgPeriod, today)
  const positionOf = positionFinder(periods, avgCycle)
  for (const d of days) {
    if (!d.symptoms?.length) continue
    const phase = phaseOfDay(d.date)
    const pos = positionOf(d.date)
    for (const name of d.symptoms) {
      let s = map.get(name)
      if (!s) {
        s = { name, count: 0, byPhase: { menstrual: 0, follicular: 0, ovulatory: 0, luteal: 0 }, topPhase: null, timing: null }
        map.set(name, s)
        positions.set(name, [])
      }
      s.count++
      if (phase) s.byPhase[phase]++
      if (pos !== null) positions.get(name)!.push(pos)
    }
  }
  const out = [...map.values()]
  for (const s of out) {
    const best = PHASES.reduce((a, b) => (s.byPhase[b] > s.byPhase[a] ? b : a))
    s.topPhase = s.byPhase[best] > 0 ? best : null
    s.timing = symptomTiming(positions.get(s.name)!)
  }
  return out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, locale))
}
