import { useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { endPeriod, restorePeriods, setPillTaken, startPeriod, undoPeriodEdit } from '../../db/repo'
import { useHashAction } from '../../useHashAction'
import { addDays, diffDays, formatDayMonth, formatLong, formatRange, today as todayISO } from '../../domain/dates'
import { MIN_HISTORY_ALONE, type Prediction, type Source } from '../../domain/prediction'
import { t } from '../../i18n'
import { usePrediction } from '../../usePrediction'
import { DaySheet } from '../log/DaySheet'
import { db, type Period } from '../../db/db'
import { UndoToast } from '../../components/UndoToast'
import { getSettings, setSettings } from '../../db/settings'
import { perimenopauseInfo, pregnancyInfo } from '../../domain/modes'
import { useLiveQuery } from 'dexie-react-hooks'
import { periodEndQuestion } from '../../domain/periods'
import { NextAppointment } from './NextAppointment'
import { RemindersWarning } from './RemindersWarning'
import { PillCard } from './PillCard'
import { PregnancyChanceBadge } from './PregnancyChanceBadge'
import { pregnancyChance, showsPregnancyChance } from '../../domain/fertility'
import { MissedPeriodPrompt, PeriodEndPrompt } from './PeriodPrompts'
import { PerimenopauseHero, PregnancyHero } from './ModeHeroes'
import { openCalendarAt } from '../calendar/calendarFocus'

/** Dirección del atajo "Registrar hoy" (manifest). */
export const LOG_TODAY_HASH = '#/log'
/** Dirección del botón "Ya la he tomado" de la notificación de la píldora (sw.ts). */
export const PILL_TAKEN_HASH = '#/pill-taken'
/** Dirección del botón "Ha empezado" de la notificación del periodo (sw.ts). */
export const PERIOD_STARTED_HASH = '#/period-started'

/** Días de retraso a partir de los que se sugiere un test de embarazo. */
const LATE_TEST_DAYS = 7

/** Última acción que se puede deshacer desde el aviso flotante. */
interface Undoable {
  message: string
  /** Sin `undo`, el aviso solo informa. */
  undo?: () => Promise<void>
}

export function Home() {
  const p = usePrediction()
  const today = todayISO()
  const periodLength = p?.periodLength
  const modeData = useLiveQuery(async () => {
    const [settings, periods] = await Promise.all([getSettings(), db.periods.toArray()])
    return {
      showChance: showsPregnancyChance(settings),
      mode: settings.mode,
      pregnancyStart: settings.pregnancyStart,
      periods,
      periodEnd: periodLength ? periodEndQuestion(periods, periodLength, today, settings.periodEndSnooze) : null,
    }
  }, [periodLength, today])
  const [undo, setUndo] = useState<Undoable | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const h = t.home
  const undoPeriods = (message: string) => (prev: Period[]) => setUndo({ message, undo: () => restorePeriods(prev) })

  // El atajo "Registrar hoy" del icono de la app abre el registro de hoy.
  useHashAction(LOG_TODAY_HASH, () => setLogOpen(true))
  // "Ha empezado" en la notificación del periodo: se marca el inicio hoy.
  useHashAction(PERIOD_STARTED_HASH, () => void startPeriod().then(undoPeriods(t.home.startedToast)))
  // "Ya la he tomado" en la notificación: se marca la píldora de hoy.
  useHashAction(PILL_TAKEN_HASH, () => {
    const day = todayISO()
    void setPillTaken(day, true).then(() =>
      setUndo({ message: t.pill.takenFromNotification, undo: () => setPillTaken(day, false) }),
    )
  })

  if (!p || !modeData) return null
  const s = p.status
  const inPeriod = s.kind === 'period'
  const ongoing = s.kind === 'period' && s.ongoing
  const mode = modeData.mode
  const chance = modeData.showChance ? pregnancyChance(today, p, today) : null
  const pregnancy = mode === 'pregnancy' && modeData.pregnancyStart ? pregnancyInfo(modeData.pregnancyStart, today) : null

  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-4">
      <p className="text-sm font-bold text-muted">{h.todayIs(formatLong(today))}</p>

      {pregnancy && <PregnancyHero info={pregnancy} />}
      {mode === 'perimenopause' && <PerimenopauseHero info={perimenopauseInfo(modeData.periods, today)} prediction={p} />}

      {mode === 'cycle' && (
      <section aria-live="polite" className="rounded-3xl bg-surface p-6 text-center shadow-sm">
        <CycleRing p={p} />
        <h1 className="mt-5 text-2xl leading-tight font-extrabold">{headline(p)}</h1>
        {s.kind === 'noData' && <p className="mt-2 text-muted">{h.noDataHint}</p>}
        {s.kind === 'upcoming' && p.nextPeriods[0]?.margin > 0 && (
          <p className="mt-2 text-sm font-semibold">
            {h.between(formatDayMonth(p.nextPeriods[0].earliestStart), formatDayMonth(p.nextPeriods[0].latestStart))}
          </p>
        )}
        {(s.kind === 'upcoming' || s.kind === 'late') && (
          <p className="mt-2 font-semibold text-muted">{h.cycleDay(s.cycleDay)}</p>
        )}
        {chance ? (
          <div className="mt-3">
            <PregnancyChanceBadge chance={chance} today />
            <p className="mt-1 text-xs text-muted">{t.chance.note}</p>
          </div>
        ) : (
          s.kind === 'upcoming' &&
          s.inFertileWindow && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-lavender-soft px-3 py-1 text-sm font-bold">
              <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
              {h.fertile}
            </p>
          )
        )}
        {s.kind === 'late' && <p className="mt-3 text-sm text-muted">{h.lateHint}</p>}
        {s.kind === 'late' && s.daysLate >= LATE_TEST_DAYS && (
          <div className="mt-3 rounded-2xl bg-surface-soft p-3 text-left text-sm">
            <p>{h.lateTest}</p>
            <Button
              variant="secondary"
              className="mt-2 w-full"
              onClick={() =>
                void setSettings({ mode: 'pregnancy', pregnancyStart: p.lastStart }).then(() =>
                  setUndo({ message: h.pregnancyOn, undo: () => setSettings({ mode: 'cycle' }) }),
                )
              }
            >
              {h.toPregnancy}
            </Button>
          </div>
        )}
      </section>
      )}

      <RemindersWarning prediction={p} />

      {/* Una sola pregunta a la vez, la más importante; las demás salen después. */}
      {mode !== 'pregnancy' && modeData.periodEnd ? (
        <PeriodEndPrompt question={modeData.periodEnd} today={today} onEnded={undoPeriods(h.endedToast)} />
      ) : mode === 'cycle' && p.suspectedMissed.length ? (
        <MissedPeriodPrompt prediction={p} />
      ) : null}

      <div className="grid gap-3">
        {mode === 'pregnancy' ? null : ongoing ? (
          <Button className="min-h-16 w-full text-lg" onClick={() => void endPeriod().then(undoPeriods(h.endedToast))}>
            {h.ended}
          </Button>
        ) : (
          !inPeriod && (
            <Button
              className="min-h-16 w-full text-lg"
              onClick={() => void startPeriod().then(undoPeriods(h.startedToast))}
            >
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

      <NextAppointment />
      {mode !== 'pregnancy' && <PillCard />}

      {mode === 'cycle' && p.nextPeriods.length > 0 && <Upcoming p={p} />}
      {mode !== 'pregnancy' && <CycleSummary p={p} />}

      <p role="note" className="rounded-2xl bg-lavender-soft px-4 py-3 text-sm">
        <span aria-hidden="true">ⓘ </span>
        {mode === 'pregnancy' ? t.modes.pregnancy.note : mode === 'perimenopause' ? t.modes.perimenopause.note : h.estimates}
        {mode === 'cycle' && p.stale && <> {h.stale}</>}
      </p>

      {logOpen && (
        <DaySheet
          date={today}
          onClose={() => setLogOpen(false)}
          onCleared={(u) => setUndo({ message: t.log.cleared, undo: () => undoPeriodEdit(u) })}
        />
      )}
      {undo && (
        <UndoToast
          message={undo.message}
          onClose={() => setUndo(null)}
          onUndo={
            undo.undo &&
            (() => {
              setUndo(null)
              void undo.undo?.()
            })
          }
        />
      )}
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
          <li key={r.start} className="rounded-2xl bg-rose-soft px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold">{formatRange(r.start, r.end)}</span>
              <span className="shrink-0 text-sm text-muted">{h.inDays(diffDays(today, r.start))}</span>
            </div>
            {r.margin > 0 && (
              <p className="mt-0.5 text-xs text-muted">{h.startWindow(formatDayMonth(r.earliestStart), formatDayMonth(r.latestStart), r.margin)}</p>
            )}
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
          {(nextFertile.possibleStart !== nextFertile.start || nextFertile.possibleEnd !== nextFertile.end) && (
            <p className="mt-1 px-1 text-xs text-muted">
              {h.fertileWindowWide(formatRange(nextFertile.possibleStart, nextFertile.possibleEnd))}
            </p>
          )}
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
      : s === 'mixed'
        ? isPeriod
          ? h.source.mixedPeriod(p.periodPrior)
          : h.source.mixed(p.recentCycles.length, p.cyclePrior)
        : h.source[s]
  // Con pocos ciclos la previsión depende mucho de cada uno: se invita a añadir los
  // anteriores (el calendario se abre en "Editar periodos", un mes antes del primero).
  const fewCycles = !!p.lastStart && p.cycleSource !== 'user' && p.recentCycles.length < MIN_HISTORY_ALONE
  const firstKnown = p.lastStart
    ? addDays(p.lastStart, -p.recentCycles.reduce((a, b) => a + b, 0) - 20)
    : null
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
      {fewCycles && firstKnown && (
        <div className="mt-3 rounded-2xl bg-lavender-soft p-4 text-sm">
          <p>{h.fewCycles}</p>
          <Button variant="secondary" className="mt-3 w-full" onClick={() => openCalendarAt(firstKnown, { edit: true })}>
            {h.addEarlier}
          </Button>
        </div>
      )}
    </section>
  )
}
