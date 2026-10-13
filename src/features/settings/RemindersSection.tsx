import { useId, useState } from 'react'
import { Button } from '../../components/Button'
import { NumberStepper } from '../../components/NumberStepper'
import { Switch } from '../../components/Switch'
import { setSettings, type ReminderSettings } from '../../db/settings'
import { permission, requestPermission, runReminders, showNotification } from '../../notifications/notify'
import { t } from '../../i18n/es'
import { Row, Section } from './Section'

export function RemindersSection({ reminders }: { reminders: ReminderSettings }) {
  const [perm, setPerm] = useState(permission)
  const s = t.settings
  const ids = { period: useId(), daily: useId(), pill: useId(), discreet: useId() }

  const update = async (patch: Partial<ReminderSettings>) => {
    const turningOn = Object.entries(patch).some(([k, v]) => k.endsWith('Enabled') && v === true)
    if (turningOn && perm === 'default') setPerm(await requestPermission())
    await setSettings({ reminders: { ...reminders, ...patch } })
    void runReminders()
  }

  if (perm === 'unsupported') {
    return (
      <Section title={s.reminders}>
        <p className="text-sm text-muted">{s.remindersUnsupported}</p>
      </Section>
    )
  }

  const blocked = perm === 'denied'

  return (
    <Section title={s.reminders} hint={s.remindersHow}>
      {blocked && (
        <p role="alert" className="rounded-2xl bg-rose-soft p-3 text-sm">
          {s.remindersDenied}
        </p>
      )}

      <Row id={ids.period} label={s.periodReminder}>
        <Switch
          labelledBy={ids.period}
          checked={reminders.periodEnabled}
          disabled={blocked}
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

      <Row id={ids.daily} label={s.dailyReminder} hint={s.dailyHint}>
        <Switch
          labelledBy={ids.daily}
          checked={reminders.dailyEnabled}
          disabled={blocked}
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
          disabled={blocked}
          onChange={(v) => void update({ pillEnabled: v })}
        />
      </Row>
      {reminders.pillEnabled && (
        <TimeField id="pill-time" value={reminders.pillTime} onChange={(v) => void update({ pillTime: v })} />
      )}

      <Row id={ids.discreet} label={s.discreet} hint={s.discreetHint}>
        <Switch
          labelledBy={ids.discreet}
          checked={reminders.discreet}
          onChange={(v) => void update({ discreet: v })}
        />
      </Row>

      {perm === 'granted' && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => void showNotification(reminders.discreet ? t.notifications.discreetTitle : t.appName, s.testBody, 'ciclo-test')}
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
