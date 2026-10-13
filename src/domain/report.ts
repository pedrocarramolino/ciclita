/**
 * Informe para el médico: resumen del ciclo a partir de los registros, calculado en
 * el propio dispositivo. Función pura (sin base de datos) para poder probarla.
 */
import type { DayLog, Flow, Period } from '../db/db'
import { parseISODate, toISODate, type ISODate } from './dates'
import type { PredictedPeriod, Prediction } from './prediction'
import { completedCycles, symptomStats, type CycleRecord, type Phase } from './stats'

export type ReportMonths = 3 | 6 | 12 | 'all'

export interface ReportOptions {
  months: ReportMonths
  includeNotes: boolean
}

export interface Report {
  generatedOn: ISODate
  from: ISODate
  to: ISODate
  summary: {
    cyclesCount: number
    avgCycle: number | null
    avgPeriod: number | null
    shortest: number | null
    longest: number | null
    variation: number | null
    isIrregular: boolean
    lastStart: ISODate | null
    nextPeriod: PredictedPeriod | null
  }
  /** Ciclos completos del intervalo, del más reciente al más antiguo. */
  cycles: CycleRecord[]
  /** Días registrados con cada intensidad de flujo. */
  flowDays: Record<Flow, number>
  pain: { daysWithPain: number; average: number; max: number; severeDays: number } | null
  symptoms: { name: string; count: number; topPhase: Phase | null }[]
  medication: { name: string; count: number; last: ISODate }[]
  notes: { date: ISODate; text: string }[]
}

/** Dolor a partir del cual se considera intenso (escala 0–10). */
export const SEVERE_PAIN = 7

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)

function monthsAgo(today: ISODate, months: number): ISODate {
  const d = parseISODate(today)
  d.setMonth(d.getMonth() - months)
  return toISODate(d)
}

export function buildReport(
  periods: Period[],
  days: DayLog[],
  prediction: Prediction,
  opts: ReportOptions,
  today: ISODate,
): Report {
  const firstData = [...periods.map((p) => p.startDate), ...days.map((d) => d.date)].sort()[0] ?? today
  const from = opts.months === 'all' ? firstData : monthsAgo(today, opts.months)
  const inRange = (date: ISODate) => date >= from && date <= today

  const cycles = completedCycles(periods)
    .filter((c) => inRange(c.start))
    .reverse()
  const lengths = cycles.map((c) => c.length)
  const periodLengths = cycles.flatMap((c) => (c.periodLength === null ? [] : [c.periodLength]))
  const variation = lengths.length >= 2 ? Math.max(...lengths) - Math.min(...lengths) : null

  const rangeDays = days.filter((d) => inRange(d.date))

  const flowDays: Record<Flow, number> = { spotting: 0, light: 0, medium: 0, heavy: 0 }
  for (const d of rangeDays) if (d.flow) flowDays[d.flow]++

  const pains = rangeDays.flatMap((d) => (d.pain === undefined ? [] : [d.pain]))
  const pain = pains.length
    ? {
        daysWithPain: pains.filter((p) => p > 0).length,
        average: avg(pains)!,
        max: Math.max(...pains),
        severeDays: pains.filter((p) => p >= SEVERE_PAIN).length,
      }
    : null

  const symptoms = symptomStats(rangeDays, periods, prediction.cycleLength, prediction.periodLength, today).map(
    ({ name, count, topPhase }) => ({ name, count, topPhase }),
  )

  // Medicación agrupada sin distinguir mayúsculas; se muestra el texto más reciente.
  const meds = new Map<string, { name: string; count: number; last: ISODate }>()
  for (const d of [...rangeDays].sort((a, b) => a.date.localeCompare(b.date))) {
    const text = d.medication?.trim()
    if (!text) continue
    const key = text.toLowerCase()
    const m = meds.get(key)
    meds.set(key, { name: text, count: (m?.count ?? 0) + 1, last: d.date })
  }

  const notes = opts.includeNotes
    ? rangeDays
        .filter((d) => d.notes?.trim())
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((d) => ({ date: d.date, text: d.notes!.trim() }))
    : []

  const lastStart = periods.map((p) => p.startDate).sort().at(-1) ?? null

  return {
    generatedOn: today,
    from,
    to: today,
    summary: {
      cyclesCount: cycles.length,
      avgCycle: avg(lengths),
      avgPeriod: avg(periodLengths),
      shortest: lengths.length ? Math.min(...lengths) : null,
      longest: lengths.length ? Math.max(...lengths) : null,
      variation,
      isIrregular: variation !== null && variation > 7,
      lastStart,
      nextPeriod: prediction.status.kind === 'noData' ? null : (prediction.nextPeriods[0] ?? null),
    },
    cycles,
    flowDays,
    pain,
    symptoms,
    medication: [...meds.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)),
    notes,
  }
}

/** Nombre de archivo para descargar el informe. */
export const reportFileName = (r: Report) => `ciclita-informe-${r.generatedOn}.html`

