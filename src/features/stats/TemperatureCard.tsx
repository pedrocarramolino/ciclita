import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { formatDayMonth, formatFullDate } from '../../domain/dates'
import type { TempCycle } from '../../domain/temperature'
import { t } from '../../i18n'
import { tempLayout } from './tempLayout'
import { useWidth } from './useWidth'

const HEIGHT = 220
const num = (n: number) => t.report.decimal(n)

/**
 * Temperatura basal de un ciclo: tomas día a día, días de periodo sombreados, línea
 * de base y ovulación probable si se detecta la subida. Por defecto, el ciclo más
 * reciente; con las flechas se ven los anteriores.
 */
export function TemperatureCard({ cycles }: { cycles: TempCycle[] }) {
  const [index, setIndex] = useState(cycles.length - 1)
  const s = t.stats.temp
  const i = Math.min(index, cycles.length - 1)
  const cycle = cycles[i]
  const temps = cycle.points.map((p) => p.temp)

  return (
    <section aria-labelledby="temp-title" className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id="temp-title" className="text-lg font-extrabold">
        {s.title}
      </h2>
      <div className="mt-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIndex(i - 1)}
          disabled={i === 0}
          aria-label={s.prev}
          className="grid size-11 place-items-center rounded-full hover:bg-surface-soft disabled:opacity-30"
        >
          <Icon name="chevronLeft" />
        </button>
        <p className="text-center text-sm" aria-live="polite">
          <span className="block font-bold">
            {s.cycleOf(formatDayMonth(cycle.start))}
            {i === cycles.length - 1 && ` · ${s.current}`}
          </span>
          <span className="text-muted">{s.readings(cycle.points.length)}</span>
        </p>
        <button
          type="button"
          onClick={() => setIndex(i + 1)}
          disabled={i === cycles.length - 1}
          aria-label={s.next}
          className="grid size-11 place-items-center rounded-full hover:bg-surface-soft disabled:opacity-30"
        >
          <Icon name="chevronRight" />
        </button>
      </div>

      <Legend withShift={!!cycle.shift} withPeriod={cycle.periodDays.length > 0} />
      <figure className="mt-2">
        <TemperatureChart key={cycle.start} cycle={cycle} />
        <figcaption className="sr-only">
          {s.summary(cycle.points.length, num(Math.min(...temps)), num(Math.max(...temps)))}
        </figcaption>
      </figure>

      <p className="mt-2 text-sm font-bold">
        {cycle.shift ? s.shift(cycle.shift.firstHighDay, cycle.shift.ovulationDay) : s.noShift}
      </p>
      <p className="mt-1 text-xs text-muted">{s.note}</p>

      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-primary">{t.stats.showTable}</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 font-bold">{s.colDate}</th>
              <th scope="col" className="py-1 text-right font-bold">{s.colDay}</th>
              <th scope="col" className="py-1 text-right font-bold">{s.colTemp}</th>
            </tr>
          </thead>
          <tbody>
            {cycle.points.map((p) => (
              <tr key={p.date} className="border-t border-line">
                <td className="py-1.5">{formatFullDate(p.date)}</td>
                <td className="py-1.5 text-right tabular-nums">{p.day}</td>
                <td className="py-1.5 text-right tabular-nums">{num(p.temp)} °C</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}

function Legend({ withShift, withPeriod }: { withShift: boolean; withPeriod: boolean }) {
  const s = t.stats.temp
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <li className="flex items-center gap-1.5">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-[var(--focus)]" />
        {s.legendTemp}
      </li>
      {withPeriod && (
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-3 w-4 rounded-sm bg-rose-soft" />
          {s.legendPeriod}
        </li>
      )}
      {withShift && (
        <>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-ink" />
            {s.legendCoverline}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-3 border-l-2 border-dotted border-muted" />
            {s.legendOvulation}
          </li>
        </>
      )}
    </ul>
  )
}

function TemperatureChart({ cycle }: { cycle: TempCycle }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const l = width > 0 ? tempLayout(cycle, width, HEIGHT) : null
  const s = t.stats.temp
  const activePoint = active !== null ? cycle.points[active] : undefined
  const activePos = active !== null ? l?.points[active] : undefined

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ height: HEIGHT }}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
    >
      {l && (
        <svg width={l.width} height={l.height} aria-hidden="true" className="block overflow-visible">
          {l.periodBand && (
            <rect
              x={l.periodBand.x}
              y={l.plot.top}
              width={l.periodBand.width}
              height={l.plot.bottom - l.plot.top}
              className="fill-[var(--rose-soft)]"
            />
          )}
          {l.yTicks.map((v) => (
            <g key={v}>
              <line x1={l.plot.left} x2={l.plot.right} y1={l.y(v)} y2={l.y(v)} className="stroke-[var(--border)]" />
              <text
                x={l.plot.left - 6}
                y={l.y(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-[var(--text-muted)] text-xs"
              >
                {num(v)}
              </text>
            </g>
          ))}
          {l.xTicks.map((d) => (
            <text
              key={d}
              x={l.x(d)}
              y={l.plot.bottom + 16}
              textAnchor="middle"
              className="fill-[var(--text-muted)] text-xs"
            >
              {d}
            </text>
          ))}

          {cycle.shift && (
            <>
              <line
                x1={l.plot.left}
                x2={l.plot.right}
                y1={l.y(cycle.shift.coverline)}
                y2={l.y(cycle.shift.coverline)}
                className="stroke-[var(--text)]"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
              <line
                x1={l.x(cycle.shift.ovulationDay)}
                x2={l.x(cycle.shift.ovulationDay)}
                y1={l.plot.top}
                y2={l.plot.bottom}
                className="stroke-[var(--text-muted)]"
                strokeWidth={2}
                strokeDasharray="1 4"
                strokeLinecap="round"
              />
            </>
          )}

          <path d={l.gaps} fill="none" className="stroke-[var(--focus)]" strokeWidth={2} strokeDasharray="3 4" opacity={0.6} />
          <path d={l.line} fill="none" className="stroke-[var(--focus)]" strokeWidth={2} strokeLinejoin="round" />
          {l.points.map((p, i) => (
            <circle
              key={cycle.points[i].date}
              cx={p.cx}
              cy={p.cy}
              r={active === i ? 6 : 4}
              className="fill-[var(--focus)] stroke-[var(--surface)]"
              strokeWidth={2}
            />
          ))}
          {l.points.map((p, i) => (
            <rect
              key={cycle.points[i].date}
              x={p.hitX}
              y={l.plot.top}
              width={p.hitWidth}
              height={l.plot.bottom - l.plot.top}
              fill="transparent"
              className="cursor-pointer"
              onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
              onClick={() => setActive((a) => (a === i ? null : i))}
            />
          ))}
        </svg>
      )}

      {l && activePoint && activePos && (
        <div
          className="pointer-events-none absolute z-10 w-36 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lg"
          style={{
            left: Math.min(Math.max(activePos.cx < l.width / 2 ? activePos.cx + 12 : activePos.cx - 12 - 144, 0), l.width - 144),
            top: l.plot.top,
          }}
        >
          <p className="font-bold">{num(activePoint.temp)} °C</p>
          <p>{s.day(activePoint.day)}</p>
          <p className="text-muted">{formatDayMonth(activePoint.date)}</p>
        </div>
      )}
    </div>
  )
}
