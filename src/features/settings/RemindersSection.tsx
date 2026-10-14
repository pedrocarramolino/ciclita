import { useId, useState } from 'react'
import { Button } from '../../components/Button'
import { NumberStepper } from '../../components/NumberStepper'
import { Switch } from '../../components/Switch'
import { setSettings, type Settings, type ReminderSettings } from '../../db/settings'
import { reminderPillPack } from '../../domain/pill'
import { permission, requestPermission, showTestNotification, syncPush } from '../../push/pushClient'
import { MEDICATION_NAME_MAX } from '../../push/reminderPayload'
import { formatLong, today } from '../../domain/dates'
import { addYears, buildEventReminders, checkupEvents, type ContraceptionMethod } from '../../domain/reminderEvents'
import { t } from '../../i18n'
import { usePrediction } from '../../usePrediction'
import { Row, Section } from './Section'

export function RemindersSection({ settings }: { settings: Settings }) {
  const { reminders, pushError, pushSync } = settings
  const [perm, setPerm] = useState(permission)
  const [busy, setBusy] = useState(false)
  const prediction = usePrediction()
  const s = t.settings
  const ids = {
    period: useId(),
    daily: useId(),
    pill: useId(),
    discreet: useId(),
    fertile: useId(),
    breast: useId(),
    temperature: useId(),
    weight: useId(),
    medication: useId(),
    checkup: useId(),
  }

  // La sincronización con el servidor la hace usePushSync (App) al cambiar los ajustes.
  const update = async (patch: Partial<ReminderSettings>) => {
    const turningOn = Object.entries(patch).some(([k, v]) => k.endsWith('Enabled') && v === true)
    if (turningOn && perm === 'default') setPerm(await requestPermission())
    await setSettings({ reminders: { ...reminders, ...patch } })
  }

  const retry = async () => {
    setBusy(true)
    if (permission() === 'default') setPerm(await requestPermission())
    await syncPush(prediction ?? null, { force: true })
    setBusy(false)
  }

  if (perm === 'unsupported') {
    return (
      <Section title={s.reminders}>
        <p className="text-sm text-muted">{s.remindersUnsupported}</p>
      </Section>
    )
  }

  const blocked = perm === 'denied'
  const c = reminders.contraception
  const anyOn =
    reminders.periodEnabled ||
    reminders.dailyEnabled ||
    reminders.pillEnabled ||
    reminders.fertileEnabled ||
    reminders.breastExamEnabled ||
    reminders.temperatureEnabled ||
    reminders.weightEnabled ||
    reminders.medicationEnabled ||
    (reminders.checkupEnabled && !!reminders.checkupDate) ||
    (c.method !== 'none' && !!c.start)
  // Próximo aviso del anticonceptivo, para que se vea que la pauta está bien.
  const nextContraception =
    c.method !== 'none' && c.start
      ? buildEventReminders({ fertileEnabled: false, breastExamEnabled: false, contraception: c }, null, today())[0]
      : undefined
  // Próximo aviso de la revisión (para comprobar la fecha y si se repite).
  const nextCheckup =
    reminders.checkupEnabled && reminders.checkupDate
      ? checkupEvents({ date: reminders.checkupDate, yearly: reminders.checkupYearly }, today(), addYears(today(), 2))[0]
      : undefined
  const updateContraception = (patch: Partial<ReminderSettings['contraception']>) =>
    void update({ contraception: { ...c, ...patch } })

  return (
    <Section title={s.reminders} hint={s.remindersHow}>
      <details className="rounded-2xl bg-lavender-soft px-4 py-2 text-sm">
        <summary className="min-h-9 cursor-pointer py-1 font-bold">{s.remindersDataTitle}</summary>
        <p className="pb-2">{s.remindersData}</p>
      </details>

      {blocked && (
        <p role="alert" className="rounded-2xl bg-rose-soft p-3 text-sm">
          {s.remindersDenied}
        </p>
      )}

      {settings.mode !== 'cycle' && (
        <p className="rounded-2xl bg-lavender-soft p-3 text-sm">
          {settings.mode === 'pregnancy' ? t.modes.pregnancyPaused : t.modes.otherModePaused}
        </p>
      )}

      <Row id={ids.period} label={s.periodReminder}>
        <Switch
          labelledBy={ids.period}
          checked={reminders.periodEnabled}
          disabled={blocked && !reminders.periodEnabled}
          onChange={(v) => void update({ periodEnabled: v })}
        />
      </Row>
      {reminders.periodEnabled && (
        <NumberStepper
          id="days-before"
          label={s.daysBefore}
          value={reminders.periodDaysBefore}
          min={1}
          max={7}
          unit={t.common.days}
          onChange={(n) => void update({ periodDaysBefore: n })}
        />
      )}

      <Row id={ids.daily} label={s.dailyReminder}>
        <Switch
          labelledBy={ids.daily}
          checked={reminders.dailyEnabled}
          disabled={blocked && !reminders.dailyEnabled}
          onChange={(v) => void update({ dailyEnabled: v })}
        />
      </Row>
      {reminders.dailyEnabled && (
        <TimeField id="daily-time" value={reminders.dailyTime} onChange={(v) => void update({ dailyTime: v })} />
      )}

      <Row id={ids.pill} label={s.pillReminder}>
        <Switch
          labelledBy={ids.pill}
          checked={reminders.pillEnabled}
          disabled={blocked && !reminders.pillEnabled}
          onChange={(v) => void update({ pillEnabled: v })}
        />
      </Row>
      {reminders.pillEnabled && (
        <>
          <TimeField id="pill-time" value={reminders.pillTime} onChange={(v) => void update({ pillTime: v })} />
          {!(settings.tracking.pill && settings.pill.pack === 28) && (
            <p className="text-sm text-muted">
              {reminderPillPack(settings.tracking.pill, settings.pill) ? s.pillSkipsBreak : s.pillBreakHint}
            </p>
          )}
        </>
      )}

      <Row id={ids.fertile} label={s.fertileReminder} hint={s.fertileReminderHint}>
        <Switch
          labelledBy={ids.fertile}
          checked={reminders.fertileEnabled}
          disabled={blocked && !reminders.fertileEnabled}
          onChange={(v) => void update({ fertileEnabled: v })}
        />
      </Row>

      <Row id={ids.breast} label={s.breastReminder} hint={s.breastReminderHint}>
        <Switch
          labelledBy={ids.breast}
          checked={reminders.breastExamEnabled}
          disabled={blocked && !reminders.breastExamEnabled}
          onChange={(v) => void update({ breastExamEnabled: v })}
        />
      </Row>

      <Row id={ids.temperature} label={s.temperatureReminder} hint={s.temperatureReminderHint}>
        <Switch
          labelledBy={ids.temperature}
          checked={reminders.temperatureEnabled}
          disabled={blocked && !reminders.temperatureEnabled}
          onChange={(v) => void update({ temperatureEnabled: v })}
        />
      </Row>
      {reminders.temperatureEnabled && (
        <TimeField
          id="temperature-time"
          value={reminders.temperatureTime}
          onChange={(v) => void update({ temperatureTime: v })}
        />
      )}

      <Row id={ids.weight} label={s.weightReminder}>
        <Switch
          labelledBy={ids.weight}
          checked={reminders.weightEnabled}
          disabled={blocked && !reminders.weightEnabled}
          onChange={(v) => void update({ weightEnabled: v })}
        />
      </Row>
      {reminders.weightEnabled && (
        <>
          <div className="flex items-center gap-3">
            <label htmlFor="weight-day" className="font-bold text-muted">
              {s.weightDay}
            </label>
            <select
              id="weight-day"
              value={reminders.weightDay ?? 'all'}
              onChange={(e) => void update({ weightDay: e.target.value === 'all' ? null : Number(e.target.value) })}
              className="min-h-12 flex-1 rounded-2xl border border-line bg-surface px-4"
            >
              <option value="all">{s.everyDay}</option>
              {/* Lunes primero; el valor es el día de la semana con 0 = domingo. */}
              {t.calendar.weekdaysLong.map((name, i) => (
                <option key={name} value={(i + 1) % 7}>
                  {s.everyWeekday(name)}
                </option>
              ))}
            </select>
          </div>
          <TimeField id="weight-time" value={reminders.weightTime} onChange={(v) => void update({ weightTime: v })} />
        </>
      )}

      <Row id={ids.medication} label={s.medicationReminder} hint={s.medicationReminderHint}>
        <Switch
          labelledBy={ids.medication}
          checked={reminders.medicationEnabled}
          disabled={blocked && !reminders.medicationEnabled}
          onChange={(v) => void update({ medicationEnabled: v })}
        />
      </Row>
      {reminders.medicationEnabled && (
        <>
          <div>
            <label htmlFor="medication-name" className="mb-1 block text-sm font-bold text-muted">
              {s.medicationName}
            </label>
            <input
              id="medication-name"
              type="text"
              value={reminders.medicationName}
              maxLength={MEDICATION_NAME_MAX}
              placeholder={s.medicationPlaceholder}
              onChange={(e) => void update({ medicationName: e.target.value })}
              className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
            />
          </div>
          <TimeField
            id="medication-time"
            value={reminders.medicationTime}
            onChange={(v) => void update({ medicationTime: v })}
          />
        </>
      )}

      <Row id={ids.checkup} label={s.checkupReminder} hint={s.checkupReminderHint}>
        <Switch
          labelledBy={ids.checkup}
          checked={reminders.checkupEnabled}
          disabled={blocked && !reminders.checkupEnabled}
          onChange={(v) => void update({ checkupEnabled: v })}
        />
      </Row>
      {reminders.checkupEnabled && (
        <>
          <div>
            <label htmlFor="checkup-date" className="mb-1 block text-sm font-bold text-muted">
              {s.checkupDate}
            </label>
            <input
              id="checkup-date"
              type="date"
              value={reminders.checkupDate ?? ''}
              onChange={(e) => void update({ checkupDate: e.target.value || null })}
              className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
            />
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={reminders.checkupYearly}
              onChange={(e) => void update({ checkupYearly: e.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
            {s.checkupYearly}
          </label>
          {nextCheckup && (
            <p className="text-sm font-bold">
              {s.nextEvent(formatLong(nextCheckup.date))} · {t.notifications.events[nextCheckup.type].body}
            </p>
          )}
        </>
      )}

      <fieldset className="space-y-3 rounded-2xl bg-surface-soft p-4">
        <legend className="sr-only">{s.contraception}</legend>
        <div>
          <label htmlFor="contraception-method" className="block font-bold">
            {s.contraception}
          </label>
          <p className="text-sm text-muted">{s.contraceptionHint}</p>
        </div>
        <select
          id="contraception-method"
          value={c.method}
          disabled={blocked && c.method === 'none'}
          onChange={(e) => {
            const method = e.target.value as ContraceptionMethod
            // Al activar un método por primera vez se pide permiso de notificaciones.
            if (method !== 'none' && perm === 'default') void requestPermission().then(setPerm)
            updateContraception({ method })
          }}
          className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
        >
          {(Object.keys(s.contraceptionMethods) as ContraceptionMethod[]).map((m) => (
            <option key={m} value={m}>
              {s.contraceptionMethods[m]}
            </option>
          ))}
        </select>
        {c.method !== 'none' && (
          <>
            <p className="text-sm">{s.contraceptionSchedule[c.method]}</p>
            <div>
              <label htmlFor="contraception-start" className="mb-1 block text-sm font-bold text-muted">
                {s.contraceptionStart[c.method]}
              </label>
              <input
                id="contraception-start"
                type="date"
                value={c.start ?? ''}
                max={today()}
                onChange={(e) => updateContraception({ start: e.target.value || null })}
                className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
              />
            </div>
            <TimeField id="contraception-time" value={c.time} onChange={(v) => updateContraception({ time: v })} />
            {nextContraception && (
              <p className="text-sm font-bold">
                {s.nextEvent(formatLong(nextContraception.date))} ·{' '}
                {t.notifications.events[nextContraception.type].body}
              </p>
            )}
          </>
        )}
      </fieldset>

      <Row id={ids.discreet} label={s.discreet} hint={s.discreetHint}>
        <Switch
          labelledBy={ids.discreet}
          checked={reminders.discreet}
          onChange={(v) => void update({ discreet: v })}
        />
      </Row>

      {anyOn && !blocked && (
        <div role="status" aria-live="polite">
          {pushError ? (
            <div className="rounded-2xl bg-rose-soft p-3 text-sm">
              <p className="font-bold">{s.pushErrorTitle}</p>
              <p>{pushError}</p>
              <Button variant="secondary" className="mt-2 min-h-11" disabled={busy} onClick={() => void retry()}>
                {busy ? s.pushSyncing : perm === 'default' ? s.allowNotifications : s.pushRetry}
              </Button>
            </div>
          ) : (
            <p className="text-sm font-bold">{pushSync ? s.pushSynced : s.pushSyncing}</p>
          )}
        </div>
      )}

      {perm === 'granted' && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() =>
            void showTestNotification(reminders.discreet ? t.notifications.discreetTitle : t.appName, s.testBody)
          }
        >
          {s.test}
        </Button>
      )}
    </Section>
  )
}

function TimeField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="font-bold text-muted">
        {t.settings.time}
      </label>
      <input
        id={id}
        type="time"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-lg font-bold"
      />
    </div>
  )
}
