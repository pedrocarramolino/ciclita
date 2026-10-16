import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { addDays, formatLong, today } from '../../domain/dates'
import { t } from '../../i18n'
import { APPOINTMENT_EMOJI } from '../calendar/appointmentTypes'

/** Días por delante en los que la próxima cita aparece en el inicio. */
const SHOW_WITHIN_DAYS = 30

/** "Próxima cita: Ecografía · jueves, 22 de octubre, 10:30" (abre el calendario). */
export function NextAppointment() {
  const now = today()
  const next = useLiveQuery(async () => {
    const list = await db.appointments.where('date').between(now, addDays(now, SHOW_WITHIN_DAYS), true, true).toArray()
    return list.sort((x, y) => (x.date + (x.time ?? '')).localeCompare(y.date + (y.time ?? '')))[0] ?? null
  }, [now])
  if (!next) return null
  const a = t.appointments
  return (
    <a href="#/calendar" className="flex items-center gap-3 rounded-3xl bg-surface p-4 shadow-sm hover:bg-surface-soft">
      <span aria-hidden="true" className="text-3xl">
        {APPOINTMENT_EMOJI[next.type]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-bold text-muted uppercase">{a.homeNext}</span>
        <span className="block font-bold">
          {a.types[next.type]}
          {next.title ? ` · ${next.title}` : ''}
        </span>
        <span className="block text-sm">{a.when(formatLong(next.date), next.time)}</span>
      </span>
    </a>
  )
}
