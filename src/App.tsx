import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { BottomNav } from './components/BottomNav'
import { Splash } from './components/Splash'
import { UpdatePrompt } from './components/UpdatePrompt'
import { getSettings, type Theme } from './db/settings'
import { CalendarScreen } from './features/calendar/CalendarScreen'
import { Home } from './features/home/Home'
import { LockScreen } from './features/lock/LockScreen'
import type { PinCheck } from './features/lock/pinCheck'
import { flushVault, getVaultRow, isVaultUnlocked, unlockVault, vaultLockStore } from './db/vault'
import { requestPersistence } from './db/persist'
import { reminderPillPack } from './domain/pill'
import { usePushSync } from './push/usePushSync'
import { preloadable } from './preloadable'
import { useHashRoute } from './useHashRoute'
import { usePrediction } from './usePrediction'

// Pantallas que no hacen falta al arrancar: se cargan cuando se abren (el service
// worker ya las tiene en caché, así que aparecen al instante). Ajustes incluye PIN,
// copias de seguridad y push.
const stats = preloadable(() => import('./features/stats/StatsScreen').then((m) => m.StatsScreen))
const settingsScreen = preloadable(() =>
  import('./features/settings/SettingsScreen').then((m) => m.SettingsScreen),
)
const reportScreen = preloadable(() => import('./features/report/ReportScreen').then((m) => m.ReportScreen))
const searchScreen = preloadable(() => import('./features/search/SearchScreen').then((m) => m.SearchScreen))
const SearchScreen = searchScreen.Component
const StatsScreen = stats.Component
const ReportScreen = reportScreen.Component
const SettingsScreen = settingsScreen.Component

/** Precarga las pantallas diferidas cuando la app queda libre tras abrirse. */
function usePreloadScreens(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const preload = () =>
      void Promise.all([stats.preload(), settingsScreen.preload(), reportScreen.preload(), searchScreen.preload()]).catch(() => {})
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(preload, { timeout: 3000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(preload, 1500)
    return () => clearTimeout(id)
  }, [enabled])
}
const Onboarding = lazy(() =>
  import('./features/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })),
)

/** Tiempo fuera de la app tras el cual se vuelve a pedir el PIN. */
const RELOCK_AFTER_MS = 60_000

/** Aplica el tema en <html>; en "automático" sigue al sistema. */
function useTheme(theme: Theme | undefined) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || ((theme ?? 'system') === 'system' && mq.matches)
      document.documentElement.classList.toggle('dark', dark)
      // Color de la barra del sistema acorde al tema (crema / ciruela).
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1f141d' : '#fbf6f0')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])
}

/**
 * Bloqueo por PIN: se bloquea al abrir la app y al volver tras más de 1 minuto
 * fuera. Activar el PIN desde ajustes no bloquea la sesión en curso.
 */
function useAppLock(pinHash: string | null | undefined, startUnlocked: boolean): [boolean, () => void] {
  const [locked, setLocked] = useState<boolean | null>(startUnlocked ? false : null)
  const hasPin = useRef(false)
  useEffect(() => {
    hasPin.current = !!pinHash
  }, [pinHash])

  if (locked === null && pinHash !== undefined) setLocked(!!pinHash)

  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hasPin.current && hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) {
        // Con los datos cifrados, bloquear es recargar: así la copia descifrada en
        // memoria desaparece y hay que volver a introducir el PIN para descifrar.
        if (isVaultUnlocked()) void flushVault().finally(() => location.reload())
        else setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return [!!locked && !!pinHash, () => setLocked(false)]
}

/**
 * Con el cifrado activado, primero se pide el PIN para descifrar la bóveda; la app
 * se monta después, ya leyendo de la copia descifrada en memoria.
 */
export default function App({ encrypted }: { encrypted: boolean }) {
  const [unlocked, setUnlocked] = useState(!encrypted)
  return unlocked ? <MainApp startUnlocked={encrypted} /> : <VaultGate onUnlock={() => setUnlocked(true)} />
}

const vaultPinCheck = (): PinCheck => {
  const store = vaultLockStore()
  return { verify: (pin) => unlockVault(pin), getState: store.get, setState: store.set }
}

function VaultGate({ onUnlock }: { onUnlock: () => void }) {
  const [check] = useState(vaultPinCheck)
  const theme = useLiveQuery(async () => ((await getVaultRow())?.theme ?? 'system') as Theme)
  useTheme(theme)
  return (
    <>
      <LockScreen onUnlock={onUnlock} check={check} encrypted />
      <UpdatePrompt />
      <Splash ready />
    </>
  )
}

function MainApp({ startUnlocked }: { startUnlocked: boolean }) {
  const settings = useLiveQuery(() => getSettings())
  const [route, navigate] = useHashRoute()
  const [locked, unlock] = useAppLock(settings?.pinHash, startUnlocked)
  useTheme(settings?.theme)
  const prediction = usePrediction()
  usePushSync(
    settings?.onboardingDone ? settings.reminders : undefined,
    prediction,
    settings?.mode,
    settings && [settings.tracking.pill, reminderPillPack(settings.tracking.pill, settings.pill)],
  )
  usePreloadScreens(!!settings?.onboardingDone)
  // Una vez que hay datos, se pide al navegador que no los borre para liberar espacio.
  const onboardingDone = !!settings?.onboardingDone
  useEffect(() => {
    if (onboardingDone) void requestPersistence()
  }, [onboardingDone])

  let screen: ReactNode
  if (!settings) screen = null // cargando IndexedDB
  else if (locked) screen = <LockScreen onUnlock={unlock} />
  else if (!settings.onboardingDone)
    screen = (
      <Suspense fallback={null}>
        <Onboarding />
      </Suspense>
    )
  else
    screen = (
      <div className="min-h-dvh pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {route === 'home' && <Home />}
        {route === 'calendar' && <CalendarScreen />}
        {route === 'stats' && (
          <Suspense fallback={null}>
            <StatsScreen />
          </Suspense>
        )}
        {route === 'search' && (
          <Suspense fallback={null}>
            <SearchScreen />
          </Suspense>
        )}
        {route === 'report' && (
          <Suspense fallback={null}>
            <ReportScreen />
          </Suspense>
        )}
        {route === 'settings' && (
          <Suspense fallback={null}>
            <SettingsScreen />
          </Suspense>
        )}
        <BottomNav route={route} onNavigate={navigate} />
      </div>
    )

  // El service worker (UpdatePrompt) se registra en todas las pantallas, también en el onboarding.
  return (
    <>
      {screen}
      <UpdatePrompt />
      {/* Animación de apertura: tapa la carga inicial y se desvanece. */}
      <Splash ready={!!settings} />
    </>
  )
}
