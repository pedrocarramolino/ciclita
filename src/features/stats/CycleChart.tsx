import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { formatDayMonth, parseISODate } from '../../domain/dates'
import type { CycleRecord } from '../../domain/stats'
import { t } from '../../i18n/es'
import { useCssVars } from '../../useCssVars'

const VARS = ['chart-bar', 'border', 'text-muted', 'text'] as const
const monthShort = new Intl.DateTimeFormat('es', { month: 'short' })

/** Barras con la duración de cada ciclo y una línea de referencia en la media. */
export function CycleChart({ cycles, average }: { cycles: CycleRecord[]; average: number }) {
  const c = useCssVars(VARS)
  const data = cycles.map((cy) => ({
    ...cy,
    label: monthShort.format(parseISODate(cy.start)).replace('.', ''),
  }))
  const max = Math.max(...cycles.map((cy) => cy.length), average)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -24 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={c.border} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: c.border }}
          tick={{ fill: c['text-muted'], fontSize: 12 }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, Math.ceil((max + 4) / 5) * 5]}
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: c['text-muted'], fontSize: 12 }}
          width={48}
        />
        <Tooltip
          cursor={{ fill: c.border, opacity: 0.4 }}
          content={(props) => <ChartTooltip {...props} />}
        />
        <ReferenceLine y={average} stroke={c.text} strokeDasharray="4 4" />
        <Bar dataKey="length" fill={c['chart-bar']} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const cy = payload[0].payload as CycleRecord
  const s = t.stats
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="font-bold">{s.tooltipCycle(formatDayMonth(cy.start))}</p>
      <p>{s.days(cy.length)}</p>
      <p className="text-muted">{s.periodDays(cy.periodLength)}</p>
    </div>
  )
}
