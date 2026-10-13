import { useId } from 'react'
import { setSettings, type Settings } from '../../db/settings'
import { formatFullDate, today } from '../../domain/dates'
import { lastPeriodFromDueDate, pregnancyInfo, type AppMode } from '../../domain/modes'
import { t } from '../../i18n'
import { usePrediction } from '../../usePrediction'
import { Section } from './Section'

const MODES: AppMode[] = ['cycle', 'pregnancy', 'perimenopause']

/** Modo de la app: ciclo menstrual, embarazo o perimenopausia. */
export function ModeSection({ settings }: { settings: Settings }) {
  const m = t.modes
  const prediction = usePrediction()
  const name = useId()

  const choose = (mode: AppMode) => {
    // Al pasar a embarazo, la última regla registrada es el punto de partida razonable.
    const pregnancyStart =
      mode === 'pregnancy' ? (settings.pregnancyStart ?? prediction?.lastStart ?? today()) : settings.pregnancyStart
    void setSettings({ mode, pregnancyStart })
  }

  const info = settings.mode === 'pregnancy' && settings.pregnancyStart ? pregnancyInfo(settings.pregnancyStart, today()) : null

  return (
    <Section title={m.title} hint={m.hint}>
      <fieldset className="space-y-2">
        <legend className="sr-only">{m.title}</legend>
        {MODES.map((mode) => (
          <label
            key={mode}
            className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-3 has-focus-visible:outline-[var(--focus)]"
          >
            <input
              type="radio"
              name={name}
              checked={settings.mode === mode}
              onChange={() => choose(mode)}
              className="mt-1 size-5 accent-[var(--primary)]"
            />
            <span>
              <span className="block font-bold">{m.options[mode].label}</span>
              <span className="block text-sm text-muted">{m.options[mode].hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {settings.mode === 'pregnancy' && (
        <div className="space-y-3 rounded-2xl bg-surface-soft p-4">
          <div>
            <label htmlFor="pregnancy-start" className="mb-1 block font-bold">
              {m.pregnancyStartLabel}
            </label>
            <input
              id="pregnancy-start"
              type="date"
              value={settings.pregnancyStart ?? ''}
              max={today()}
              onChange={(e) => e.target.value && void setSettings({ pregnancyStart: e.target.value })}
              className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
            />
            <p className="mt-1 text-xs text-muted">{m.pregnancyStartHint}</p>
          </div>
          <div>
            <label htmlFor="due-date" className="mb-1 block font-bold">
              {m.dueDateLabel}
            </label>
            <input
              id="due-date"
              type="date"
              value={info?.dueDate ?? ''}
              onChange={(e) => e.target.value && void setSettings({ pregnancyStart: lastPeriodFromDueDate(e.target.value) })}
              className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
            />
          </div>
          {info && (
            <p className="text-sm font-bold">
              {m.pregnancy.headline(info.weeks, info.days)} · {m.pregnancy.dueDate(formatFullDate(info.dueDate))}
            </p>
          )}
        </div>
      )}
    </Section>
  )
}
