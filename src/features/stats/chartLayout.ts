/**
 * Geometría de la gráfica de barras de ciclos (sin dependencias). Función pura para
 * poder probarla: dado el tamaño disponible y los datos, devuelve dónde va cada cosa.
 */

export interface ChartBar {
  x: number
  y: number
  width: number
  height: number
  /** Zona sensible al toque/ratón: toda la franja de la barra, más grande que la barra. */
  hitX: number
  hitWidth: number
  cx: number
  value: number
  label: string
  showLabel: boolean
}

export interface ChartLayout {
  width: number
  height: number
  plot: { left: number; top: number; right: number; bottom: number }
  yTicks: { value: number; y: number }[]
  averageY: number
  bars: ChartBar[]
}

export const MARGIN = { top: 12, right: 8, bottom: 24, left: 30 }
export const MAX_BAR_WIDTH = 28
/** Espacio mínimo entre etiquetas del eje X para que no se pisen. */
const MIN_LABEL_SPACING = 30

/** Máximo del eje Y: múltiplo de 5 con algo de aire por encima del valor mayor. */
export function niceMax(max: number): number {
  return Math.max(5, Math.ceil((max + 4) / 5) * 5)
}

/** Marcas del eje Y: de 0 al máximo, cada 10 (o cada 20 si el máximo es alto). */
export function yTicksFor(max: number): number[] {
  const step = max > 60 ? 20 : 10
  const ticks: number[] = []
  for (let v = 0; v <= max; v += step) ticks.push(v)
  return ticks
}

export function chartLayout(
  values: number[],
  labels: string[],
  average: number,
  width: number,
  height: number,
): ChartLayout {
  const plot = {
    left: MARGIN.left,
    top: MARGIN.top,
    right: Math.max(MARGIN.left + 1, width - MARGIN.right),
    bottom: Math.max(MARGIN.top + 1, height - MARGIN.bottom),
  }
  const innerW = plot.right - plot.left
  const innerH = plot.bottom - plot.top
  const yMax = niceMax(Math.max(average, ...values, 0))
  const yOf = (v: number) => plot.bottom - (v / yMax) * innerH

  const n = values.length
  const band = n ? innerW / n : innerW
  const barWidth = Math.min(MAX_BAR_WIDTH, band * 0.6)
  // Si no caben todas las etiquetas, se muestra una de cada `stride` (siempre la última).
  const stride = Math.max(1, Math.ceil(MIN_LABEL_SPACING / band))

  const bars = values.map((value, i) => {
    const bandX = plot.left + i * band
    const y = yOf(value)
    return {
      x: bandX + (band - barWidth) / 2,
      y,
      width: barWidth,
      height: plot.bottom - y,
      hitX: bandX,
      hitWidth: band,
      cx: bandX + band / 2,
      value,
      label: labels[i],
      showLabel: (n - 1 - i) % stride === 0,
    }
  })

  return {
    width,
    height,
    plot,
    yTicks: yTicksFor(yMax).map((value) => ({ value, y: yOf(value) })),
    averageY: yOf(average),
    bars,
  }
}

/** Trazado de una barra con las esquinas superiores redondeadas (base recta sobre el eje). */
export function barPath(x: number, y: number, w: number, h: number, radius = 4): string {
  if (h <= 0 || w <= 0) return ''
  const r = Math.min(radius, w / 2, h)
  const bottom = y + h
  return `M${x},${bottom}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${bottom}Z`
}
