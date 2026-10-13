import { useLayoutEffect, useRef, useState } from 'react'
import { formatDayMonth, parseISODate } from '../../domain/dates'
import type { CycleRecord } from '../../domain/stats'
import { locale, t } from '../../i18n'
import { barPath, chartLayout } from './chartLayout'

const HEIGHT = 224
const monthShort = new Intl.DateTimeFormat(locale, { month: 'short' })

/** Ancho disponible del contenedor, actualizado al girar el móvil o cambiar el tamaño. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  // useLayoutEffect: se mide antes de pintar, así la gráfica aparece en el primer
  // fotograma sin esperar al primer aviso del ResizeObserver.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(Math.round(el.getBoundingClientRect().width))
    const obs = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * Gráfica de barras propia (SVG, sin librerías) con la duración de cada ciclo y una
 * línea discontinua en la media. Tocar o pasar el ratón por una barra muestra el
 * detalle. Los colores salen de las variables del tema, así que sigue al modo oscuro.
 * La alternativa accesible es la tabla de datos que acompaña a la gráfica.
 */
export function CycleChart({ cycles, average }: { cycles: CycleRecord[]; average: number }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const labels = cycles.map((c) => monthShort.format(parseISODate(c.start)).replace('.', ''))
  const layout = width > 0 ? chartLayout(cycles.map((c) => c.length), labels, average, width, HEIGHT) : null
  const s = t.stats

  const activeBar = active !== null ? layout?.bars[active] : undefined
  const activeCycle = active !== null ? cycles[active] : undefined

  return (
    <div ref={ref} className="relative h-56 w-full" onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}>
      {layout && (
        <svg width={layout.width} height={layout.height} aria-hidden="true" className="block overflow-visible">
          {/* Rejilla y eje Y, discretos */}
          {layout.yTicks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={layout.plot.left}
                x2={layout.plot.right}
                y1={tick.y}
                y2={tick.y}
                className="stroke-[var(--border)]"
                strokeWidth={1}
              />
              <text
                x={layout.plot.left - 8}
                y={tick.y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-[var(--text-muted)] text-xs"
              >
                {tick.value}
              </text>
            </g>
          ))}

          {/* Barras */}
          {layout.bars.map((b, i) => (
            <path
              key={cycles[i].start}
              d={barPath(b.x, b.y, b.width, b.height)}
              className="chart-bar fill-[var(--chart-bar)] transition-opacity duration-150"
              style={{ '--i': i, opacity: active === null || active === i ? 1 : 0.45 } as React.CSSProperties}
            />
          ))}

          {/* Media */}
          <line
            x1={layout.plot.left}
            x2={layout.plot.right}
            y1={layout.averageY}
            y2={layout.averageY}
            className="stroke-[var(--text)]"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />

          {/* Etiquetas del eje X */}
          {layout.bars.map(
            (b, i) =>
              b.showLabel && (
                <text
                  key={cycles[i].start}
                  x={b.cx}
                  y={layout.plot.bottom + 16}
                  textAnchor="middle"
                  className="fill-[var(--text-muted)] text-xs"
                >
                  {b.label}
                </text>
              ),
          )}

          {/* Zonas sensibles: toda la franja de cada barra, más fácil de tocar */}
          {layout.bars.map((b, i) => (
            <rect
              key={cycles[i].start}
              x={b.hitX}
              y={layout.plot.top}
              width={b.hitWidth}
              height={layout.plot.bottom - layout.plot.top}
              fill="transparent"
              className="cursor-pointer"
              onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
              onClick={() => setActive((a) => (a === i ? null : i))}
            />
          ))}
        </svg>
      )}

      {/* Detalle de la barra activa */}
      {layout && activeBar && activeCycle && (
        // Arriba del área de la gráfica y al lado de la barra (a la derecha si la barra
        // está en la mitad izquierda, y al revés), para no tapar la barra ni el título.
        <div
          className="pointer-events-none absolute z-10 w-40 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lg"
          style={{
            left: Math.min(
              Math.max(
                activeBar.cx < layout.width / 2 ? activeBar.cx + activeBar.width / 2 + 8 : activeBar.cx - activeBar.width / 2 - 8 - 160,
                0,
              ),
              Math.max(0, layout.width - 160),
            ),
            top: layout.plot.top,
          }}
        >
          <p className="font-bold">{s.tooltipCycle(formatDayMonth(activeCycle.start))}</p>
          <p>{s.days(activeCycle.length)}</p>
          <p className="text-muted">{s.periodDays(activeCycle.periodLength)}</p>
        </div>
      )}
    </div>
  )
}
