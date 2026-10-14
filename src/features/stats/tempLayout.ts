/**
 * Geometría de la gráfica de temperatura basal de un ciclo (sin dependencias).
 * Función pura: dado el ciclo y el tamaño, devuelve dónde va cada cosa.
 */
import type { TempCycle } from '../../domain/temperature'

export const TEMP_MARGIN = { top: 16, right: 10, bottom: 26, left: 38 }
/** Rango mínimo del eje Y (°C), para que las pequeñas variaciones no parezcan enormes. */
const MIN_SPAN = 0.6

export interface TempLayout {
  width: number
  height: number
  plot: { left: number; top: number; right: number; bottom: number }
  x: (day: number) => number
  y: (temp: number) => number
  yTicks: number[]
  xTicks: number[]
  /** Franja de los días de periodo (en píxeles), si hay. */
  periodBand: { x: number; width: number } | null
  points: { cx: number; cy: number; hitX: number; hitWidth: number }[]
  /** Trazado de la línea; un hueco de más de un día se dibuja aparte (discontinuo). */
  line: string
  gaps: string
}

const floor1 = (n: number) => Math.floor(n * 10 + 1e-9) / 10
const ceil1 = (n: number) => Math.ceil(n * 10 - 1e-9) / 10

export function tempLayout(cycle: TempCycle, width: number, height: number): TempLayout {
  const plot = {
    left: TEMP_MARGIN.left,
    top: TEMP_MARGIN.top,
    right: Math.max(TEMP_MARGIN.left + 1, width - TEMP_MARGIN.right),
    bottom: Math.max(TEMP_MARGIN.top + 1, height - TEMP_MARGIN.bottom),
  }
  const temps = cycle.points.map((p) => p.temp)
  if (cycle.shift) temps.push(cycle.shift.coverline)
  let lo = floor1(Math.min(...temps) - 0.1)
  let hi = ceil1(Math.max(...temps) + 0.1)
  if (hi - lo < MIN_SPAN) {
    const pad = (MIN_SPAN - (hi - lo)) / 2
    lo = floor1(lo - pad)
    hi = ceil1(hi + pad)
  }
  const span = hi - lo
  const step = span > 1.2 ? 0.4 : span > 0.8 ? 0.2 : 0.1
  const yTicks: number[] = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) yTicks.push(Math.round(v * 10) / 10)

  const lastDay = Math.max(cycle.length, ...cycle.points.map((p) => p.day))
  const innerW = plot.right - plot.left
  const x = (day: number) => plot.left + (lastDay > 1 ? ((day - 1) / (lastDay - 1)) * innerW : innerW / 2)
  const y = (temp: number) => plot.bottom - ((temp - lo) / span) * (plot.bottom - plot.top)

  const xTicks = [1]
  for (let d = 7; d <= lastDay; d += 7) xTicks.push(d)
  if (lastDay - xTicks.at(-1)! >= 3) xTicks.push(lastDay)

  const dayW = lastDay > 1 ? innerW / (lastDay - 1) : innerW
  const pd = cycle.periodDays
  const periodBand = pd.length
    ? (() => {
        const a = Math.max(plot.left, x(Math.min(...pd)) - dayW / 2)
        const b = Math.min(plot.right, x(Math.max(...pd)) + dayW / 2)
        return { x: a, width: Math.max(0, b - a) }
      })()
    : null

  const pts = cycle.points.map((p) => ({ cx: x(p.day), cy: y(p.temp) }))
  // Zona sensible de cada punto: hasta la mitad de la distancia a sus vecinos.
  const points = pts.map((p, i) => {
    const left = i === 0 ? plot.left : (pts[i - 1].cx + p.cx) / 2
    const right = i === pts.length - 1 ? plot.right : (p.cx + pts[i + 1].cx) / 2
    return { ...p, hitX: left, hitWidth: Math.max(1, right - left) }
  })

  let line = ''
  let gaps = ''
  cycle.points.forEach((p, i) => {
    const { cx, cy } = pts[i]
    if (i === 0) {
      line += `M${cx},${cy}`
      return
    }
    const prev = pts[i - 1]
    if (p.day - cycle.points[i - 1].day > 1) {
      gaps += `M${prev.cx},${prev.cy}L${cx},${cy}`
      line += `M${cx},${cy}`
    } else line += `L${cx},${cy}`
  })

  return { width, height, plot, x, y, yTicks, xTicks, periodBand, points, line, gaps }
}
