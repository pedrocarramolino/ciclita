import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon, type IconName } from '../../components/Icon'
import { LegalNotice } from '../../components/LegalNotice'
import { NumberStepper } from '../../components/NumberStepper'
import { completeOnboarding } from '../../db/settings'
import type { AppMode } from '../../domain/modes'
import { useBackupImport } from '../settings/useBackupImport'
import { addDays, today } from '../../domain/dates'
import { LANGS, lang, setLanguage, t } from '../../i18n'

const PRIVACY_ICONS: IconName[] = ['phone', 'shield', 'lock']
const MODES: AppMode[] = ['cycle', 'pregnancy', 'perimenopause']
type StepName = 'welcome' | 'mode' | 'last' | 'lengths'
/** Hasta cuántos días atrás se puede indicar el último periodo, según el modo. */
const LAST_PERIOD_MAX_AGO: Record<AppMode, number> = { cycle: 120, pregnancy: 300, perimenopause: 400 }

export function Onboarding() {
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<AppMode>('cycle')
  // En embarazo y perimenopausia no hay previsiones: no se preguntan las duraciones.
  const steps: StepName[] = mode === 'cycle' ? ['welcome', 'mode', 'last', 'lengths'] : ['welcome', 'mode', 'last']
  const TOTAL_STEPS = steps.length
  const current = steps[step]
  const [lastStart, setLastStart] = useState(today())
  const [lastStartUnknown, setLastStartUnknown] = useState(false)
  const [cycle, setCycle] = useState(28)
  const [period, setPeriod] = useState(5)
  const [lengthsUnknown, setLengthsUnknown] = useState(false)
  const [saving, setSaving] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Lleva el foco al título de cada paso para lectores de pantalla.
  useEffect(() => {
    headingRef.current?.focus()
  }, [step])

  const finish = async () => {
    setSaving(true)
    const askLengths = mode === 'cycle'
    await completeOnboarding({
      lastPeriodStart: lastStartUnknown ? null : lastStart,
      cycleLength: askLengths && !lengthsUnknown ? cycle : null,
      periodLength: askLengths && !lengthsUnknown ? period : null,
      mode,
    })
  }

  const o = t.onboarding
  const importer = useBackupImport({ confirmReplace: false })

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <Button variant="ghost" className="-ml-3 px-3" onClick={() => setStep(step - 1)}>
            <Icon name="arrowLeft" />
            {t.common.back}
          </Button>
        ) : (
          <div role="group" aria-label={t.settings.language} className="-ml-1 flex gap-1">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                aria-pressed={l === lang}
                onClick={() => l !== lang && setLanguage(l)}
                className="min-h-11 rounded-full px-3 text-sm font-bold text-muted aria-pressed:bg-primary-soft aria-pressed:text-ink"
              >
                {t.settings.languages[l]}
              </button>
            ))}
          </div>
        )}
        <p className="text-sm font-semibold text-muted">{o.stepOf(step + 1, TOTAL_STEPS)}</p>
      </div>
      <div
        className="mt-3 flex gap-2"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-valuenow={step + 1}
        aria-label={o.stepOf(step + 1, TOTAL_STEPS)}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-line'}`}
          />
        ))}
      </div>

      {current === 'welcome' && (
        <section className="flex flex-1 flex-col pt-8">
          <img src="/icons/icon.svg" alt="" width={96} height={96} className="mx-auto size-24 rounded-[28%] shadow-sm" />
          <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-center text-3xl font-extrabold tracking-wide text-primary">
            {t.appName}
          </h1>
          <p className="mt-3 text-center text-lg text-muted">{o.welcomeBody}</p>

          <div className="mt-8 rounded-3xl bg-surface p-5 shadow-sm">
            <h2 className="text-lg font-extrabold">{o.privacyTitle}</h2>
            <ul className="mt-3 space-y-3">
              {o.privacyPoints.map((p, i) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-lavender-soft">
                    <Icon name={PRIVACY_ICONS[i]} className="size-5" />
                  </span>
                  <span className="pt-1.5">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <LegalNotice className="mt-4" />
          <div className="mt-auto pt-8">
            <Button className="w-full" onClick={() => setStep(1)}>
              {o.start}
            </Button>
            {/* Móvil nuevo: se recupera una copia y se salta la bienvenida (al importar, la app pasa al inicio). */}
            <Button variant="ghost" className="mt-2 w-full" onClick={importer.open}>
              {o.importBackup}
            </Button>
            {importer.ui}
            <p role="status" className="mt-1 text-center text-sm font-bold empty:hidden">
              {importer.status}
            </p>
          </div>
        </section>
      )}

      {current === 'mode' && (
        <section className="flex flex-1 flex-col pt-8">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold">
            {o.modeTitle}
          </h1>
          <p className="mt-2 text-muted">{o.modeHint}</p>
          <fieldset className="mt-6 space-y-2">
            <legend className="sr-only">{o.modeTitle}</legend>
            {MODES.map((m) => (
              <label
                key={m}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-3 has-focus-visible:outline-[var(--focus)]"
              >
                <input
                  type="radio"
                  name="onboarding-mode"
                  checked={mode === m}
                  onChange={() => setMode(m)}
                  className="mt-1 size-5 accent-[var(--primary)]"
                />
                <span>
                  <span className="block font-bold">{t.modes.options[m].label}</span>
                  <span className="block text-sm text-muted">{t.modes.options[m].hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="mt-auto pt-8">
            <Button className="w-full" onClick={() => setStep(step + 1)}>
              {t.common.next}
            </Button>
          </div>
        </section>
      )}

      {current === 'last' && (
        <section className="flex flex-1 flex-col pt-8">
          <div className="grid size-16 place-items-center rounded-2xl bg-rose-soft text-primary">
            <Icon name="calendar" className="size-8" />
          </div>
          <h1 ref={headingRef} tabIndex={-1} className="mt-5 text-2xl font-extrabold">
            {mode === 'pregnancy' ? o.pregnancyLastTitle : o.lastPeriodTitle}
          </h1>
          <p className="mt-2 text-muted">
            {mode === 'pregnancy'
              ? o.pregnancyLastHint
              : mode === 'perimenopause'
                ? o.perimenopauseLastHint
                : o.lastPeriodHint}
          </p>

          <label htmlFor="last-start" className="mt-8 block font-bold">
            {o.lastPeriodLabel}
          </label>
          <input
            id="last-start"
            type="date"
            value={lastStart}
            max={today()}
            min={addDays(today(), -LAST_PERIOD_MAX_AGO[mode])}
            disabled={lastStartUnknown}
            onChange={(e) => setLastStart(e.target.value || today())}
            className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-lg disabled:opacity-50"
          />
          <DontKnowToggle checked={lastStartUnknown} onChange={setLastStartUnknown} />

          <div className="mt-auto pt-8">
            {steps[step + 1] ? (
              <Button className="w-full" onClick={() => setStep(step + 1)}>
                {t.common.next}
              </Button>
            ) : (
              <Button className="w-full" disabled={saving} onClick={finish}>
                <Icon name="check" />
                {o.finish}
              </Button>
            )}
          </div>
        </section>
      )}

      {current === 'lengths' && (
        <section className="flex flex-1 flex-col pt-8">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold">
            {o.lengthsTitle}
          </h1>
          <p className="mt-2 text-muted">{o.lengthsHint}</p>

          <div className="mt-8 space-y-6 rounded-3xl bg-surface p-5 shadow-sm">
            <NumberStepper
              id="cycle-length"
              label={o.cycleLabel}
              help={o.cycleHelp}
              value={cycle}
              min={15}
              max={60}
              unit={t.common.days}
              disabled={lengthsUnknown}
              onChange={setCycle}
            />
            <NumberStepper
              id="period-length"
              label={o.periodLabel}
              value={period}
              min={1}
              max={14}
              unit={t.common.days}
              disabled={lengthsUnknown}
              onChange={setPeriod}
            />
          </div>
          <DontKnowToggle checked={lengthsUnknown} onChange={setLengthsUnknown} />

          <div className="mt-auto pt-8">
            <Button className="w-full" disabled={saving} onClick={finish}>
              <Icon name="check" />
              {o.finish}
            </Button>
          </div>
        </section>
      )}
    </main>
  )
}

function DontKnowToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`mt-4 min-h-12 self-start rounded-full border px-5 font-bold transition ${
        checked
          ? 'border-primary bg-primary-soft text-ink'
          : 'border-line bg-surface text-ink'
      }`}
    >
      {checked && <span aria-hidden="true">✓ </span>}
      {t.common.dontKnow}
    </button>
  )
}
