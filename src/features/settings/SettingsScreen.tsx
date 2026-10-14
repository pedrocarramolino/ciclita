import { useLiveQuery } from 'dexie-react-hooks'
import { LegalNotice } from '../../components/LegalNotice'
import { NumberStepper } from '../../components/NumberStepper'
import { getSettings, setSettings, type Theme } from '../../db/settings'
import { DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_LENGTH } from '../../domain/prediction'
import { LANGS, lang, setLanguage, t, type Lang } from '../../i18n'
import { DataSection } from './DataSection'
import { InstallSection } from './InstallSection'
import { PinSection } from './PinSection'
import { RemindersSection } from './RemindersSection'
import { Section } from './Section'
import { TrackingSection } from './TrackingSection'
import { ModeSection } from './ModeSection'

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

      <Section title={s.cycleSection} hint={settings.manualPrediction ? s.cycleHintManual : s.cycleHint}>
        <fieldset>
          <legend className="mb-2 font-bold">{s.predictionMode}</legend>
          <div className="space-y-2">
            {([false, true] as const).map((manual) => (
              <label
                key={String(manual)}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-3 has-focus-visible:outline-[var(--focus)]"
              >
                <input
                  type="radio"
                  name="prediction-mode"
                  checked={settings.manualPrediction === manual}
                  onChange={() =>
                    void setSettings({
                      manualPrediction: manual,
                      // La previsión manual necesita unas duraciones: las habituales si no había.
                      ...(manual && unknown
                        ? { cycleLength: DEFAULT_CYCLE_LENGTH, periodLength: DEFAULT_PERIOD_LENGTH }
                        : {}),
                    })
                  }
                  className="mt-1 size-5 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-bold">{manual ? s.predictionManual : s.predictionAuto}</span>
                  <span className="block text-sm text-muted">{manual ? s.predictionManualHint : s.predictionAutoHint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
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
        {!settings.manualPrediction && (
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
        )}
      </Section>

      <ModeSection settings={settings} />

      <TrackingSection settings={settings} />

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
            value={lang}
            onChange={(e) => {
              const l = e.target.value as Lang
              void setSettings({ language: l }).then(() => setLanguage(l))
            }}
            aria-describedby="language-hint"
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
          >
            {LANGS.map((l) => (
              <option key={l} value={l} lang={l}>
                {s.languages[l]}
              </option>
            ))}
          </select>
          <p id="language-hint" className="mt-1 text-xs text-muted">
            {s.languageHint}
          </p>
        </div>
      </Section>

      <RemindersSection settings={settings} />
      <PinSection pinHash={settings.pinHash} />
      <DataSection lastBackup={settings.lastBackup} />

      <Section title={s.about}>
        <p className="text-sm">{s.aboutBody}</p>
        <LegalNotice />
      </Section>
    </main>
  )
}
