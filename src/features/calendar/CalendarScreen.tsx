import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { db, type Appointment } from '../../db/db'
import { markPeriodRange, undoPeriodEdit, unmarkPeriodDay, type PeriodEditUndo } from '../../db/repo'
import { getSettings } from '../../db/settings'
import { monthGrid, predictionDates, type GridDay } from '../../domain/calendar'
import { diffDays, formatDayMonth, formatLong, formatMonthYear, today as todayISO, type ISODate } from '../../domain/dates'
import { MAX_ONGOING_DAYS, periodDateSet } from '../../domain/periods'
import { missedPillDates } from '../../domain/pill'
import { clearCalendarFocus, peekCalendarFocus } from './calendarFocus'
import { t } from '../../i18n'
import { usePrediction } from '../../usePrediction'
import { DaySheet } from '../log/DaySheet'
import { AppointmentList } from './AppointmentList'
import { AppointmentSheet } from './AppointmentSheet'

interface DayState {
  isToday: boolean
  isFuture: boolean
  isPeriod: boolean
  isPredicted: boolean
  isFertile: boolean
  isOvulation: boolean
  isPossiblePeriod: boolean
  isLogged: boolean
  pillMissed: boolean
  /** Primer día elegido al marcar un tramo en "Editar periodos". */
  isAnchor: boolean
  /** Hay alguna cita médica ese día. */
  hasAppointment: boolean
}

/** Tramo más largo que se puede marcar de una vez (evita marcar meses por un toque equivocado). */
const MAX_RANGE_DAYS = MAX_ONGOING_DAYS

export function CalendarScreen() {
  const [now] = useState(() => new Date())
  const [ym, setYm] = useState(() => {
    const f = peekCalendarFocus()
    return f ? { y: f.y, m: f.m } : { y: now.getFullYear(), m: now.getMonth() }
  })
  const [editing, setEditing] = useState(() => !!peekCalendarFocus()?.edit)
  useEffect(clearCalendarFocus, [])
  const [selected, setSelected] = useState<ISODate | null>(null)
  // "Editar periodos": primer día elegido, resultado del último cambio y cómo deshacerlo.
  const [anchor, setAnchor] = useState<ISODate | null>(null)
  const [editMsg, setEditMsg] = useState('')
  const [undo, setUndo] = useState<PeriodEditUndo | null>(null)
  // Cita médica abierta (nueva si `appointment` no está).
  const [sheet, setSheet] = useState<{ appointment?: Appointment } | null>(null)
  const appointments = useLiveQuery(() => db.appointments.toArray())
  const appointmentDays = useMemo(() => new Set((appointments ?? []).map((x) => x.date)), [appointments])
  const today = todayISO()
  const c = t.calendar

  const weeks = useMemo(() => monthGrid(ym.y, ym.m), [ym])
  const first = weeks[0][0].date
  const last = weeks.at(-1)!.at(-1)!.date

  const data = useLiveQuery(async () => {
    const [periods, days, settings] = await Promise.all([
      db.periods.toArray(),
      db.days.where('date').between(first, last, true, true).toArray(),
      getSettings(),
    ])
    const pill = settings.tracking.pill && settings.pill.start ? { pack: settings.pill.pack, start: settings.pill.start } : null
    return {
      periodDays: periodDateSet(periods, today),
      logged: new Set(days.map((d) => d.date)),
      pillMissed: pill ? missedPillDates(days, pill, first, last, today) : null,
    }
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
      isLogged: !!data?.logged.has(date),
      pillMissed: !!data?.pillMissed?.has(date),
      isAnchor: editing && date === anchor,
      hasAppointment: appointmentDays.has(date),
    }
  }

  const e = c.edit
  /**
   * En "Editar periodos": el primer toque elige el inicio y el segundo marca todo el
   * tramo; tocar un día ya marcado (sin inicio elegido) lo quita.
   */
  const editTap = async (date: ISODate) => {
    if (anchor) {
      const n = Math.abs(diffDays(anchor, date)) + 1
      if (n > MAX_RANGE_DAYS) return setEditMsg(e.tooLong(n, MAX_RANGE_DAYS))
      const [from, to] = anchor <= date ? [anchor, date] : [date, anchor]
      setUndo(await markPeriodRange(from, to))
      setAnchor(null)
      setEditMsg(from === to ? e.markedOne(formatDayMonth(from)) : e.marked(formatDayMonth(from), formatDayMonth(to), n))
    } else if (data?.periodDays.has(date)) {
      setUndo(await unmarkPeriodDay(date))
      setEditMsg(e.removed(formatDayMonth(date)))
    } else {
      setAnchor(date)
      setEditMsg('')
    }
  }

  const stopEditing = () => {
    setEditing(false)
    setAnchor(null)
    setUndo(null)
    setEditMsg('')
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
          <a
            href="#/search"
            aria-label={t.search.open}
            title={t.search.open}
            className="grid size-11 place-items-center rounded-full hover:bg-surface-soft"
          >
            <Icon name="search" />
          </a>
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

      {editing && (
        <section aria-labelledby="edit-periods" className="mt-4 rounded-3xl border-2 border-primary/40 bg-surface p-4 shadow-sm">
          <h2 id="edit-periods" className="font-extrabold">
            {e.title}
          </h2>
          <p className="mt-1 text-sm" aria-live="polite">
            {anchor ? e.pickEnd(formatDayMonth(anchor)) : e.pickStart}
          </p>
          <p role="status" className="mt-1 text-sm font-bold empty:hidden">
            {editMsg}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="flex-1" onClick={stopEditing}>
              <Icon name="check" />
              {e.done}
            </Button>
            {anchor && (
              <Button variant="secondary" onClick={() => setAnchor(null)}>
                {t.confirm.cancel}
              </Button>
            )}
            {undo && !anchor && (
              <Button
                variant="secondary"
                onClick={async () => {
                  await undoPeriodEdit(undo)
                  setUndo(null)
                  setEditMsg(e.undone)
                }}
              >
                {e.undo}
              </Button>
            )}
          </div>
        </section>
      )}

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
                    <DayCell gd={gd} s={stateOf(gd.date)} onSelect={editing ? (d) => void editTap(d) : setSelected} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!editing && (
        <>
          <p className="mt-3 text-center text-sm text-muted">{c.hint}</p>
          <div className="mt-3 grid gap-2">
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Icon name="drop" />
              {e.open}
            </Button>
            <Button variant="secondary" onClick={() => setSheet({})}>
              <Icon name="plus" />
              {t.appointments.add}
            </Button>
          </div>
          <AppointmentList appointments={appointments ?? []} onOpen={(appointment) => setSheet({ appointment })} />
        </>
      )}
      <Legend
        withMargin={!!predicted?.hasMargin}
        withPredictions={mode === 'cycle'}
        withPill={!!data?.pillMissed}
        withAppointments={appointmentDays.size > 0}
      />
      {sheet && (
        <AppointmentSheet
          appointment={sheet.appointment}
          defaultDate={today}
          defaultType={mode === 'pregnancy' ? 'ultrasound' : 'gynecology'}
          onClose={() => setSheet(null)}
        />
      )}

      {selected && <DaySheet date={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}

/** Ventana fértil: flor cerrada; ovulación: flor abierta. */
const FLOWER_CLOSED = '🌷'
const FLOWER_OPEN = '🌸'

function DayCell({ gd, s, onSelect }: { gd: GridDay; s: DayState; onSelect: (d: ISODate) => void }) {
  const c = t.calendar
  const parts = [formatLong(gd.date)]
  if (s.isToday) parts.push(c.todayMark)
  if (s.isPeriod) parts.push(c.period)
  if (s.isPredicted) parts.push(c.predicted)
  if (s.isPossiblePeriod) parts.push(c.possiblePeriod)
  if (s.isOvulation) parts.push(c.ovulation)
  else if (s.isFertile) parts.push(c.fertile)
  if (s.isLogged) parts.push(c.logged)
  if (s.pillMissed) parts.push(t.pill.calendarMissed)
  if (s.isAnchor) parts.push(c.edit.anchor)
  if (s.hasAppointment) parts.push(t.appointments.mark)

  // La ventana fértil y la ovulación se marcan con una flor (cerrada / abierta), sin fondo.
  const look = s.isPeriod
    ? 'bg-primary text-on-primary'
    : s.isPredicted
      ? 'border-2 border-dashed border-primary text-ink'
      : s.isPossiblePeriod
        ? 'border-2 border-dotted border-primary/60 text-ink'
        : // Días de otro mes: gris del tema (no transparencia, que no llega al contraste AA).
          gd.inMonth
          ? 'text-ink hover:bg-surface-soft'
          : 'font-semibold text-muted hover:bg-surface-soft'
  const flower = s.isOvulation ? FLOWER_OPEN : s.isFertile ? FLOWER_CLOSED : null

  return (
    <button
      type="button"
      disabled={s.isFuture}
      onClick={() => onSelect(gd.date)}
      aria-label={parts.join(', ')}
      className={`relative mx-auto grid aspect-square w-full max-w-12 place-items-center rounded-full text-base font-bold transition
        ${look}
        
        ${s.isToday ? 'outline-2 outline-offset-2 outline-ink' : ''}
        ${s.isAnchor ? 'bg-primary-soft text-ink ring-3 ring-primary' : ''}
        disabled:cursor-default`}
    >
      {gd.day}
      {flower && (
        <span aria-hidden="true" className="absolute -right-1 -bottom-1 text-sm leading-none">
          {flower}
        </span>
      )}
      {s.hasAppointment && (
        <span aria-hidden="true" className="absolute -top-1 -left-1 text-xs leading-none">
          🩺
        </span>
      )}
      {s.pillMissed && (
        <span aria-hidden="true" className="absolute top-0.5 right-0.5 size-2.5 rounded-full border-2 border-danger bg-surface" />
      )}
      {s.isLogged && (
        <span
          aria-hidden="true"
          className={`absolute bottom-1 size-1.5 rounded-full ${s.isPeriod ? 'bg-on-primary' : 'bg-accent'}`}
        />
      )}
    </button>
  )
}

function Legend({
  withMargin,
  withPredictions,
  withPill,
  withAppointments,
}: {
  withMargin: boolean
  withPredictions: boolean
  withPill: boolean
  withAppointments: boolean
}) {
  const c = t.calendar
  const item = (swatch: string, label: string) => (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className={`size-5 shrink-0 rounded-full ${swatch}`} />
      {label}
    </li>
  )
  const emojiItem = (emoji: string, label: string) => (
    <li className="flex items-center gap-2">
      <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center text-base leading-none">
        {emoji}
      </span>
      {label}
    </li>
  )
  return (
    <section aria-label={c.legend} className="mt-4 mb-4 rounded-2xl bg-surface p-4">
      <ul className="grid grid-cols-2 gap-3 text-sm">
        {item('bg-primary', c.period)}
        {withPredictions && item('border-2 border-dashed border-primary', c.predicted)}
        {withPredictions && emojiItem(FLOWER_CLOSED, c.fertile)}
        {withPredictions && emojiItem(FLOWER_OPEN, c.ovulation)}
        {withMargin && item('border-2 border-dotted border-primary/60', c.possiblePeriod)}
        {item('outline-2 outline-offset-1 outline-ink', c.todayMark)}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="grid size-5 place-items-center">
            <span className="size-2 rounded-full bg-accent" />
          </span>
          {c.logged}
        </li>
        {withAppointments && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="grid size-5 place-items-center text-sm">
              🩺
            </span>
            {t.appointments.legend}
          </li>
        )}
        {withPill && (
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="grid size-5 place-items-center">
              <span className="size-2.5 rounded-full border-2 border-danger bg-surface" />
            </span>
            {t.pill.calendarMissed}
          </li>
        )}
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
