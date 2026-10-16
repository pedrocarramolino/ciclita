import { useState } from 'react'
import type { DayLog, Period } from '../../db/db'
import { formatDayMonth, formatFullDate, type ISODate } from '../../domain/dates'
import { periodEnd } from '../../domain/periods'
import { lang, t } from '../../i18n'
import { useWidth } from './useWidth'
import { weightLayout, type WeightPoint } from './weightLayout'

const HEIGHT = 220
const RANGES = [3, 6, 12, 0] as const // meses; 0 = todo
type Range = (typeof RANGES)[number]

const kg = (n: number) => `${t.report.decimal(n)} kg`
const signedKg = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${t.report.decimal(Math.abs(n))} kg`
const monthName = (d: ISODate) =>
  new Intl.DateTimeFormat(lang, { month: 'short' }).format(new Date(`${d}T12:00:00`)).replace('.', '')

function monthsAgo(today: ISODate, months: number): ISODate {
  const [y, m, d] = today.split('-').map(Number)
  const dt = new Date(y, m - 1 - months, d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/**
 * Peso a lo largo del tiempo: una línea con cada pesada y los periodos sombreados,
 * el último peso y cuánto ha cambiado en el rango elegido (3, 6 o 12 meses, o todo).
 */
export function WeightCard({ days, periods, today }: { days: DayLog[]; periods: Period[]; today: ISODate }) {
  const [range, setRange] = useState<Range>(3)
  const s = t.stats.weight
  const all: WeightPoint[] = days
    .filter((d): d is DayLog & { weight: number } => typeof d.weight === 'number')
    .map((d) => ({ date: d.date, weight: d.weight }))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (!all.length) return null

  const from = range === 0 ? all[0].date : monthsAgo(today, range)
  const points = all.filter((p) => p.date >= from && p.date <= today)
  const last = all.at(-1)!
  const change = points.length >= 2 ? points.at(-1)!.weight - points[0].weight : null

  return (
    <section aria-labelledby="weight-title" className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id="weight-title" className="text-lg font-extrabold">
        {s.title}
      </h2>

      <div role="group" aria-label={s.range} className="mt-2 flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={range === r}
            onClick={() => setRange(r)}
            className="min-h-11 rounded-full border border-line px-3 text-sm font-bold aria-pressed:border-primary aria-pressed:bg-primary-soft"
          >
            {r === 0 ? s.all : s.months(r)}
          </button>
        ))}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface-soft p-3">
          <dt className="text-xs font-bold text-muted">{s.last}</dt>
          <dd className="text-2xl font-extrabold">{kg(last.weight)}</dd>
          <dd className="text-xs text-muted">{formatDayMonth(last.date)}</dd>
        </div>
        <div className="rounded-2xl bg-surface-soft p-3">
          <dt className="text-xs font-bold text-muted">{s.change}</dt>
          <dd className="text-2xl font-extrabold">{change === null ? '—' : signedKg(Math.round(change * 10) / 10)}</dd>
          <dd className="text-xs text-muted">{s.inRange(points.length)}</dd>
        </div>
      </dl>

      {points.length ? (
        <figure className="mt-3">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
              {s.legendWeight}
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-4 rounded-sm bg-rose-soft" />
              {t.stats.temp.legendPeriod}
            </li>
          </ul>
          <WeightChart
            key={`${range}-${from}`}
            points={points}
            periods={periods.map((p) => ({ start: p.startDate, end: periodEnd(p, today) }))}
            from={from}
            to={today}
          />
          <figcaption className="sr-only">
            {s.summary(points.length, kg(Math.min(...points.map((p) => p.weight))), kg(Math.max(...points.map((p) => p.weight))))}
          </figcaption>
        </figure>
      ) : (
        <p className="mt-3 text-sm text-muted">{s.noneInRange}</p>
      )}

      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-primary">{t.stats.showTable}</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 font-bold">{s.colDate}</th>
              <th scope="col" className="py-1 text-right font-bold">{s.colWeight}</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.date} className="border-t border-line">
                <td className="py-1.5">{formatFullDate(p.date)}</td>
                <td className="py-1.5 text-right tabular-nums">{kg(p.weight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}

function WeightChart({
  points,
  periods,
  from,
  to,
}: {
  points: WeightPoint[]
  periods: { start: ISODate; end: ISODate }[]
  from: ISODate
  to: ISODate
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)
  const l = width > 0 ? weightLayout(points, periods, from, to, width, HEIGHT) : null
  const activePoint = active !== null ? points[active] : undefined
  const activePos = active !== null ? l?.points[active] : undefined
  // Como mucho unas 6 etiquetas de mes, para que no se monten.
  const every = l ? Math.max(1, Math.ceil(l.monthTicks.length / 6)) : 1

  return (
    <div
      ref={ref}
      className="relative mt-2 w-full"
      style={{ height: HEIGHT }}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
    >
      {l && (
        <svg width={l.width} height={l.height} aria-hidden="true" className="block overflow-visible">
          {l.periodBands.map((b) => (
            <rect
              key={b.x}
              x={b.x}
              y={l.plot.top}
              width={b.width}
              height={l.plot.bottom - l.plot.top}
              className="fill-[var(--rose-soft)]"
            />
          ))}
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
                {t.report.decimal(v)}
              </text>
            </g>
          ))}
          {l.monthTicks.map((m, i) =>
            i % every === 0 ? (
              <text
                key={m}
                x={l.x(m)}
                y={l.plot.bottom + 16}
                textAnchor="middle"
                className="fill-[var(--text-muted)] text-xs"
              >
                {monthName(m)}
              </text>
            ) : null,
          )}

          <path d={l.line} fill="none" className="stroke-[var(--primary)]" strokeWidth={2} strokeLinejoin="round" />
          {l.points.map((p, i) => (
            <circle
              key={points[i].date}
              cx={p.cx}
              cy={p.cy}
              r={active === i ? 6 : 4}
              className="fill-[var(--primary)] stroke-[var(--surface)]"
              strokeWidth={2}
            />
          ))}
          {l.points.map((p, i) => (
            <rect
              key={points[i].date}
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
          className="pointer-events-none absolute z-10 w-32 rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lg"
          style={{
            left: Math.min(Math.max(activePos.cx < l.width / 2 ? activePos.cx + 12 : activePos.cx - 12 - 128, 0), l.width - 128),
            top: l.plot.top,
          }}
        >
          <p className="font-bold">{kg(activePoint.weight)}</p>
          <p className="text-muted">{formatDayMonth(activePoint.date)}</p>
        </div>
      )}
    </div>
  )
}

