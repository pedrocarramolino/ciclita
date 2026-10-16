import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../components/Icon'
import { NumberStepper } from '../../components/NumberStepper'
import { getSettings, setSettings, type Settings, type Theme } from '../../db/settings'
import { formatFullDate } from '../../domain/dates'
import { DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_LENGTH, LUTEAL_RANGE } from '../../domain/prediction'
import { LANGS, lang, setLanguage, t, type Lang } from '../../i18n'
import { useAccount } from '../../account/useAccount'
import { AccountSection } from './AccountSection'
import { DataSection } from './DataSection'
import { InstallSection } from './InstallSection'
import { PinSection } from './PinSection'
import { RemindersSection } from './RemindersSection'
import { PageTitle } from './pageTitle'
import { Section } from './Section'
import { TrackingSection } from './TrackingSection'
import { ModeSection } from './ModeSection'

const THEMES: Theme[] = ['system', 'light', 'dark']
/** Límites para "Ignorar los ciclos de más de N días". */
const IGNORE_OPTIONS = [35, 40, 45, 50, 60]



/** Apartados de Ajustes; cada uno se abre en su propia página (#/settings/<apartado>). */
const PAGES = ['account', 'cycle', 'tracking', 'reminders', 'security', 'backup', 'appearance'] as const
type Page = (typeof PAGES)[number]

function readPage(): Page | null {
  const sub = window.location.hash.replace(/^#\/?/, '').split('/')[1]
  return (PAGES as readonly string[]).includes(sub) ? (sub as Page) : null
}

function useSettingsPage(): Page | null {
  const [page, setPage] = useState(readPage)
  useEffect(() => {
    const onChange = () => {
      setPage(readPage())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return page
}

export function SettingsScreen() {
  const settings = useLiveQuery(() => getSettings())
  const account = useAccount()
  const page = useSettingsPage()
  if (!settings) return null

  if (page) {
    const titles = t.settings.pages
    return (
      <SubPage title={titles[page]}>
        {page === 'account' && account.status === 'signedIn' && <AccountSection user={account.user} />}
        {page === 'cycle' && (
          <>
            <CycleSection settings={settings} />
            <ModeSection settings={settings} />
          </>
        )}
        {page === 'tracking' && <TrackingSection settings={settings} />}
        {page === 'reminders' && <RemindersSection settings={settings} />}
        {page === 'security' && (
          <PinSection pinHash={settings.pinHash} biometricId={settings.biometric?.credentialId ?? null} />
        )}
        {page === 'backup' && <DataSection lastBackup={settings.lastBackup} />}
        {page === 'appearance' && <AppearanceSection settings={settings} />}
      </SubPage>
    )
  }

  return <SettingsMenu settings={settings} user={account.status === 'signedIn' ? account.user : null} />
}

// ---------- Menú principal ----------

function SettingsMenu({
  settings,
  user,
}: {
  settings: Settings
  user: { displayName: string | null; email: string } | null
}) {
  const s = t.settings
  const m = s.menu
  const r = settings.reminders
  const remindersOn = [
    r.periodEnabled,
    r.dailyEnabled,
    r.pillEnabled,
    r.fertileEnabled,
    r.breastExamEnabled,
    r.temperatureEnabled,
    r.weightEnabled,
    r.medicationEnabled,
    r.checkupEnabled,
    r.contraception.method !== 'none',
  ].filter(Boolean).length
  const tracked = (Object.keys(settings.tracking) as (keyof Settings['tracking'])[])
    .filter((k) => settings.tracking[k])
    .map((k) => t.tracking.items[k].label)
  const security = [
    settings.pinHash ? m.pinOn : m.pinOff,
    settings.biometric ? m.biometricOn : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <main className="mx-auto w-full max-w-md space-y-5 px-4 pt-6 pb-4">
      <h1 className="text-2xl font-extrabold">{s.title}</h1>

      {user && (
        <MenuGroup>
          <MenuRow
            page="account"
            icon="user"
            title={user.displayName ?? t.account.section}
            summary={user.email}
          />
        </MenuGroup>
      )}

      <InstallSection />

      <MenuGroup title={m.groups.cycle}>
        <MenuRow
          page="cycle"
          icon="calendar"
          title={s.pages.cycle}
          summary={`${t.modes.options[settings.mode].label} · ${settings.manualPrediction ? m.predictionManual : m.predictionAuto}`}
        />
        <MenuRow page="tracking" icon="list" title={s.pages.tracking} summary={tracked.length ? tracked.join(', ') : m.trackingBasic} />
        <MenuRow
          page="reminders"
          icon="bell"
          title={s.pages.reminders}
          summary={remindersOn ? m.remindersOn(remindersOn) : m.remindersOff}
        />
      </MenuGroup>

      <MenuGroup title={m.groups.privacy}>
        <MenuRow page="security" icon="lock" title={s.pages.security} summary={security} />
      </MenuGroup>

      <MenuGroup title={m.groups.data}>
        <MenuRow
          page="backup"
          icon="share"
          title={s.pages.backup}
          summary={settings.lastBackup ? s.lastBackup(formatFullDate(settings.lastBackup)) : m.backupSummary}
        />
        <MenuRow href="#/report" icon="file" title={m.report} summary={m.reportSummary} />
      </MenuGroup>

      <MenuGroup title={m.groups.app}>
        <MenuRow
          page="appearance"
          icon="palette"
          title={s.pages.appearance}
          summary={`${s.themes[settings.theme]} · ${s.languages[lang]}`}
        />
      </MenuGroup>
    </main>
  )
}

function MenuGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      {title && <h2 className="mb-2 px-1 text-sm font-extrabold text-muted">{title}</h2>}
      <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface shadow-sm">{children}</ul>
    </section>
  )
}

function MenuRow({
  page,
  href,
  icon,
  title,
  summary,
}: {
  page?: Page
  href?: string
  icon: IconName
  title: string
  summary?: string
}) {
  return (
    <li>
      <a
        href={href ?? `#/settings/${page}`}
        className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-soft"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-ink" aria-hidden="true">
          <Icon name={icon} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{title}</span>
          {summary && <span className="block truncate text-sm text-muted">{summary}</span>}
        </span>
        <Icon name="chevronRight" className="size-5 shrink-0 text-muted" />
      </a>
    </li>
  )
}

/** Página de un apartado, con "‹ Ajustes" para volver al menú. */
function SubPage({ title, children }: { title: string; children: ReactNode }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => titleRef.current?.focus(), [title])
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-4">
      <a
        href="#/settings"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 font-bold text-primary hover:bg-surface-soft"
      >
        <Icon name="chevronLeft" className="size-5" />
        {t.settings.title}
      </a>
      <h1 ref={titleRef} tabIndex={-1} className="mt-2 text-2xl font-extrabold">
        {title}
      </h1>
      <PageTitle.Provider value={title}>
        <div className="mt-4 space-y-4">{children}</div>
      </PageTitle.Provider>
    </main>
  )
}

// ---------- Apartados propios de esta pantalla ----------

function CycleSection({ settings }: { settings: Settings }) {
  const s = t.settings
  const unknown = settings.cycleLength === null && settings.periodLength === null
  return (
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
        id="set-luteal"
        label={s.lutealPhase}
        help={s.lutealPhaseHelp}
        value={settings.lutealPhase}
        min={LUTEAL_RANGE.min}
        max={LUTEAL_RANGE.max}
        unit={t.common.days}
        onChange={(n) => void setSettings({ lutealPhase: n })}
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
        <div>
          <label htmlFor="ignore-long" className="mb-1 block font-bold">
            {s.ignoreLong}
          </label>
          <p id="ignore-long-hint" className="mb-2 text-sm text-muted">
            {s.ignoreLongHint}
          </p>
          <select
            id="ignore-long"
            aria-describedby="ignore-long-hint"
            value={settings.ignoreCyclesOver ?? 'auto'}
            onChange={(e) =>
              void setSettings({ ignoreCyclesOver: e.target.value === 'auto' ? null : Number(e.target.value) })
            }
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
          >
            <option value="auto">{s.ignoreLongAuto}</option>
            {IGNORE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {s.ignoreLongOver(n)}
              </option>
            ))}
          </select>
        </div>
      )}
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
  )
}

function AppearanceSection({ settings }: { settings: Settings }) {
  const s = t.settings
  return (
    <Section title={s.pages.appearance}>
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
  )
}
