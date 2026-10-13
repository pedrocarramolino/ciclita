/**
 * Lógica de predicción del ciclo.
 *
 * Todo son ESTIMACIONES basadas en medias: no sirven como método anticonceptivo
 * ni sustituyen el consejo médico.
 *
 * Definiciones:
 *  - Ciclo: días desde el inicio de un periodo hasta el inicio del siguiente.
 *  - Duración del ciclo/periodo: media redondeada de los últimos 6 registrados.
 *    Sin datos se usa lo que indicó la usuaria en el onboarding y, si eligió
 *    "No lo sé", 28 y 5 días.
 *  - Ovulación estimada: 14 días antes del inicio del siguiente periodo (la fase
 *    lútea es la más estable del ciclo).
 *  - Ventana fértil estimada: de 5 días antes de la ovulación al día siguiente.
 */
import type { Period } from '../db/db'
import { addDays, diffDays, type ISODate } from './dates'
import { periodDateSet } from './periods'

export const DEFAULT_CYCLE_LENGTH = 28
export const DEFAULT_PERIOD_LENGTH = 5
/** Número de ciclos recientes que se usan para las medias. */
export const HISTORY_SIZE = 6
/** Variación (más largo − más corto) a partir de la cual el ciclo se considera irregular. */
export const IRREGULAR_VARIATION = 7
export const PREDICTED_PERIODS = 3
export const LUTEAL_PHASE = 14

/**
 * Ciclos fuera de este rango se ignoran en las medias: casi siempre son
 * registros olvidados (un hueco de 3 meses) o duplicados, no ciclos reales.
 */
const MIN_CYCLE = 15
const MAX_CYCLE = 60
const MAX_PERIOD = 14

export type Source = 'history' | 'user' | 'default'

export interface DateRange {
  start: ISODate
  end: ISODate
}

export interface FertileWindow extends DateRange {
  ovulation: ISODate
}

export type CycleStatus =
  | { kind: 'noData' }
  | { kind: 'period'; day: number; ongoing: boolean }
  | { kind: 'upcoming'; daysUntil: number; cycleDay: number; inFertileWindow: boolean }
  | { kind: 'late'; daysLate: number; cycleDay: number }

export interface Prediction {
  /** Duración media del ciclo en días. */
  cycleLength: number
  cycleSource: Source
  /** Duración media del periodo en días. */
  periodLength: number
  periodSource: Source
  /** Duraciones de los últimos ciclos completos (máx. 6), de más antiguo a más reciente. */
  recentCycles: number[]
  /** Más largo − más corto de `recentCycles`; null si hay menos de 2 ciclos. */
  variation: number | null
  isIrregular: boolean
  lastStart: ISODate | null
  /** Próximos periodos estimados. */
  nextPeriods: DateRange[]
  /** Ventanas fértiles estimadas del ciclo actual y los siguientes. */
  fertileWindows: FertileWindow[]
  /** Hace más de un ciclo que no se registra ningún periodo. */
  stale: boolean
  status: CycleStatus
}

export interface PredictionInput {
  periods: Period[]
  today: ISODate
  /** Duraciones indicadas en el onboarding/ajustes (null = "No lo sé"). */
  userCycleLength?: number | null
  userPeriodLength?: number | null
}

const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)

/** Duraciones de los ciclos completos, de más antiguo a más reciente. */
export function cycleLengths(periods: Period[]): number[] {
  const starts = periods.map((p) => p.startDate).sort()
  const out: number[] = []
  for (let i = 1; i < starts.length; i++) {
    const len = diffDays(starts[i - 1], starts[i])
    if (len >= MIN_CYCLE && len <= MAX_CYCLE) out.push(len)
  }
  return out
}

/** Duraciones de los periodos ya terminados, de más antiguo a más reciente. */
export function periodLengths(periods: Period[]): number[] {
  return periods
    .filter((p): p is Period & { endDate: ISODate } => p.endDate !== null)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((p) => diffDays(p.startDate, p.endDate) + 1)
    .filter((n) => n >= 1 && n <= MAX_PERIOD)
}

/** Ovulación y ventana fértil para un ciclo que empieza en `cycleStart`. */
export function fertileWindowFor(
  cycleStart: ISODate,
  nextStart: ISODate,
  periodLength: number,
): FertileWindow {
  const ovulation = addDays(nextStart, -LUTEAL_PHASE)
  let start = addDays(ovulation, -5)
  // En ciclos muy cortos, la ventana no puede empezar antes de que acabe el periodo.
  const afterPeriod = addDays(cycleStart, periodLength)
  if (start < afterPeriod) start = afterPeriod
  const end = addDays(ovulation, 1)
  return { start: start > end ? end : start, end, ovulation }
}

export function predict(input: PredictionInput): Prediction {
  const { periods, today } = input

  // 1. Medias a partir de los últimos 6 ciclos (o valores de reserva).
  const recentCycles = cycleLengths(periods).slice(-HISTORY_SIZE)
  const recentPeriods = periodLengths(periods).slice(-HISTORY_SIZE)

  const [cycleLength, cycleSource]: [number, Source] = recentCycles.length
    ? [mean(recentCycles), 'history']
    : input.userCycleLength
      ? [input.userCycleLength, 'user']
      : [DEFAULT_CYCLE_LENGTH, 'default']

  const [periodLength, periodSource]: [number, Source] = recentPeriods.length
    ? [mean(recentPeriods), 'history']
    : input.userPeriodLength
      ? [input.userPeriodLength, 'user']
      : [DEFAULT_PERIOD_LENGTH, 'default']

  // 2. Regularidad.
  const variation =
    recentCycles.length >= 2 ? Math.max(...recentCycles) - Math.min(...recentCycles) : null
  const isIrregular = variation !== null && variation > IRREGULAR_VARIATION

  const base = {
    cycleLength,
    cycleSource,
    periodLength,
    periodSource,
    recentCycles,
    variation,
    isIrregular,
  }

  const lastStart = periods.map((p) => p.startDate).sort().at(-1) ?? null
  if (!lastStart) {
    return {
      ...base,
      lastStart,
      nextPeriods: [],
      fertileWindows: [],
      stale: false,
      status: { kind: 'noData' },
    }
  }

  // 3. Punto de partida de las predicciones.
  //    - Normal: último inicio + duración media.
  //    - Retraso de hasta un ciclo: el periodo "puede llegar en cualquier momento",
  //      así que el siguiente se estima a partir de hoy.
  //    - Más de un ciclo sin registros: datos desactualizados; se proyecta desde el
  //      último inicio saltando los ciclos ya pasados.
  const sinceLast = diffDays(lastStart, today)
  const cycleDay = sinceLast + 1
  const inPeriodToday = periodDateSet(periods, today).has(today)
  const daysLate = sinceLast - cycleLength
  const onTime = daysLate <= 0 || inPeriodToday
  const stale = !onTime && daysLate > cycleLength
  const late = !onTime && !stale

  let firstNext: ISODate
  let currentCycleStart: ISODate = lastStart
  if (onTime) {
    firstNext = addDays(lastStart, cycleLength)
  } else if (late) {
    firstNext = today
  } else {
    const k = Math.floor(sinceLast / cycleLength) + 1
    firstNext = addDays(lastStart, k * cycleLength)
    currentCycleStart = addDays(firstNext, -cycleLength)
  }

  // 4. Próximos 3 periodos y sus ventanas fértiles.
  const nextPeriods: DateRange[] = []
  for (let i = 0; i < PREDICTED_PERIODS; i++) {
    const start = addDays(firstNext, i * cycleLength)
    nextPeriods.push({ start, end: addDays(start, periodLength - 1) })
  }

  const fertileWindows: FertileWindow[] = []
  // Ventana del ciclo actual (no aplica si ya vamos con retraso: la ovulación ya pasó o se desconoce).
  if (!late) {
    fertileWindows.push(fertileWindowFor(currentCycleStart, nextPeriods[0].start, periodLength))
  }
  for (let i = 0; i < nextPeriods.length - 1; i++) {
    fertileWindows.push(
      fertileWindowFor(nextPeriods[i].start, nextPeriods[i + 1].start, periodLength),
    )
  }

  // 5. Estado de hoy, para la pantalla de inicio.
  let status: CycleStatus
  if (inPeriodToday) {
    const current = periods
      .filter((p) => p.startDate <= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .at(-1)!
    status = {
      kind: 'period',
      day: diffDays(current.startDate, today) + 1,
      ongoing: current.endDate === null,
    }
  } else if (late) {
    status = { kind: 'late', daysLate, cycleDay }
  } else {
    status = {
      kind: 'upcoming',
      daysUntil: diffDays(today, nextPeriods[0].start),
      cycleDay: stale ? diffDays(currentCycleStart, today) + 1 : cycleDay,
      inFertileWindow: fertileWindows.some((w) => w.start <= today && today <= w.end),
    }
  }

  return { ...base, lastStart, nextPeriods, fertileWindows, stale, status }
}
