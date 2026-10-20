/**
 * Probabilidad de que el próximo periodo empiece cada día. Función pura.
 *
 * Se supone que la duración del ciclo sigue una distribución normal centrada en la
 * fecha prevista y con la desviación típica de los últimos ciclos (como mínimo 1 día).
 * Como el periodo aún no ha empezado, los días anteriores a hoy se descartan y el resto
 * se reparte de nuevo. Solo se calcula con al menos 3 ciclos y previsión automática.
 */
import { addDays, diffDays, type ISODate } from './dates'
import { MIN_CYCLES_FOR_MARGIN, type Prediction } from './prediction'

/** Días con menos de esta probabilidad no se muestran. */
export const MIN_SHOWN = 0.03
/** Probabilidad que reúne el intervalo "lo más probable". */
export const LIKELY_MASS = 0.8
const MIN_SD = 1

export interface DayProbability {
  date: ISODate
  probability: number
}

export interface StartProbability {
  /** Días con al menos un 3 %, por orden de fecha. */
  days: DayProbability[]
  mostLikely: DayProbability
  /** Intervalo más corto alrededor del día más probable que reúne al menos el 80 %. */
  likely: { start: ISODate; end: ISODate; probability: number }
}

/** Función de distribución de la normal estándar (aproximación de Abramowitz y Stegun). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf =
    1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2
}

export function sampleSd(xs: number[]): number {
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, x) => a + (x - avg) ** 2, 0) / xs.length)
}

export function startProbabilities(p: Prediction, today: ISODate): StartProbability | null {
  const next = p.nextPeriods[0]
  if (p.status.kind !== 'upcoming' || p.stale || p.manual || !next) return null
  if (p.recentCycles.length < MIN_CYCLES_FOR_MARGIN) return null

  const sd = Math.max(MIN_SD, sampleSd(p.recentCycles))
  const mu = diffDays(today, next.start)
  const last = Math.ceil(mu + 4 * sd)
  const raw: number[] = []
  for (let i = 0; i <= last; i++) {
    raw.push(normalCdf((i + 0.5 - mu) / sd) - normalCdf((i - 0.5 - mu) / sd))
  }
  const total = raw.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  const all = raw.map((x, i) => ({ date: addDays(today, i), probability: x / total }))

  let best = 0
  for (let i = 1; i < all.length; i++) if (all[i].probability > all[best].probability) best = i

  // Se amplía hacia el lado más probable hasta reunir el 80 %.
  let lo = best
  let hi = best
  let mass = all[best].probability
  while (mass < LIKELY_MASS && (lo > 0 || hi < all.length - 1)) {
    const left = lo > 0 ? all[lo - 1].probability : -1
    const right = hi < all.length - 1 ? all[hi + 1].probability : -1
    if (right >= left) mass += all[++hi].probability
    else mass += all[--lo].probability
  }

  return {
    days: all.filter((d) => d.probability >= MIN_SHOWN),
    mostLikely: all[best],
    likely: { start: all[lo].date, end: all[hi].date, probability: mass },
  }
}
