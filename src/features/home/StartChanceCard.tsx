import { formatDayMonth, formatRange, type ISODate } from '../../domain/dates'
import type { Prediction } from '../../domain/prediction'
import { startProbabilities } from '../../domain/startProbability'
import { lang, t } from '../../i18n'

const pct = (p: number) => `${Math.round(p * 100)} %`
/** "sáb 31 oct": corto para que quepa en una línea junto a la barra. */
const shortDay = (d: ISODate) =>
  new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(`${d}T12:00:00`))
    .replace(/[.,]/g, '')

/** Cada día posible de inicio del próximo periodo con su probabilidad. */
export function StartChanceCard({ p, today }: { p: Prediction; today: ISODate }) {
  const r = startProbabilities(p, today)
  if (!r) return null
  const s = t.startChance
  const max = r.mostLikely.probability
  const { likely } = r

  return (
    <section aria-labelledby="start-chance-title" className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id="start-chance-title" className="text-lg font-extrabold">
        {s.title}
      </h2>
      <p className="mt-1 font-semibold">{s.mostLikely(formatDayMonth(r.mostLikely.date), pct(r.mostLikely.probability))}</p>
      <p className="text-sm text-muted">
        {s.likely(pct(likely.probability), formatRange(likely.start, likely.end))}
      </p>
      <ul className="mt-3 space-y-1.5">
        {r.days.map((d) => (
          <li key={d.date} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 font-bold">{shortDay(d.date)}</span>
            <span aria-hidden="true" className="h-3 flex-1 overflow-hidden rounded-full bg-surface-soft">
              <span
                className={`block h-full rounded-full ${d.date === r.mostLikely.date ? 'bg-primary' : 'bg-rose'}`}
                style={{ width: `${(d.probability / max) * 100}%` }}
              />
            </span>
            <span className="w-11 shrink-0 text-right font-bold tabular-nums">{pct(d.probability)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{s.note(p.recentCycles.length)}</p>
    </section>
  )
}
