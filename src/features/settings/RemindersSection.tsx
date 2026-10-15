import { useId, useState, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { NumberStepper } from '../../components/NumberStepper'
import { Switch } from '../../components/Switch'
import { setSettings, type Settings, type ReminderSettings } from '../../db/settings'
import { reminderPillPack } from '../../domain/pill'
import { permission, requestPermission, showTestNotification, syncPush } from '../../push/pushClient'
import { MEDICATION_NAME_MAX } from '../../push/reminderPayload'
import { formatLong, today } from '../../domain/dates'
import {
  addYears,
  buildEventReminders,
  checkupEvents,
  type ContraceptionMethod,
} from '../../domain/reminderEvents'
import { t } from '../../i18n'
import { isIOS, isStandalone } from '../../platform'
import { usePrediction } from '../../usePrediction'
import { Row, Section } from './Section'

const INPUT = 'min-h-12 w-full rounded-2xl border border-line bg-surface px-4'

/**
 * Ajustes → Recordatorios, agrupados: los del ciclo, los de cada día y otros avisos.
 * Cada uno es un interruptor; sus opciones solo aparecen al activarlo.
 */
export function RemindersSection({ settings }: { settings: Settings }) {
  const { reminders, pushError, pushSync } = settings
  const [perm, setPerm] = useState(permission)
  const [busy, setBusy] = useState(false)
  const prediction = usePrediction()
  const s = t.settings
  const u = s.reminderUi

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

  // En iPhone los avisos solo llegan con la app instalada en la pantalla de inicio.
  const iosHint = isIOS() && !isStandalone() && <p className="rounded-2xl bg-lavender-soft p-4 text-sm">{u.ios}</p>

  if (perm === 'unsupported') {
    return (
      <Section title={s.reminders}>
        {iosHint || <p className="text-sm text-muted">{s.remindersUnsupported}</p>}
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
  // Próximos avisos del anticonceptivo y de la revisión, para comprobar las fechas.
  const nextContraception =
    c.method !== 'none' && c.start
      ? buildEventReminders({ fertileEnabled: false, breastExamEnabled: false, contraception: c }, null, today())[0]
      : undefined
  const nextCheckup =
    reminders.checkupEnabled && reminders.checkupDate
      ? checkupEvents({ date: reminders.checkupDate, yearly: reminders.checkupYearly }, today(), addYears(today(), 2))[0]
      : undefined
  const updateContraception = (patch: Partial<ReminderSettings['contraception']>) =>
    void update({ contraception: { ...c, ...patch } })

  /** Interruptor de un recordatorio (desactivado si las notificaciones están bloqueadas). */
  const item = (key: keyof ReminderSettings, label: string, hint: string | undefined, options?: ReactNode) => (
    <Item
      label={label}
      hint={hint}
      checked={reminders[key] as boolean}
      disabled={blocked && !reminders[key]}
      onChange={(v) => void update({ [key]: v })}
    >
      {options}
    </Item>
  )

  return (
    <>
      {iosHint}
      {blocked && (
        <p role="alert" className="rounded-2xl bg-rose-soft p-4 text-sm">
          {s.remindersDenied}
        </p>
      )}

      {settings.mode === 'cycle' ? (
        <Section title={u.groups.cycle}>
          {item(
            'periodEnabled',
            u.period,
            undefined,
            <NumberStepper
              id="days-before"
              label={s.daysBefore}
              value={reminders.periodDaysBefore}
              min={1}
              max={7}
              unit={t.common.days}
              onChange={(n) => void update({ periodDaysBefore: n })}
            />,
          )}
          {item('fertileEnabled', u.fertile, u.fertileHint)}
          {item('breastExamEnabled', u.breast, u.breastHint)}
        </Section>
      ) : (
        <p className="rounded-2xl bg-lavender-soft p-4 text-sm">
          {settings.mode === 'pregnancy' ? t.modes.pregnancyPaused : t.modes.otherModePaused}
        </p>
      )}

      <Section title={u.groups.daily}>
        {item(
          'dailyEnabled',
          u.daily,
          undefined,
          <TimeField id="daily-time" value={reminders.dailyTime} onChange={(v) => void update({ dailyTime: v })} />,
        )}
        {item(
          'pillEnabled',
          u.pill,
          undefined,
          <>
            <TimeField id="pill-time" value={reminders.pillTime} onChange={(v) => void update({ pillTime: v })} />
            {!(settings.tracking.pill && settings.pill.pack === 28) && (
              <p className="text-sm text-muted">
                {reminderPillPack(settings.tracking.pill, settings.pill) ? s.pillSkipsBreak : s.pillBreakHint}
              </p>
            )}
          </>,
        )}
        {item(
          'temperatureEnabled',
          u.temperature,
          undefined,
          <TimeField
            id="temperature-time"
            value={reminders.temperatureTime}
            onChange={(v) => void update({ temperatureTime: v })}
          />,
        )}
        {item(
          'medicationEnabled',
          u.medication,
          undefined,
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
                className={INPUT}
              />
            </div>
            <TimeField
              id="medication-time"
              value={reminders.medicationTime}
              onChange={(v) => void update({ medicationTime: v })}
            />
          </>,
        )}
        {item(
          'weightEnabled',
          u.weight,
          undefined,
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
          </>,
        )}
      </Section>

      <Section title={u.groups.other}>
        {item(
          'checkupEnabled',
          u.checkup,
          u.checkupHint,
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
                className={INPUT}
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
          </>,
        )}

        <div className="space-y-3">
          <div>
            <label htmlFor="contraception-method" className="block font-bold">
              {u.contraception}
            </label>
            <p className="text-sm text-muted">{u.contraceptionHint}</p>
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
            className={INPUT}
          >
            {(Object.keys(s.contraceptionMethods) as ContraceptionMethod[]).map((m) => (
              <option key={m} value={m}>
                {s.contraceptionMethods[m]}
              </option>
            ))}
          </select>
          {c.method !== 'none' && (
            <Options>
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
                  className={INPUT}
                />
              </div>
              <TimeField id="contraception-time" value={c.time} onChange={(v) => updateContraception({ time: v })} />
              {nextContraception && (
                <p className="text-sm font-bold">
                  {s.nextEvent(formatLong(nextContraception.date))} ·{' '}
                  {t.notifications.events[nextContraception.type].body}
                </p>
              )}
            </Options>
          )}
        </div>
      </Section>

      <Section title={u.groups.display}>
        <DiscreetRow checked={reminders.discreet} onChange={(v) => void update({ discreet: v })} />

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
    </>
  )
}

/** Un recordatorio: interruptor y, al activarlo, sus opciones debajo. */
function Item({
  label,
  hint,
  checked,
  disabled,
  onChange,
  children,
}: {
  label: string
  hint?: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
  children?: ReactNode
}) {
  const id = useId()
  return (
    <div>
      <Row id={id} label={label} hint={hint}>
        <Switch labelledBy={id} checked={checked} disabled={disabled} onChange={onChange} />
      </Row>
      {checked && children && <Options>{children}</Options>}
    </div>
  )
}

function Options({ children }: { children: ReactNode }) {
  return <div className="mt-3 space-y-3 rounded-2xl bg-surface-soft p-3">{children}</div>
}

function DiscreetRow({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId()
  const s = t.settings
  return (
    <Row id={id} label={s.discreet} hint={s.discreetHint}>
      <Switch labelledBy={id} checked={checked} onChange={onChange} />
    </Row>
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
