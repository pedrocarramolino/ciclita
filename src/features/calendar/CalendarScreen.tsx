import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { db } from '../../db/db'
import { monthGrid, type GridDay } from '../../domain/calendar'
import { formatLong, formatMonthYear, today as todayISO, type ISODate } from '../../domain/dates'
import { periodDateSet } from '../../domain/periods'
import { t } from '../../i18n/es'
import { DaySheet } from '../log/DaySheet'

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
                    <DayCell
                      gd={gd}
                      isToday={gd.date === today}
                      isFuture={gd.date > today}
                      isPeriod={!!data?.periodDays.has(gd.date)}
                      isLogged={!!data?.logged.has(gd.date)}
                      onSelect={setSelected}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-center text-sm text-muted">{c.hint}</p>
      <Legend />

      {selected && <DaySheet date={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}

function DayCell({
  gd,
  isToday,
  isFuture,
  isPeriod,
  isLogged,
  onSelect,
}: {
  gd: GridDay
  isToday: boolean
  isFuture: boolean
  isPeriod: boolean
  isLogged: boolean
  onSelect: (d: ISODate) => void
}) {
  const c = t.calendar
  const parts = [formatLong(gd.date)]
  if (isToday) parts.push(c.todayMark)
  if (isPeriod) parts.push(c.period)
  if (isLogged) parts.push(c.logged)

  return (
    <button
      type="button"
      disabled={isFuture}
      onClick={() => onSelect(gd.date)}
      aria-label={parts.join(', ')}
      className={`relative mx-auto grid aspect-square w-full max-w-12 place-items-center rounded-full text-base font-bold transition
        ${gd.inMonth ? '' : 'opacity-40'}
        ${isPeriod ? 'bg-primary text-on-primary' : 'text-ink hover:bg-surface-soft'}
        ${isToday ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}
        disabled:cursor-default disabled:hover:bg-transparent`}
    >
      {gd.day}
      {isLogged && (
        <span
          aria-hidden="true"
          className={`absolute bottom-1 size-1.5 rounded-full ${isPeriod ? 'bg-on-primary' : 'bg-lavender'}`}
        />
      )}
    </button>
  )
}

function Legend() {
  const c = t.calendar
  return (
    <section aria-label={c.legend} className="mt-4 mb-4 rounded-2xl bg-surface p-4">
      <ul className="grid grid-cols-2 gap-3 text-sm">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-5 rounded-full bg-primary" />
          {c.period}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="grid size-5 place-items-center">
            <span className="size-2 rounded-full bg-lavender" />
          </span>
          {c.logged}
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="size-5 rounded-full ring-2 ring-ink" />
          {c.todayMark}
        </li>
      </ul>
    </section>
  )
}
