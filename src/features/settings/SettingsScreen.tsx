import { useLiveQuery } from 'dexie-react-hooks'
import { LegalNotice } from '../../components/LegalNotice'
import { NumberStepper } from '../../components/NumberStepper'
import { getSettings, setSettings, type Theme } from '../../db/settings'
import { DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_LENGTH } from '../../domain/prediction'
import { t } from '../../i18n/es'
import { DataSection } from './DataSection'
import { InstallSection } from './InstallSection'
import { PinSection } from './PinSection'
import { RemindersSection } from './RemindersSection'
import { Section } from './Section'
import { TrackingSection } from './TrackingSection'

const THEMES: Theme[] = ['system', 'light', 'dark']

export function SettingsScreen() {
  const settings = useLiveQuery(() => getSettings())
  const s = t.settings
  if (!settings) return null

  const unknown = settings.cycleLength === null && settings.periodLength === null

  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-4">
      <h1 className="text-2xl font-extrabold">{s.title}</h1>

      <InstallSection />

      <Section title={s.cycleSection} hint={s.cycleHint}>
        <NumberStepper
          id="set-cycle"
          label={t.onboarding.cycleLabel}
          help={t.onboarding.cycleHelp}
          value={settings.cycleLength ?? DEFAULT_CYCLE_LENGTH}
          min={15}
          max={60}
          unit={t.common.days}
          onChange={(n) => void setSettings({ cycleLength: n })}
        />
        <NumberStepper
          id="set-period"
          label={t.onboarding.periodLabel}
          value={settings.periodLength ?? DEFAULT_PERIOD_LENGTH}
          min={1}
          max={14}
          unit={t.common.days}
          onChange={(n) => void setSettings({ periodLength: n })}
        />
        <button
          type="button"
          aria-pressed={unknown}
          onClick={() =>
            void setSettings(
              unknown
                ? { cycleLength: DEFAULT_CYCLE_LENGTH, periodLength: DEFAULT_PERIOD_LENGTH }
                : { cycleLength: null, periodLength: null },
            )
          }
          className={`min-h-11 rounded-full border px-5 font-bold ${unknown ? 'border-primary bg-primary-soft' : 'border-line bg-surface'}`}
        >
          {unknown && <span aria-hidden="true">✓ </span>}
          {t.common.dontKnow}
        </button>
      </Section>

      <TrackingSection tracking={settings.tracking} />

      <Section title={s.appearance}>
        <fieldset>
          <legend className="mb-2 font-bold">{s.theme}</legend>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((th) => (
              <label
                key={th}
                className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border border-line bg-surface px-2 text-sm font-bold has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-3 has-focus-visible:outline-[var(--focus)]"
              >
                <input
                  type="radio"
                  name="theme"
                  value={th}
                  checked={settings.theme === th}
                  onChange={() => void setSettings({ theme: th })}
                  className="sr-only"
                />
                {s.themes[th]}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="language" className="mb-2 block font-bold">
            {s.language}
          </label>
          <select
            id="language"
            value={settings.language}
            onChange={() => {}}
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
          >
            <option value="es">{s.languages.es}</option>
          </select>
        </div>
      </Section>

      <RemindersSection settings={settings} />
      <PinSection pinHash={settings.pinHash} />
      <DataSection />

      <Section title={s.about}>
        <p className="text-sm">{s.aboutBody}</p>
        <LegalNotice />
      </Section>
    </main>
  )
}
