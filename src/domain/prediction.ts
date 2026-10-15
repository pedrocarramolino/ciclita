/**
 * Lógica de predicción del ciclo.
 *
 * Todo son ESTIMACIONES basadas en medias: no sirven como método anticonceptivo
 * ni sustituyen el consejo médico.
 *
 * Definiciones:
 *  - Ciclo: días desde el inicio de un periodo hasta el inicio del siguiente.
 *  - Duración del ciclo/periodo: mediana de los últimos 6 registrados (un ciclo
 *    aislado muy largo o muy corto no la desplaza, como sí haría una media). Sin
 *    datos se usa lo que indicó la usuaria en el onboarding y, si eligió "No lo sé",
 *    28 y 5 días. Con solo 1 o 2 registrados, esos valores cuentan como uno más en la
 *    mediana: un único ciclo raro no decide por sí solo la próxima fecha.
 *  - Previsión manual: si la usuaria lo elige, se usan siempre las duraciones que indicó
 *    (sin margen), aunque haya historial. Útil si los registros antiguos no son fiables.
 *  - Periodo olvidado: un ciclo que dura 1,7 veces lo habitual o más suele ser un
 *    periodo sin registrar. Se aparta de los cálculos y se pregunta (salvo que la
 *    usuaria haya confirmado que fue un ciclo largo de verdad).
 *  - Ovulación estimada: 14 días antes del inicio del siguiente periodo (la fase
 *    lútea es la más estable del ciclo).
 *  - Ventana fértil estimada: de 5 días antes de la ovulación al día siguiente.
 *  - Margen: si los ciclos varían, cada previsión lleva un intervalo ("podría empezar
 *    entre el 3 y el 7"), calculado con la desviación típica de los últimos ciclos. El
 *    margen crece para los periodos más lejanos y amplía también la ventana fértil.
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
/** Ciclos mínimos para estimar un margen, y margen máximo en días. */
export const MIN_CYCLES_FOR_MARGIN = 3
export const MAX_MARGIN = 6
/** Un ciclo de esta proporción respecto al habitual o más se toma por periodo olvidado. */
export const MISSED_PERIOD_RATIO = 1.7
/** Por debajo de estos registros, la mediana incluye también el valor indicado (o el habitual). */
export const MIN_HISTORY_ALONE = 3

/**
 * Ciclos fuera de este rango se ignoran en las medias: casi siempre son
 * registros olvidados (un hueco de 3 meses) o duplicados, no ciclos reales.
 */
const MIN_CYCLE = 15
const MAX_CYCLE = 60
const MAX_PERIOD = 14

/** 'mixed': pocos registros, combinados con el valor indicado o el habitual (`*Prior`). */
export type Source = 'history' | 'mixed' | 'user' | 'default'

export interface DateRange {
  start: ISODate
  end: ISODate
}

export interface PredictedPeriod extends DateRange {
  /** Margen en días (0 si los ciclos son regulares o no hay datos suficientes). */
  margin: number
  /** Intervalo en el que podría empezar: start ± margin (nunca antes de hoy). */
  earliestStart: ISODate
  latestStart: ISODate
}

export interface FertileWindow extends DateRange {
  ovulation: ISODate
  /** Ventana ampliada con el margen: días en los que también podrías ser fértil. */
  possibleStart: ISODate
  possibleEnd: ISODate
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
  /** Valor indicado por la usuaria (o el habitual) con el que se combinan pocos registros. */
  cyclePrior: number
  periodPrior: number
  /** Duraciones de los últimos ciclos completos (máx. 6), de más antiguo a más reciente. */
  recentCycles: number[]
  /** Ciclos recientes tan largos que probablemente falta registrar un periodo. */
  suspectedMissed: SuspectedMissed[]
  /** Más largo − más corto de `recentCycles`; null si hay menos de 2 ciclos. */
  variation: number | null
  isIrregular: boolean
  lastStart: ISODate | null
  /** Próximos periodos estimados, con su margen. */
  nextPeriods: PredictedPeriod[]
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
  /** Inicios de ciclos largos que la usuaria confirmó como reales (no se preguntan). */
  confirmedLongCycles?: ISODate[]
  /** Previsión manual: se usan userCycleLength/userPeriodLength aunque haya historial. */
  manual?: boolean
  /** Ciclos de más de estos días no cuentan (null = automático). */
  ignoreCyclesOver?: number | null
}

export interface SuspectedMissed {
  /** Inicio del ciclo largo y último día antes del periodo siguiente. */
  start: ISODate
  end: ISODate
  length: number
}

/** Mediana redondeada (con un número par de valores, la media de los dos centrales). */
export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2)
}

/** Ciclos completos (inicio y duración), de más antiguo a más reciente. */
export function cycleSpans(periods: Period[]): { start: ISODate; length: number }[] {
  const starts = periods.map((p) => p.startDate).sort()
  const out: { start: ISODate; length: number }[] = []
  for (let i = 1; i < starts.length; i++) {
    const length = diffDays(starts[i - 1], starts[i])
    if (length >= MIN_CYCLE && length <= MAX_CYCLE) out.push({ start: starts[i - 1], length })
  }
  return out
}

/** Duraciones de los ciclos completos, de más antiguo a más reciente. */
export function cycleLengths(periods: Period[]): number[] {
  return cycleSpans(periods).map((c) => c.length)
}

/**
 * Separa de los últimos ciclos los que probablemente esconden un periodo sin
 * registrar (1,7 veces lo habitual o más). Lo habitual es la mediana de los últimos
 * ciclos si hay al menos 3, o la duración que indicó la usuaria.
 */
export function splitMissed(
  allSpans: { start: ISODate; length: number }[],
  userCycleLength: number | null | undefined,
  confirmed: ISODate[] = [],
  /** Si la usuaria lo elige: los ciclos de más de estos días se ignoran sin preguntar. */
  ignoreOver: number | null = null,
): {
  used: { start: ISODate; length: number }[]
  missed: { start: ISODate; length: number }[]
  ignored: { start: ISODate; length: number }[]
} {
  const ignored = ignoreOver ? allSpans.filter((c) => c.length > ignoreOver) : []
  const spans = ignoreOver ? allSpans.filter((c) => c.length <= ignoreOver) : allSpans
  // Con un límite elegido no se pregunta por periodos olvidados: decide la usuaria.
  if (ignoreOver) return { used: spans, missed: [], ignored }
  const ref = spans.length >= 3 ? median(spans.map((c) => c.length)) : (userCycleLength ?? null)
  if (!ref) return { used: spans, missed: [], ignored }
  const limit = ref * MISSED_PERIOD_RATIO
  const isMissed = (c: { start: ISODate; length: number }) => c.length >= limit && !confirmed.includes(c.start)
  return { used: spans.filter((c) => !isMissed(c)), missed: spans.filter(isMissed), ignored }
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
  margin = 0,
): FertileWindow {
  const ovulation = addDays(nextStart, -LUTEAL_PHASE)
  let start = addDays(ovulation, -5)
  // En ciclos muy cortos, la ventana no puede empezar antes de que acabe el periodo.
  const afterPeriod = addDays(cycleStart, periodLength)
  if (start < afterPeriod) start = afterPeriod
  const end = addDays(ovulation, 1)
  const safeStart = start > end ? end : start
  // Con margen, la ovulación podría adelantarse o retrasarse esos días.
  let possibleStart = addDays(safeStart, -margin)
  if (possibleStart < afterPeriod) possibleStart = afterPeriod
  if (possibleStart > safeStart) possibleStart = safeStart
  return { start: safeStart, end, ovulation, possibleStart, possibleEnd: addDays(end, margin) }
}

/**
 * Margen (± días) para el k-ésimo próximo periodo (k = 1, 2, 3): desviación típica de
 * los últimos ciclos, que crece con la raíz de k (la incertidumbre se acumula).
 * Sin al menos 3 ciclos no se estima (0).
 */
export function predictionMargin(recentCycles: number[], k: number): number {
  if (recentCycles.length < MIN_CYCLES_FOR_MARGIN) return 0
  const avg = recentCycles.reduce((a, b) => a + b, 0) / recentCycles.length
  const sd = Math.sqrt(recentCycles.reduce((a, x) => a + (x - avg) ** 2, 0) / recentCycles.length)
  return Math.min(MAX_MARGIN, Math.round(sd * Math.sqrt(k)))
}

export function predict(input: PredictionInput): Prediction {
  const { periods, today } = input

  // 1. Duraciones típicas a partir de los últimos 6 ciclos (o valores de reserva),
  //    sin los ciclos que parecen esconder un periodo olvidado.
  const { used, missed } = splitMissed(
    cycleSpans(periods).slice(-HISTORY_SIZE),
    input.userCycleLength,
    input.confirmedLongCycles,
    input.ignoreCyclesOver ?? null,
  )
  const recentCycles = used.map((c) => c.length)
  const suspectedMissed: SuspectedMissed[] = missed.map((c) => ({
    start: c.start,
    end: addDays(c.start, c.length - 1),
    length: c.length,
  }))
  const recentPeriods = periodLengths(periods).slice(-HISTORY_SIZE)

  const manual = !!input.manual && !!input.userCycleLength
  const cyclePrior = input.userCycleLength ?? DEFAULT_CYCLE_LENGTH
  const periodPrior = input.userPeriodLength ?? DEFAULT_PERIOD_LENGTH
  /** Mediana del historial; con pocos registros, el valor de reserva cuenta como uno más. */
  const typical = (history: number[], prior: number, fallback: Source): [number, Source] =>
    history.length >= MIN_HISTORY_ALONE
      ? [median(history), 'history']
      : history.length
        ? [median([...history, prior]), 'mixed']
        : [prior, fallback]

  const [cycleLength, cycleSource]: [number, Source] = manual
    ? [input.userCycleLength!, 'user']
    : typical(recentCycles, cyclePrior, input.userCycleLength ? 'user' : 'default')

  const [periodLength, periodSource]: [number, Source] =
    manual && input.userPeriodLength
      ? [input.userPeriodLength, 'user']
      : typical(recentPeriods, periodPrior, input.userPeriodLength ? 'user' : 'default')

  // 2. Regularidad.
  const variation =
    recentCycles.length >= 2 ? Math.max(...recentCycles) - Math.min(...recentCycles) : null
  const isIrregular = variation !== null && variation > IRREGULAR_VARIATION

  const base = {
    cycleLength,
    cycleSource,
    periodLength,
    periodSource,
    cyclePrior,
    periodPrior,
    recentCycles,
    suspectedMissed,
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
  const nextPeriods: PredictedPeriod[] = []
  for (let i = 0; i < PREDICTED_PERIODS; i++) {
    const start = addDays(firstNext, i * cycleLength)
    // Con previsión manual las fechas son fijas: sin margen.
    const margin = manual ? 0 : predictionMargin(recentCycles, i + 1)
    let earliestStart = addDays(start, -margin)
    // Si el periodo aún no ha llegado, no puede empezar antes de hoy.
    if (!inPeriodToday && earliestStart < today) earliestStart = today
    if (earliestStart > start) earliestStart = start
    nextPeriods.push({
      start,
      end: addDays(start, periodLength - 1),
      margin,
      earliestStart,
      latestStart: addDays(start, margin),
    })
  }

  const fertileWindows: FertileWindow[] = []
  // Ventana del ciclo actual (no aplica si ya vamos con retraso: la ovulación ya pasó o se desconoce).
  if (!late) {
    fertileWindows.push(
      fertileWindowFor(currentCycleStart, nextPeriods[0].start, periodLength, nextPeriods[0].margin),
    )
  }
  for (let i = 0; i < nextPeriods.length - 1; i++) {
    fertileWindows.push(
      fertileWindowFor(nextPeriods[i].start, nextPeriods[i + 1].start, periodLength, nextPeriods[i + 1].margin),
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
