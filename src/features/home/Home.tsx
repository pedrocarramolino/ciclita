import { useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { endPeriod, startPeriod } from '../../db/repo'
import { diffDays, formatLong, formatRange, today as todayISO } from '../../domain/dates'
import type { Prediction, Source } from '../../domain/prediction'
import { t } from '../../i18n/es'
import { usePrediction } from '../../usePrediction'
import { DaySheet } from '../log/DaySheet'

export function Home() {
  const p = usePrediction()
  const [logOpen, setLogOpen] = useState(false)
  const today = todayISO()
  const h = t.home

  if (!p) return null
  const s = p.status
  const inPeriod = s.kind === 'period'
  const ongoing = s.kind === 'period' && s.ongoing

  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-4">
      <p className="text-sm font-bold text-muted">{h.todayIs(formatLong(today).toLowerCase())}</p>

      <section aria-live="polite" className="rounded-3xl bg-surface p-6 text-center shadow-sm">
        <CycleRing p={p} />
        <h1 className="mt-5 text-2xl leading-tight font-extrabold">{headline(p)}</h1>
        {s.kind === 'noData' && <p className="mt-2 text-muted">{h.noDataHint}</p>}
        {(s.kind === 'upcoming' || s.kind === 'late') && (
          <p className="mt-2 font-semibold text-muted">{h.cycleDay(s.cycleDay)}</p>
        )}
        {s.kind === 'upcoming' && s.inFertileWindow && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-lavender-soft px-3 py-1 text-sm font-bold">
            <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
            {h.fertile}
          </p>
        )}
        {s.kind === 'late' && <p className="mt-3 text-sm text-muted">{h.lateHint}</p>}
      </section>

      <div className="grid gap-3">
        {ongoing ? (
          <Button className="min-h-16 w-full text-lg" onClick={() => void endPeriod()}>
            {h.ended}
          </Button>
        ) : (
          !inPeriod && (
            <Button className="min-h-16 w-full text-lg" onClick={() => void startPeriod()}>
              <Icon name="drop" />
              {h.started}
            </Button>
          )
        )}
        <Button variant="secondary" className="w-full" onClick={() => setLogOpen(true)}>
          <Icon name="plus" />
          {h.logToday}
        </Button>
      </div>

      {p.nextPeriods.length > 0 && <Upcoming p={p} />}
      <CycleSummary p={p} />

      <p role="note" className="rounded-2xl bg-lavender-soft px-4 py-3 text-sm">
        <span aria-hidden="true">ⓘ </span>
        {h.estimates}
        {p.stale && <> {h.stale}</>}
      </p>

      {logOpen && <DaySheet date={today} onClose={() => setLogOpen(false)} />}
    </main>
  )
}

function headline(p: Prediction): string {
  const s = p.status
  switch (s.kind) {
    case 'noData':
      return t.home.noData
    case 'period':
      return t.home.periodDay(s.day)
    case 'late':
      return t.home.late(s.daysLate)
    case 'upcoming':
      return t.home.startsIn(s.daysUntil)
  }
}

/** Anillo con el progreso del ciclo actual. Decorativo: el texto ya lo describe. */
function CycleRing({ p }: { p: Prediction }) {
  const s = p.status
  const R = 52
  const C = 2 * Math.PI * R
  let progress = 0
  let center = '·'
  if (s.kind === 'period') {
    progress = Math.min(1, s.day / p.cycleLength)
    center = String(s.day)
  } else if (s.kind === 'upcoming' || s.kind === 'late') {
    progress = Math.min(1, s.cycleDay / p.cycleLength)
    center = s.kind === 'late' ? `+${s.daysLate}` : String(s.daysUntil)
  }
  const color = s.kind === 'period' ? 'var(--primary)' : s.kind === 'late' ? 'var(--rose)' : 'var(--lavender)'

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
      <div className="absolute inset-0 grid place-items-center">
        <div>
          <div className="text-5xl font-extrabold">{center}</div>
          {s.kind === 'upcoming' && <div className="text-sm font-bold text-muted">{t.common.days}</div>}
        </div>
      </div>
    </div>
  )
}

function Upcoming({ p }: { p: Prediction }) {
  const h = t.home
  const today = todayISO()
  const nextFertile = p.fertileWindows.find((w) => w.end >= today)
  return (
    <section aria-labelledby="upcoming-title" className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id="upcoming-title" className="text-lg font-extrabold">
        {h.upcoming}
      </h2>
      <ul className="mt-3 space-y-2">
        {p.nextPeriods.map((r) => (
          <li key={r.start} className="flex items-center justify-between gap-3 rounded-2xl bg-rose-soft px-4 py-3">
            <span className="font-bold">{formatRange(r.start, r.end)}</span>
            <span className="shrink-0 text-sm text-muted">{h.inDays(diffDays(today, r.start))}</span>
          </li>
        ))}
      </ul>
      {nextFertile && (
        <>
          <h3 className="mt-4 font-bold">{h.fertileNext}</h3>
          <p className="mt-2 flex items-center justify-between gap-3 rounded-2xl bg-lavender-soft px-4 py-3">
            <span className="font-bold">
              {formatRange(nextFertile.start, nextFertile.end)}
            </span>
            <span className="shrink-0 text-sm text-muted">{h.inDays(diffDays(today, nextFertile.start))}</span>
          </p>
        </>
      )}
    </section>
  )
}

function CycleSummary({ p }: { p: Prediction }) {
  const h = t.home
  const src = (s: Source, isPeriod: boolean) =>
    s === 'history'
      ? isPeriod
        ? h.source.historyPeriod
        : h.source.history(p.recentCycles.length)
      : h.source[s]
  return (
    <section aria-labelledby="cycle-title" className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id="cycle-title" className="text-lg font-extrabold">
        {h.yourCycle}
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface-soft p-4">
          <dt className="text-sm font-bold text-muted">{h.avgCycle}</dt>
          <dd className="text-3xl font-extrabold">
            {p.cycleLength} <span className="text-base font-bold">{t.common.days}</span>
          </dd>
          <dd className="mt-1 text-xs text-muted">{src(p.cycleSource, false)}</dd>
        </div>
        <div className="rounded-2xl bg-surface-soft p-4">
          <dt className="text-sm font-bold text-muted">{h.avgPeriod}</dt>
          <dd className="text-3xl font-extrabold">
            {p.periodLength} <span className="text-base font-bold">{t.common.days}</span>
          </dd>
          <dd className="mt-1 text-xs text-muted">{src(p.periodSource, true)}</dd>
        </div>
      </dl>
    </section>
  )
}
