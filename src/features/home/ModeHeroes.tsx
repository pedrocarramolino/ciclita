import { formatFullDate } from '../../domain/dates'
import type { PerimenopauseInfo, PregnancyInfo } from '../../domain/modes'
import type { Prediction } from '../../domain/prediction'
import { t } from '../../i18n'

/** Anillo de progreso sencillo (decorativo: el texto ya lo describe). */
function ProgressRing({ progress, center, color }: { progress: number; center: string; color: string }) {
  const R = 52
  const C = 2 * Math.PI * R
  return (
    <div aria-hidden="true" className="relative mx-auto size-40">
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-soft)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${progress * C} ${C}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-4xl font-extrabold">{center}</div>
    </div>
  )
}

export function PregnancyHero({ info }: { info: PregnancyInfo }) {
  const g = t.modes.pregnancy
  return (
    <section aria-live="polite" className="rounded-3xl bg-surface p-6 text-center shadow-sm">
      <ProgressRing progress={info.progress} center={g.weekShort(info.weeks + 1)} color="var(--lavender)" />
      <h1 className="mt-5 text-2xl leading-tight font-extrabold">{g.headline(info.weeks, info.days)}</h1>
      <p className="mt-2 font-semibold text-muted">{g.trimester(info.trimester)}</p>
      <p className="mt-3 text-sm">
        {g.dueDate(formatFullDate(info.dueDate))}
        <br />
        {info.daysLeft >= 0 ? g.daysLeft(info.daysLeft) : g.daysPast(-info.daysLeft)}
      </p>
    </section>
  )
}

export function PerimenopauseHero({ info, prediction }: { info: PerimenopauseInfo; prediction: Prediction }) {
  const g = t.modes.perimenopause
  const s = prediction.status
  const headline =
    s.kind === 'period'
      ? t.home.periodDay(s.day)
      : info.daysSinceLast === null
        ? t.home.noData
        : g.daysSince(info.daysSinceLast)
  return (
    <section aria-live="polite" className="rounded-3xl bg-surface p-6 text-center shadow-sm">
      <ProgressRing
        progress={info.daysSinceLast === null ? 0 : Math.min(1, info.daysSinceLast / 365)}
        center={info.daysSinceLast === null ? '·' : String(info.daysSinceLast)}
        color="var(--rose)"
      />
      <h1 className="mt-5 text-2xl leading-tight font-extrabold">{headline}</h1>
      {info.lastStart && <p className="mt-2 font-semibold text-muted">{g.periodsLastYear(info.periodsLastYear)}</p>}
      {info.twelveMonthsWithout && (
        <p role="note" className="mt-3 rounded-2xl bg-rose-soft px-3 py-2 text-sm">
          {g.twelveMonths}
        </p>
      )}
    </section>
  )
}
