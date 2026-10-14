import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { getSettings } from '../../db/settings'
import { formatDayMonth, today } from '../../domain/dates'
import {
  CHART_CYCLES,
  completedCycles,
  cycleExtremes,
  symptomStats,
  type CycleRecord,
  type SymptomStat,
} from '../../domain/stats'
import { symptomLabel, t } from '../../i18n'
import { usePrediction } from '../../usePrediction'
import { CycleChart } from './CycleChart'
import { TemperatureCard } from './TemperatureCard'
import { temperatureCycles } from '../../domain/temperature'

const TOP_SYMPTOMS = 8

export function StatsScreen() {
  const p = usePrediction()
  const mode = useLiveQuery(() => getSettings().then((x) => x.mode))
  const data = useLiveQuery(async () => {
    const [periods, days] = await Promise.all([db.periods.toArray(), db.days.toArray()])
    return { periods, days }
  })
  const s = t.stats

  if (!p || !data) return null

  const cycles = completedCycles(data.periods).slice(-CHART_CYCLES)
  const extremes = cycleExtremes(cycles)
  const symptoms = symptomStats(data.days, data.periods, p.cycleLength, p.periodLength, today())
  const tempCycles = temperatureCycles(data.periods, data.days, today())

  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">{s.title}</h1>
        <a
          href="#/report"
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-bold text-primary"
        >
          {t.report.open}
        </a>
      </div>

      {p.isIrregular && mode !== 'perimenopause' && (
        <section
          role="note"
          aria-labelledby="irregular-title"
          className="rounded-3xl border border-line bg-rose-soft p-5"
        >
          <h2 id="irregular-title" className="font-extrabold">
            {s.irregularTitle}
          </h2>
          <p className="mt-1 text-sm">
            {s.irregularBody(Math.min(...p.recentCycles), Math.max(...p.recentCycles))}
          </p>
        </section>
      )}

      <dl className="grid grid-cols-2 gap-3">
        <Tile label={s.avgCycle} value={s.days(p.cycleLength)} />
        <Tile label={s.avgPeriod} value={s.days(p.periodLength)} />
        {extremes && (
          <>
            <Tile
              label={s.shortest}
              value={s.days(extremes.shortest.length)}
              note={s.startedOn(formatDayMonth(extremes.shortest.start))}
            />
            <Tile
              label={s.longest}
              value={s.days(extremes.longest.length)}
              note={s.startedOn(formatDayMonth(extremes.longest.start))}
            />
          </>
        )}
      </dl>

      {cycles.length ? (
        <ChartCard cycles={cycles} average={p.cycleLength} />
      ) : (
        <section className="rounded-3xl bg-surface p-5 text-center shadow-sm">
          <h2 className="font-extrabold">{s.empty}</h2>
          <p className="mt-1 text-sm text-muted">{s.emptyHint}</p>
        </section>
      )}

      {tempCycles.length > 0 && <TemperatureCard cycles={tempCycles} />}

      <Symptoms symptoms={symptoms.slice(0, TOP_SYMPTOMS)} />
    </main>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-3xl bg-surface p-4 shadow-sm">
      <dt className="text-sm font-bold text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold">{value}</dd>
      {note && <dd className="text-xs text-muted">{note}</dd>}
    </div>
  )
}

function ChartCard({ cycles, average }: { cycles: CycleRecord[]; average: number }) {
  const s = t.stats
  const lengths = cycles.map((c) => c.length)
  return (
    <section aria-labelledby="chart-title" className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id="chart-title" className="text-lg font-extrabold">
        {s.chartTitle}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-x-4 text-sm text-muted">
        <span>{s.lastN(cycles.length)}</span>
        <span className="flex items-center gap-2 font-bold text-ink">
          <span aria-hidden="true" className="w-5 border-t-2 border-dashed border-ink" />
          {s.average(average)}
        </span>
      </div>
      <figure className="mt-3">
        <CycleChart cycles={cycles} average={average} />
        <figcaption className="sr-only">
          {s.chartSummary(cycles.length, Math.min(...lengths), Math.max(...lengths), average)}
        </figcaption>
      </figure>
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-primary">
          {s.showTable}
        </summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 font-bold">{s.colStart}</th>
              <th scope="col" className="py-1 text-right font-bold">{s.colCycle}</th>
              <th scope="col" className="py-1 text-right font-bold">{s.colPeriod}</th>
            </tr>
          </thead>
          <tbody>
            {[...cycles].reverse().map((c) => (
              <tr key={c.start} className="border-t border-line">
                <td className="py-1.5">{formatDayMonth(c.start)}</td>
                <td className="py-1.5 text-right tabular-nums">{s.days(c.length)}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {c.periodLength === null ? '—' : s.days(c.periodLength)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}

function Symptoms({ symptoms }: { symptoms: SymptomStat[] }) {
  const s = t.stats
  const max = symptoms[0]?.count ?? 1
  return (
    <section aria-labelledby="symptoms-title" className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id="symptoms-title" className="text-lg font-extrabold">
        {s.symptomsTitle}
      </h2>
      {symptoms.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{s.symptomsEmpty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {symptoms.map((sym) => (
            <li key={sym.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold">{symptomLabel(sym.name)}</span>
                <span className="shrink-0 text-sm text-muted tabular-nums">{s.times(sym.count)}</span>
              </div>
              <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-surface-soft">
                <div
                  className="h-2 rounded-full bg-[var(--chart-bar)]"
                  style={{ width: `${(sym.count / max) * 100}%` }}
                />
              </div>
              {sym.timing && <p className="mt-1 text-xs font-bold">{s.timing(sym.timing.from, sym.timing.to)}</p>}
              {sym.topPhase && (
                <p className={`${sym.timing ? '' : 'mt-1 '}text-xs text-muted`}>{s.mostlyIn(s.phases[sym.topPhase])}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <details className="mt-4">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-primary">
          {s.phasesTitle}
        </summary>
        <ul className="mt-1 space-y-1 text-sm">
          {s.phasesHelp.map(([name, desc]) => (
            <li key={name}>
              <strong>{name}:</strong> {desc}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">{s.phasesNote}</p>
      </details>
    </section>
  )
}
