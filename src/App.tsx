import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { getSettings, type Theme } from './db/settings'
import { Home } from './features/home/Home'
import { Onboarding } from './features/onboarding/Onboarding'

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
  useTheme(settings?.theme)

  if (!settings) return null // cargando IndexedDB
  return settings.onboardingDone ? <Home /> : <Onboarding />
}
