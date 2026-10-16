import type { Appointment } from '../../db/db'
import { formatLong, today } from '../../domain/dates'
import { t } from '../../i18n'
import { APPOINTMENT_EMOJI } from './appointmentTypes'

/** Citas médicas del calendario: las próximas a la vista y las anteriores plegadas. */
export function AppointmentList({
  appointments,
  onOpen,
}: {
  appointments: Appointment[]
  onOpen: (a: Appointment) => void
}) {
  const a = t.appointments
  const now = today()
  const upcoming = appointments.filter((x) => x.date >= now).sort((x, y) => (x.date + (x.time ?? '')).localeCompare(y.date + (y.time ?? '')))
  const past = appointments.filter((x) => x.date < now).sort((x, y) => y.date.localeCompare(x.date))

  return (
    <section aria-labelledby="appointments-title" className="mt-4 rounded-2xl bg-surface p-4">
      <h2 id="appointments-title" className="font-extrabold">
        {a.section}
      </h2>
      {upcoming.length ? (
        <ul className="mt-3 space-y-2">
          {upcoming.map((x) => (
            <Item key={x.id} appointment={x} onOpen={onOpen} />
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">{a.none}</p>
      )}
      {past.length > 0 && (
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">
            {a.past} ({past.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {past.map((x) => (
              <Item key={x.id} appointment={x} onOpen={onOpen} />
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

function Item({ appointment: x, onOpen }: { appointment: Appointment; onOpen: (a: Appointment) => void }) {
  const a = t.appointments
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(x)}
        className="flex w-full items-center gap-3 rounded-2xl bg-surface-soft px-3 py-3 text-left"
      >
        <span aria-hidden="true" className="text-2xl">
          {APPOINTMENT_EMOJI[x.type]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">
            {a.types[x.type]}
            {x.title ? ` · ${x.title}` : ''}
          </span>
          <span className="block text-sm text-muted">{a.when(formatLong(x.date), x.time)}</span>
          {(x.place || x.notes) && (
            <span className="block truncate text-sm text-muted">
              {[x.place, x.notes ? a.hasNotes : null].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        {x.reminder && (
          <span aria-hidden="true" title={a.remind}>
            🔔
          </span>
        )}
      </button>
    </li>
  )
}
