import type { DayLog } from '../../db/db'
import { pressureSummary, type PressureReading } from '../../domain/bloodPressure'
import { formatDayMonth, formatFullDate, type ISODate } from '../../domain/dates'
import { formatBloodPressure } from '../../domain/options'
import { t } from '../../i18n'

const pressure = (r: PressureReading) => formatBloodPressure(r) || '—'
const pulse = (n?: number | null) => (n === undefined || n === null ? '—' : `${n} ${t.log.pulseUnit}`)

/** Tensión arterial y pulso: la última toma, las medias del último mes y todas las tomas. */
export function BloodPressureCard({ days, today }: { days: DayLog[]; today: ISODate }) {
  const sum = pressureSummary(days, today)
  if (!sum) return null
  const s = t.stats.pressure
  const { last, recent } = sum
  const avgPressure =
    recent.systolic !== null && recent.diastolic !== null ? `${recent.systolic}/${recent.diastolic}` : '—'

  return (
    <section aria-labelledby="pressure-title" className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id="pressure-title" className="text-lg font-extrabold">
        {s.title}
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface-soft p-3">
          <dt className="text-xs font-bold text-muted">{s.last}</dt>
          <dd className="text-2xl font-extrabold">{pressure(last)}</dd>
          <dd className="text-xs text-muted">
            {last.pulse !== undefined && `${pulse(last.pulse)} · `}
            {formatDayMonth(last.date)}
          </dd>
        </div>
        <div className="rounded-2xl bg-surface-soft p-3">
          <dt className="text-xs font-bold text-muted">{s.average}</dt>
          <dd className="text-2xl font-extrabold">{avgPressure}</dd>
          <dd className="text-xs text-muted">
            {recent.pulse !== null && `${pulse(recent.pulse)} · `}
            {s.readings(recent.count)}
          </dd>
        </div>
      </dl>
      {sum.high && <p className="mt-3 rounded-2xl bg-rose-soft px-4 py-3 text-sm">{s.high}</p>}

      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-primary">{t.stats.showTable}</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th scope="col" className="py-1 font-bold">{s.colDate}</th>
              <th scope="col" className="py-1 text-right font-bold">{s.colPressure}</th>
              <th scope="col" className="py-1 text-right font-bold">{s.colPulse}</th>
            </tr>
          </thead>
          <tbody>
            {sum.readings.map((r) => (
              <tr key={r.date} className="border-t border-line">
                <td className="py-1.5">{formatFullDate(r.date)}</td>
                <td className="py-1.5 text-right tabular-nums">{pressure(r)}</td>
                <td className="py-1.5 text-right tabular-nums">{pulse(r.pulse)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
