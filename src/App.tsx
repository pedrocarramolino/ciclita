import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { getSettings, type Theme } from './db/settings'
import { CalendarScreen } from './features/calendar/CalendarScreen'
import { Home } from './features/home/Home'
import { LockScreen } from './features/lock/LockScreen'
import { Onboarding } from './features/onboarding/Onboarding'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { useReminderScheduler } from './notifications/useReminderScheduler'
import { useHashRoute } from './useHashRoute'

// Recharts pesa bastante: la pantalla de estadísticas se carga solo cuando se abre.
const StatsScreen = lazy(() =>
  import('./features/stats/StatsScreen').then((m) => ({ default: m.StatsScreen })),
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
function useAppLock(pinHash: string | null | undefined): [boolean, () => void] {
  const [locked, setLocked] = useState<boolean | null>(null)
  const hasPin = useRef(false)
  useEffect(() => {
    hasPin.current = !!pinHash
  }, [pinHash])

  if (locked === null && pinHash !== undefined) setLocked(!!pinHash)

  useEffect(() => {
    let hiddenAt = 0
    const onVisibility = () => {
      if (document.hidden) hiddenAt = Date.now()
      else if (hasPin.current && hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return [!!locked && !!pinHash, () => setLocked(false)]
}

export default function App() {
  const settings = useLiveQuery(() => getSettings())
  const [route, navigate] = useHashRoute()
  const [locked, unlock] = useAppLock(settings?.pinHash)
  useTheme(settings?.theme)
  useReminderScheduler(!!settings?.onboardingDone)

  if (!settings) return null // cargando IndexedDB
  if (locked) return <LockScreen onUnlock={unlock} />
  if (!settings.onboardingDone) return <Onboarding />

  return (
    <div className="min-h-dvh pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {route === 'home' && <Home />}
      {route === 'calendar' && <CalendarScreen />}
      {route === 'stats' && (
        <Suspense fallback={null}>
          <StatsScreen />
        </Suspense>
      )}
      {route === 'settings' && <SettingsScreen />}
      <BottomNav route={route} onNavigate={navigate} />
    </div>
  )
}
