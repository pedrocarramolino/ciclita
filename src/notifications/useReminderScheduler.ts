import { useEffect } from 'react'
import { runReminders } from './notify'

const CHECK_EVERY_MS = 60_000

/**
 * Comprueba los recordatorios al abrir la app, al volver a ella y cada minuto
 * mientras está abierta (también en segundo plano, si el sistema no la suspende).
 */
export function useReminderScheduler(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    const check = () => void runReminders().catch(() => {})
    check()
    const id = setInterval(check, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [enabled])
}
