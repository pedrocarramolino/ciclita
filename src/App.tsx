import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect } from 'react'
import { BottomNav } from './components/BottomNav'
import { getSettings, type Theme } from './db/settings'
import { CalendarScreen } from './features/calendar/CalendarScreen'
import { Home } from './features/home/Home'
import { Onboarding } from './features/onboarding/Onboarding'
import { useHashRoute } from './useHashRoute'

// Recharts pesa bastante: la pantalla de estadísticas se carga solo cuando se abre.
const StatsScreen = lazy(() =>
  import('./features/stats/StatsScreen').then((m) => ({ default: m.StatsScreen })),
)

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

export default function App() {
  const settings = useLiveQuery(() => getSettings())
  const [route, navigate] = useHashRoute()
  useTheme(settings?.theme)

  if (!settings) return null // cargando IndexedDB
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
      <BottomNav route={route} onNavigate={navigate} />
    </div>
  )
}
