import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { db } from '../../db/db'
import { getSettings } from '../../db/settings'
import { monthGrid, predictionDates, type GridDay } from '../../domain/calendar'
import { formatLong, formatMonthYear, today as todayISO, type ISODate } from '../../domain/dates'
import { periodDateSet } from '../../domain/periods'
import { t } from '../../i18n/es'
import { usePrediction } from '../../usePrediction'
import { DaySheet } from '../log/DaySheet'

interface DayState {
  isToday: boolean
  isFuture: boolean
  isPeriod: boolean
  isPredicted: boolean
  isFertile: boolean
  isOvulation: boolean
  isPossiblePeriod: boolean
  isPossibleFertile: boolean
  isLogged: boolean
}

export function CalendarScreen() {
  const [now] = useState(() => new Date())
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [selected, setSelected] = useState<ISODate | null>(null)
  const today = todayISO()
  const c = t.calendar

  const weeks = useMemo(() => monthGrid(ym.y, ym.m), [ym])
  const first = weeks[0][0].date
  const last = weeks.at(-1)!.at(-1)!.date

  const data = useLiveQuery(async () => {
    const [periods, loggedKeys] = await Promise.all([
      db.periods.toArray(),
      db.days.where('date').between(first, last, true, true).primaryKeys(),
    ])
    return { periodDays: periodDateSet(periods, today), logged: new Set(loggedKeys) }
  }, [first, last, today])

  const prediction = usePrediction()
  const mode = useLiveQuery(() => getSettings().then((s) => s.mode))
  // En embarazo y perimenopausia no se marcan periodos previstos ni ventana fértil.
  const predicted = useMemo(
    () => (prediction && mode === 'cycle' ? predictionDates(prediction) : undefined),
    [prediction, mode],
  )

  const stateOf = (date: ISODate): DayState => {
    const isPeriod = !!data?.periodDays.has(date)
    return {
      isToday: date === today,
      isFuture: date > today,
      isPeriod,
      // Lo registrado manda sobre lo previsto.
      isPredicted: !isPeriod && !!predicted?.predicted.has(date),
      isFertile: !isPeriod && !!predicted?.fertile.has(date),
      isOvulation: !isPeriod && !!predicted?.ovulation.has(date),
      isPossiblePeriod: !isPeriod && !!predicted?.possiblePeriod.has(date),
      isPossibleFertile: !isPeriod && !!predicted?.possibleFertile.has(date),
      isLogged: !!data?.logged.has(date),
    }
  }

  const shift = (delta: number) =>
    setYm(({ y, m }) => {
      const d = new Date(y, m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })

  const isCurrentMonth = ym.y === now.getFullYear() && ym.m === now.getMonth()

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold" aria-live="polite">
          {formatMonthYear(ym.y, ym.m)}
        </h1>
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}
              className="min-h-11 rounded-full px-3 text-sm font-bold text-primary hover:bg-surface-soft"
            >
              {c.today}
            </button>
          )}
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label={c.prev}
            className="grid size-11 place-items-center rounded-full hover:bg-surface-soft"
          >
            <Icon name="chevronLeft" />
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label={c.next}
            className="grid size-11 place-items-center rounded-full hover:bg-surface-soft"
          >
            <Icon name="chevronRight" />
          </button>
        </div>
      </header>

      <div className="mt-4 rounded-3xl bg-surface p-3 shadow-sm">
        <table className="w-full table-fixed border-separate border-spacing-y-1">
          <thead>
            <tr>
              {c.weekdays.map((d, i) => (
                <th key={i} scope="col" className="pb-1 text-xs font-bold text-muted">
                  <abbr title={c.weekdaysLong[i]} className="no-underline">
                    {d}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].date}>
                {week.map((gd) => (
                  <td key={gd.date} className="p-0.5">
                    <DayCell gd={gd} s={stateOf(gd.date)} onSelect={setSelected} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-center text-sm text-muted">{c.hint}</p>
      <Legend withMargin={!!predicted?.hasMargin} withPredictions={mode === 'cycle'} />

      {selected && <DaySheet date={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}

function DayCell({ gd, s, onSelect }: { gd: GridDay; s: DayState; onSelect: (d: ISODate) => void }) {
  const c = t.calendar
  const parts = [formatLong(gd.date)]
  if (s.isToday) parts.push(c.todayMark)
  if (s.isPeriod) parts.push(c.period)
  if (s.isPredicted) parts.push(c.predicted)
  if (s.isPossiblePeriod) parts.push(c.possiblePeriod)
  if (s.isOvulation) parts.push(c.ovulation)
  else if (s.isFertile) parts.push(c.fertile)
  else if (s.isPossibleFertile) parts.push(c.possibleFertile)
  if (s.isLogged) parts.push(c.logged)

  const look = s.isPeriod
    ? 'bg-primary text-on-primary'
    : s.isPredicted
      ? 'border-2 border-dashed border-primary text-ink'
      : s.isOvulation
        ? 'bg-accent text-surface'
        : s.isFertile
          ? 'bg-lavender-soft text-ink'
          : s.isPossiblePeriod
            ? 'border-2 border-dotted border-primary/60 text-ink'
            : s.isPossibleFertile
              ? 'border border-dotted border-accent/60 bg-lavender-soft/40 text-ink'
              : 'text-ink hover:bg-surface-soft'

  return (
    <button
      type="button"
      disabled={s.isFuture}
      onClick={() => onSelect(gd.date)}
      aria-label={parts.join(', ')}
      className={`relative mx-auto grid aspect-square w-full max-w-12 place-items-center rounded-full text-base font-bold transition
        ${gd.inMonth ? '' : 'opacity-40'} ${look}
        
        ${s.isToday ? 'outline-2 outline-offset-2 outline-ink' : ''}
        disabled:cursor-default`}
    >
      {gd.day}
      {s.isLogged && (
        <span
          aria-hidden="true"
          className={`absolute bottom-1 size-1.5 rounded-full ${s.isPeriod ? 'bg-on-primary' : s.isOvulation ? 'bg-surface' : 'bg-accent'}`}
        />
      )}
    </button>
  )
}

function Legend({ withMargin, withPredictions }: { withMargin: boolean; withPredictions: boolean }) {
  const c = t.calendar
  const item = (swatch: string, label: string) => (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className={`size-5 shrink-0 rounded-full ${swatch}`} />
      {label}
    </li>
  )
  return (
    <section aria-label={c.legend} className="mt-4 mb-4 rounded-2xl bg-surface p-4">
      <ul className="grid grid-cols-2 gap-3 text-sm">
        {item('bg-primary', c.period)}
        {withPredictions && item('border-2 border-dashed border-primary', c.predicted)}
        {withPredictions && item('bg-lavender-soft', c.fertile)}
        {withPredictions && item('bg-accent', c.ovulation)}
        {withMargin && item('border-2 border-dotted border-primary/60', c.possiblePeriod)}
        {withMargin && item('border border-dotted border-accent/60 bg-lavender-soft/40', c.possibleFertile)}
        {item('outline-2 outline-offset-1 outline-ink', c.todayMark)}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="grid size-5 place-items-center">
            <span className="size-2 rounded-full bg-accent" />
          </span>
          {c.logged}
        </li>
      </ul>
      {withPredictions ? (
        <p className="mt-3 text-xs text-muted">{c.estimatesNote}</p>
      ) : (
        <p className="mt-3 text-xs text-muted">{c.noPredictionsNote}</p>
      )}
      {withMargin && <p className="mt-1 text-xs text-muted">{c.marginNote}</p>}
    </section>
  )
}
