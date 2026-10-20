/**
 * Informe para el médico: resumen del ciclo a partir de los registros, calculado en
 * el propio dispositivo. Función pura (sin base de datos) para poder probarla.
 */
import { lang } from '../i18n'
import type { DayLog, Flow, Period, TestResult } from '../db/db'
import { parseISODate, toISODate, type ISODate } from './dates'
import { splitMissed, type PredictedPeriod, type Prediction } from './prediction'
import { pillAdherence, type PillAdherence, type PillConfig } from './pill'
import { completedCycles, symptomStats, type CycleRecord, type Phase, type SymptomTiming } from './stats'

export type ReportMonths = 3 | 6 | 12 | 'all'

export interface ReportOptions {
  months: ReportMonths
  includeNotes: boolean
  /** Envase de la píldora, si se registran las tomas. */
  pill?: PillConfig | null
  /** Para reconocer periodos olvidados (ver splitMissed en prediction.ts). */
  userCycleLength?: number | null
  confirmedLongCycles?: ISODate[]
  /** Ciclos de más de estos días no cuentan en el resumen (elección de la usuaria). */
  ignoreCyclesOver?: number | null
}

/** Ciclo del informe; `suspectedMissed`: tan largo que probablemente falta un periodo. */
export interface ReportCycle extends CycleRecord {
  suspectedMissed: boolean
}

/** Olvidos de la píldora que se listan como mucho en el informe (los más recientes). */
export const MAX_PILL_MISSED_LISTED = 31

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
    /** Ciclos apartados de las medias por un posible periodo sin registrar. */
    missedCount: number
    lastStart: ISODate | null
    nextPeriod: PredictedPeriod | null
  }
  /** Ciclos completos del intervalo, del más reciente al más antiguo. */
  cycles: ReportCycle[]
  /** Días registrados con cada intensidad de flujo. */
  flowDays: Record<Flow, number>
  pain: { daysWithPain: number; average: number; max: number; severeDays: number } | null
  symptoms: { name: string; count: number; topPhase: Phase | null; timing: SymptomTiming | null }[]
  medication: { name: string; count: number; last: ISODate }[]
  /** Datos opcionales de fertilidad y peso; null si no hay ninguno en el intervalo. */
  fertility: {
    temperature: { count: number; min: number; max: number } | null
    sex: { protected: number; unprotected: number }
    mucusDays: number
    weight: { first: number; last: number; firstDate: ISODate; lastDate: ISODate } | null
    /** Días con cada resultado de test. */
    tests: { ovulation: Record<TestResult, number>; pregnancy: Record<TestResult, number> }
    /** Medias de tensión (mmHg) y pulso (lpm) del intervalo. */
    pressure: { count: number; systolic: number | null; diastolic: number | null; pulse: number | null } | null
  } | null
  notes: { date: ISODate; text: string }[]
  /** Tomas de la píldora; null si no se registran. `missed` va limitado a los más recientes. */
  pill: (PillAdherence & { missedTotal: number }) | null
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

  const inRangeCycles = completedCycles(periods).filter((c) => inRange(c.start))
  // Los ciclos que parecen esconder un periodo olvidado no cuentan para las medias.
  const { missed, ignored } = splitMissed(
    inRangeCycles,
    opts.userCycleLength,
    opts.confirmedLongCycles,
    opts.ignoreCyclesOver ?? null,
  )
  const missedStarts = new Set(missed.map((c) => c.start))
  const ignoredStarts = new Set(ignored.map((c) => c.start))
  const cycles: ReportCycle[] = inRangeCycles
    .map((c) => ({ ...c, suspectedMissed: missedStarts.has(c.start) }))
    .reverse()
  const counted = cycles.filter((c) => !c.suspectedMissed && !ignoredStarts.has(c.start))
  const lengths = counted.map((c) => c.length)
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

  const symptoms = symptomStats(rangeDays, periods, prediction.cycleLength, prediction.periodLength, today, prediction.lutealPhase).map(
    ({ name, count, topPhase, timing }) => ({ name, count, topPhase, timing }),
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

  const sorted = [...rangeDays].sort((a, b) => a.date.localeCompare(b.date))
  const temps = sorted.flatMap((d) => (d.temperature === undefined ? [] : [d.temperature]))
  const weights = sorted.filter((d) => d.weight !== undefined)
  const sex = {
    protected: rangeDays.filter((d) => d.sex === 'protected').length,
    unprotected: rangeDays.filter((d) => d.sex === 'unprotected').length,
  }
  const mucusDays = rangeDays.filter((d) => d.mucus).length
  const countTests = (k: 'ovulationTest' | 'pregnancyTest') => ({
    negative: rangeDays.filter((d) => d[k] === 'negative').length,
    positive: rangeDays.filter((d) => d[k] === 'positive').length,
  })
  const tests = { ovulation: countTests('ovulationTest'), pregnancy: countTests('pregnancyTest') }
  const testCount = tests.ovulation.negative + tests.ovulation.positive + tests.pregnancy.negative + tests.pregnancy.positive
  const bp = rangeDays.filter((d) => d.systolic !== undefined && d.diastolic !== undefined)
  const pulses = rangeDays.flatMap((d) => (d.pulse === undefined ? [] : [d.pulse]))
  const round = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)
  const pressure =
    bp.length || pulses.length
      ? {
          count: rangeDays.filter((d) => d.systolic !== undefined || d.pulse !== undefined).length,
          systolic: round(bp.map((d) => d.systolic!)),
          diastolic: round(bp.map((d) => d.diastolic!)),
          pulse: round(pulses),
        }
      : null
  const hasFertility =
    temps.length > 0 ||
    weights.length > 0 ||
    sex.protected + sex.unprotected > 0 ||
    mucusDays > 0 ||
    testCount > 0 ||
    pressure !== null
  const fertility = hasFertility
    ? {
        temperature: temps.length ? { count: temps.length, min: Math.min(...temps), max: Math.max(...temps) } : null,
        sex,
        mucusDays,
        weight: weights.length
          ? {
              first: weights[0].weight!,
              last: weights.at(-1)!.weight!,
              firstDate: weights[0].date,
              lastDate: weights.at(-1)!.date,
            }
          : null,
        tests,
        pressure,
      }
    : null

  return {
    generatedOn: today,
    from,
    to: today,
    summary: {
      cyclesCount: counted.length,
      missedCount: cycles.length - counted.length,
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
    fertility,
    notes,
    pill: pillSummary(days, opts.pill, from, today),
  }
}

function pillSummary(days: DayLog[], cfg: PillConfig | null | undefined, from: ISODate, today: ISODate): Report['pill'] {
  if (!cfg) return null
  const a = pillAdherence(days, cfg, from, today)
  return { ...a, missed: a.missed.slice(0, MAX_PILL_MISSED_LISTED), missedTotal: a.missed.length }
}

/** Nombre de archivo para descargar el informe. */
export const reportFileName = (r: Report) => `ciclita-${lang === 'en' ? 'report' : 'informe'}-${r.generatedOn}.pdf`

