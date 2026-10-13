import { useEffect } from 'react'
import type { ReminderSettings } from '../db/settings'
import type { Prediction } from '../domain/prediction'
import { syncPush } from './pushClient'

/**
 * Mantiene sincronizados los recordatorios con el servidor: al abrir la app y cada
 * vez que cambian los ajustes de recordatorios o el próximo periodo previsto.
 */
export function usePushSync(reminders: ReminderSettings | undefined, prediction: Prediction | undefined) {
  const key = reminders && prediction ? JSON.stringify([reminders, prediction.nextPeriods[0], prediction.status.kind]) : null

  useEffect(() => {
    if (!key || !prediction) return
    const id = setTimeout(() => void syncPush(prediction), 800)
    return () => clearTimeout(id)
    // `key` resume lo que importa de `prediction` y `reminders`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
