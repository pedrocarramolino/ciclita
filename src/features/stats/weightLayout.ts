/**
 * Geometría de la gráfica de peso (sin dependencias): eje X por fechas, eje Y en kg,
 * franjas de los periodos y zonas sensibles de cada punto. Función pura.
 */
import { addDays, diffDays, type ISODate } from '../../domain/dates'

export const WEIGHT_MARGIN = { top: 16, right: 12, bottom: 26, left: 40 }
/** Rango mínimo del eje Y (kg), para que una variación pequeña no parezca enorme. */
const MIN_SPAN = 2

export interface WeightPoint {
  date: ISODate
  weight: number
}

export interface WeightLayout {
  width: number
  height: number
  plot: { left: number; top: number; right: number; bottom: number }
  x: (date: ISODate) => number
  y: (kg: number) => number
  yTicks: number[]
  /** Primer día de cada mes dentro del rango (para las etiquetas del eje X). */
  monthTicks: ISODate[]
  periodBands: { x: number; width: number }[]
  points: { cx: number; cy: number; hitX: number; hitWidth: number }[]
  line: string
}

const niceStep = (span: number) => (span <= 3 ? 0.5 : span <= 6 ? 1 : span <= 15 ? 2 : span <= 30 ? 5 : 10)

export function weightLayout(
  points: WeightPoint[],
  periods: { start: ISODate; end: ISODate }[],
  from: ISODate,
  to: ISODate,
  width: number,
  height: number,
): WeightLayout {
  const plot = {
    left: WEIGHT_MARGIN.left,
    top: WEIGHT_MARGIN.top,
    right: Math.max(WEIGHT_MARGIN.left + 1, width - WEIGHT_MARGIN.right),
    bottom: Math.max(WEIGHT_MARGIN.top + 1, height - WEIGHT_MARGIN.bottom),
  }
  const weights = points.map((p) => p.weight)
  let lo = Math.min(...weights) - 0.5
  let hi = Math.max(...weights) + 0.5
  if (hi - lo < MIN_SPAN) {
    const pad = (MIN_SPAN - (hi - lo)) / 2
    lo -= pad
    hi += pad
  }
  const step = niceStep(hi - lo)
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  const yTicks: number[] = []
  for (let v = lo; v <= hi + 1e-9; v += step) yTicks.push(Math.round(v * 10) / 10)

  const totalDays = Math.max(1, diffDays(from, to))
  const innerW = plot.right - plot.left
  const x = (date: ISODate) => plot.left + (diffDays(from, date) / totalDays) * innerW
  const y = (kg: number) => plot.bottom - ((kg - lo) / (hi - lo)) * (plot.bottom - plot.top)

  const monthTicks: ISODate[] = []
  let m = from.slice(0, 8) + '01'
  if (m < from) m = addDays(m, 32).slice(0, 8) + '01'
  while (m <= to) {
    monthTicks.push(m)
    m = addDays(m, 32).slice(0, 8) + '01'
  }

  const clampX = (v: number) => Math.min(plot.right, Math.max(plot.left, v))
  const periodBands = periods
    .filter((p) => p.end >= from && p.start <= to)
    .map((p) => {
      const a = clampX(x(p.start))
      const b = clampX(x(addDays(p.end, 1)))
      return { x: a, width: Math.max(1, b - a) }
    })

  const pts = points.map((p) => ({ cx: x(p.date), cy: y(p.weight) }))
  const hits = pts.map((p, i) => {
    const left = i === 0 ? plot.left : (pts[i - 1].cx + p.cx) / 2
    const right = i === pts.length - 1 ? plot.right : (p.cx + pts[i + 1].cx) / 2
    return { ...p, hitX: left, hitWidth: Math.max(1, right - left) }
  })
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(' ')

  return { width, height, plot, x, y, yTicks, monthTicks, periodBands, points: hits, line }
}
