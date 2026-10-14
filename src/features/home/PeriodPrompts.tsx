import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { Button } from '../../components/Button'
import { db, type Period } from '../../db/db'
import { endPeriod } from '../../db/repo'
import { getSettings, setSettings } from '../../db/settings'
import { addDays, formatDayMonth, type ISODate } from '../../domain/dates'
import { periodEndQuestion } from '../../domain/periods'
import type { Prediction } from '../../domain/prediction'
import { t } from '../../i18n'
import { openCalendarAt } from '../calendar/calendarFocus'

/** Tiempo que se deja de preguntar tras "Todavía no". */
const SNOOZE_DAYS = 2

/**
 * "¿Ha terminado tu periodo?": si el periodo en curso ya dura más de lo habitual,
 * probablemente se olvidó marcar el final. `onEnded` recibe los periodos de antes
 * (para poder deshacer).
 */
export function PeriodEndPrompt({
  periodLength,
  today,
  onEnded,
}: {
  periodLength: number
  today: ISODate
  onEnded: (prev: Period[]) => void
}) {
  const [picking, setPicking] = useState(false)
  const inputId = useId()
  const q = useLiveQuery(async () => {
    const [periods, settings] = await Promise.all([db.periods.toArray(), getSettings()])
    return periodEndQuestion(periods, periodLength, today, settings.periodEndSnooze)
  }, [periodLength, today])
  const [day, setDay] = useState<ISODate | null>(null)
  const p = t.periodEnd

  if (!q) return null
  const yesterday = addDays(today, -1)
  const end = (date: ISODate) => void endPeriod(date).then(onEnded)

  return (
    <section aria-labelledby="period-end" className="rounded-3xl border-2 border-primary/40 bg-surface p-5 shadow-sm">
      <h2 id="period-end" className="text-lg font-extrabold">
        {p.title}
      </h2>
      <p className="mt-1 text-sm">{p.body(q.days)}</p>
      {picking ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            end(day ?? q.lastPossible)
          }}
        >
          <label htmlFor={inputId} className="block text-sm font-bold">
            {p.pickLabel}
          </label>
          <input
            id={inputId}
            type="date"
            min={q.start}
            max={q.lastPossible}
            value={day ?? q.lastPossible}
            onChange={(e) => e.target.value && setDay(e.target.value)}
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
          />
          <Button type="submit" className="w-full">
            {p.save}
          </Button>
        </form>
      ) : (
        <div className="mt-3 grid gap-2">
          {yesterday <= q.lastPossible && <Button onClick={() => end(yesterday)}>{p.yesterday}</Button>}
          <Button variant="secondary" onClick={() => setPicking(true)}>
            {p.pick}
          </Button>
        </div>
      )}
      <Button
        variant="ghost"
        className="mt-2 w-full"
        onClick={() => void setSettings({ periodEndSnooze: { start: q.start, until: addDays(today, SNOOZE_DAYS) } })}
      >
        {p.notYet}
      </Button>
    </section>
  )
}

/** "¿Se te olvidó registrar un periodo?": el ciclo largo más reciente de la previsión. */
export function MissedPeriodPrompt({ prediction }: { prediction: Prediction }) {
  const missed = prediction.suspectedMissed.at(-1)
  const m = t.missedPeriod
  if (!missed) return null
  return (
    <section aria-labelledby="missed-period" className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id="missed-period" className="text-lg font-extrabold">
        {m.title}
      </h2>
      <p className="mt-1 text-sm">{m.body(formatDayMonth(missed.start), formatDayMonth(missed.end), missed.length)}</p>
      <div className="mt-3 grid gap-2">
        {/* Se abre el calendario en el mes en medio del ciclo, donde estaría el periodo. */}
        <Button variant="secondary" onClick={() => openCalendarAt(addDays(missed.start, Math.round(missed.length / 2)))}>
          {m.calendar}
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            const { confirmedLongCycles } = await getSettings()
            await setSettings({ confirmedLongCycles: [...confirmedLongCycles, missed.start] })
          }}
        >
          {m.confirm}
        </Button>
      </div>
    </section>
  )
}
