import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Switch } from '../../components/Switch'
import { deleteAppointment, saveAppointment } from '../../db/appointments'
import type { Appointment, AppointmentType } from '../../db/db'
import { addDays, today } from '../../domain/dates'
import { t } from '../../i18n'
import { idToken } from '../../account/account'
import { buildIcs } from '../../domain/ics'
import { saveFile } from '../../files'
import { isIOS } from '../../platform'
import { permission, requestPermission } from '../../push/pushClient'
import { APPOINTMENT_EMOJI, APPOINTMENT_TYPES } from './appointmentTypes'


const INPUT = 'min-h-12 w-full rounded-2xl border border-line bg-surface px-4'

/** Aviso por defecto: el día antes a las 20:00 (o el mismo día a las 8:00 si la cita es hoy o mañana temprano). */
function defaultReminder(date: string): { date: string; time: string } {
  const before = addDays(date, -1)
  return before >= today() ? { date: before, time: '20:00' } : { date, time: '08:00' }
}

/**
 * Crear o editar una cita médica: tipo, día y hora, con quién y dónde, notas (antes
 * o después de la cita) y aviso por notificación el día y la hora que se elijan.
 */
export function AppointmentSheet({
  appointment,
  defaultDate,
  defaultType,
  onClose,
}: {
  appointment?: Appointment
  defaultDate: string
  defaultType: AppointmentType
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const a = t.appointments
  const [form, setForm] = useState(() => ({
    type: appointment?.type ?? defaultType,
    date: appointment?.date ?? defaultDate,
    time: appointment?.time ?? '10:00',
    noTime: appointment ? appointment.time === null : false,
    title: appointment?.title ?? '',
    place: appointment?.place ?? '',
    notes: appointment?.notes ?? '',
    reminder: appointment ? appointment.reminder : defaultReminder(defaultDate),
  }))
  const [confirmRemove, setConfirmRemove] = useState(false)
  // El id se fija ya para que el archivo de calendario y la cita guardada coincidan.
  const [id] = useState(() => appointment?.id ?? crypto.randomUUID())
  /** iPhone: enlace al archivo de calendario ya subido, o si se está preparando o falló. */
  const [calendarLink, setCalendarLink] = useState<'busy' | 'error' | { url: string } | null>(null)
  const [perm, setPerm] = useState(permission)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const cancel = (e: Event) => {
      e.preventDefault()
      onCloseRef.current()
    }
    d.addEventListener('cancel', cancel)
    if (!d.open) d.showModal()
    return () => d.removeEventListener('cancel', cancel)
  }, [])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const toggleReminder = async (on: boolean) => {
    set('reminder', on ? defaultReminder(form.date) : null)
    if (on && perm === 'default') setPerm(await requestPermission())
  }

  const save = async () => {
    await saveAppointment({
      id,
      type: form.type,
      date: form.date,
      time: form.noTime ? null : form.time,
      title: form.title,
      place: form.place,
      notes: form.notes,
      reminder: form.reminder,
    })
    onClose()
  }

  /** Descarga (o comparte, en iPhone) un .ics para añadir la cita al calendario del móvil. */
  const addToPhoneCalendar = () => {
    const summary = form.title.trim() ? `${a.types[form.type]} · ${form.title.trim()}` : a.types[form.type]
    const ics = buildIcs(
      {
        id,
        date: form.date,
        time: form.noTime ? null : form.time,
        place: form.place.trim(),
        notes: form.notes.trim(),
        reminder: form.reminder,
      },
      summary,
    )
    if (!isIOS()) {
      void saveFile(new File([ics], `cita-${form.date}.ics`, { type: 'text/calendar' }))
      return
    }
    // En iPhone, "Añadir al calendario" solo aparece al abrir el .ics desde una dirección
    // web: se sube un momento al servidor y se ofrece el enlace para abrirlo.
    setCalendarLink('busy')
    idToken()
      .then((token) =>
        fetch('/api/ics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
          body: JSON.stringify({ ics }),
        }),
      )
      .then((r) => (r.ok ? (r.json() as Promise<{ url: string }>) : Promise.reject(new Error(String(r.status)))))
      .then(({ url }) => setCalendarLink({ url }))
      .catch((e) => {
        console.error(e)
        setCalendarLink('error')
      })
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl bg-bg p-5 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <h2 id={titleId} className="text-xl font-extrabold">
        {appointment ? a.editTitle : a.newTitle}
      </h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <fieldset>
          <legend className="mb-2 font-bold">{a.type}</legend>
          <div className="grid grid-cols-3 gap-2">
            {APPOINTMENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={form.type === type}
                onClick={() => set('type', type)}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-xs font-bold ${
                  form.type === type ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                }`}
              >
                <span aria-hidden="true" className="text-2xl">
                  {APPOINTMENT_EMOJI[type]}
                </span>
                {a.types[type]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${titleId}-date`} className="mb-1 block text-sm font-bold">
              {a.date}
            </label>
            <input
              id={`${titleId}-date`}
              type="date"
              required
              value={form.date}
              onChange={(e) => e.target.value && set('date', e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor={`${titleId}-time`} className="mb-1 block text-sm font-bold">
              {a.time}
            </label>
            <input
              id={`${titleId}-time`}
              type="time"
              value={form.time}
              disabled={form.noTime}
              onChange={(e) => e.target.value && set('time', e.target.value)}
              className={`${INPUT} disabled:opacity-50`}
            />
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.noTime}
            onChange={(e) => set('noTime', e.target.checked)}
            className="size-5 accent-[var(--primary)]"
          />
          {a.noTime}
        </label>

        <div>
          <label htmlFor={`${titleId}-who`} className="mb-1 block text-sm font-bold">
            {a.who}
          </label>
          <input
            id={`${titleId}-who`}
            type="text"
            maxLength={80}
            value={form.title}
            placeholder={a.whoPlaceholder}
            onChange={(e) => set('title', e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor={`${titleId}-place`} className="mb-1 block text-sm font-bold">
            {a.place}
          </label>
          <input
            id={`${titleId}-place`}
            type="text"
            maxLength={120}
            value={form.place}
            placeholder={a.placePlaceholder}
            onChange={(e) => set('place', e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor={`${titleId}-notes`} className="block text-sm font-bold">
            {a.notes}
          </label>
          <p id={`${titleId}-notes-hint`} className="mb-1 text-xs text-muted">
            {a.notesHint}
          </p>
          <textarea
            id={`${titleId}-notes`}
            aria-describedby={`${titleId}-notes-hint`}
            rows={4}
            maxLength={4000}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3"
          />
        </div>

        <div className="space-y-3 rounded-2xl bg-surface-soft p-4">
          <div className="flex items-center justify-between gap-4">
            <p id={`${titleId}-remind`} className="font-bold">
              {a.remind}
            </p>
            <Switch
              labelledBy={`${titleId}-remind`}
              checked={!!form.reminder}
              onChange={(v) => void toggleReminder(v)}
            />
          </div>
          {form.reminder && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={`${titleId}-rdate`} className="mb-1 block text-sm font-bold">
                    {a.remindDate}
                  </label>
                  <input
                    id={`${titleId}-rdate`}
                    type="date"
                    value={form.reminder.date}
                    min={today()}
                    onChange={(e) => e.target.value && set('reminder', { ...form.reminder!, date: e.target.value })}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label htmlFor={`${titleId}-rtime`} className="mb-1 block text-sm font-bold">
                    {a.remindTime}
                  </label>
                  <input
                    id={`${titleId}-rtime`}
                    type="time"
                    value={form.reminder.time}
                    onChange={(e) => e.target.value && set('reminder', { ...form.reminder!, time: e.target.value })}
                    className={INPUT}
                  />
                </div>
              </div>
              <p className="text-xs text-muted">{perm === 'denied' ? t.settings.remindersDenied : a.remindHint}</p>
            </>
          )}
        </div>

        <div className="grid gap-2">
          {calendarLink && typeof calendarLink === 'object' ? (
            <a
              href={calendarLink.url}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-on-primary"
            >
              <span aria-hidden="true">📅</span>
              {a.openInCalendar}
            </a>
          ) : (
            <Button variant="secondary" disabled={calendarLink === 'busy'} onClick={addToPhoneCalendar}>
              <span aria-hidden="true">📅</span>
              {calendarLink === 'busy' ? a.preparingCalendar : a.addToCalendar}
            </Button>
          )}
          <p role="status" className="-mt-1 text-center text-xs text-muted">
            {calendarLink === 'error'
              ? a.calendarError
              : calendarLink && typeof calendarLink === 'object'
                ? a.openInCalendarHint
                : a.addToCalendarHint}
          </p>
          <Button type="submit">{a.save}</Button>
          {appointment && (
            <Button variant="ghost" className="text-danger" onClick={() => setConfirmRemove(true)}>
              {a.remove}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {t.confirm.cancel}
          </Button>
        </div>
      </form>

      {confirmRemove && appointment && (
        <ConfirmDialog
          title={a.removeTitle}
          danger
          confirmLabel={a.remove}
          onConfirm={() => void deleteAppointment(appointment.id).then(onClose)}
          onCancel={() => setConfirmRemove(false)}
        >
          {a.removeBody}
        </ConfirmDialog>
      )}
    </dialog>
  )
}
