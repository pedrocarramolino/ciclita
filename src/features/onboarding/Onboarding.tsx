import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon, type IconName } from '../../components/Icon'
import { LegalNotice } from '../../components/LegalNotice'
import { NumberStepper } from '../../components/NumberStepper'
import { completeOnboarding } from '../../db/settings'
import { addDays, today } from '../../domain/dates'
import { LANGS, lang, setLanguage, t } from '../../i18n'

const TOTAL_STEPS = 3
const PRIVACY_ICONS: IconName[] = ['phone', 'shield', 'lock']

export function Onboarding() {
  const [step, setStep] = useState(0)
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
    await completeOnboarding({
      lastPeriodStart: lastStartUnknown ? null : lastStart,
      cycleLength: lengthsUnknown ? null : cycle,
      periodLength: lengthsUnknown ? null : period,
    })
  }

  const o = t.onboarding

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

      {step === 0 && (
        <section className="flex flex-1 flex-col pt-8">
          <img src="/icons/icon.svg" alt="" width={96} height={96} className="mx-auto size-24 rounded-[28%] shadow-sm" />
          <p className="mt-4 text-center text-lg font-extrabold tracking-wide text-primary">{t.appName}</p>
          <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-center text-3xl font-extrabold">
            {o.welcomeTitle}
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
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="flex flex-1 flex-col pt-8">
          <div className="grid size-16 place-items-center rounded-2xl bg-rose-soft text-primary">
            <Icon name="calendar" className="size-8" />
          </div>
          <h1 ref={headingRef} tabIndex={-1} className="mt-5 text-2xl font-extrabold">
            {o.lastPeriodTitle}
          </h1>
          <p className="mt-2 text-muted">{o.lastPeriodHint}</p>

          <label htmlFor="last-start" className="mt-8 block font-bold">
            {o.lastPeriodLabel}
          </label>
          <input
            id="last-start"
            type="date"
            value={lastStart}
            max={today()}
            min={addDays(today(), -120)}
            disabled={lastStartUnknown}
            onChange={(e) => setLastStart(e.target.value || today())}
            className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-lg disabled:opacity-50"
          />
          <DontKnowToggle checked={lastStartUnknown} onChange={setLastStartUnknown} />

          <div className="mt-auto pt-8">
            <Button className="w-full" onClick={() => setStep(2)}>
              {t.common.next}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
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
