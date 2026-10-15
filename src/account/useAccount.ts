import { useEffect, useState, useSyncExternalStore } from 'react'
import { watchAccount, type AccountState } from './account'
import { startAutoSync } from './sync'

/** Estado de la sesión (cargando, sin sesión o con sesión). */
export function useAccount(): AccountState {
  const [state, setState] = useState<AccountState>({ status: 'loading' })
  useEffect(() => watchAccount(setState), [])
  return state
}

export type SyncStatus = 'ok' | 'error'

// Estado de la última sincronización, compartido entre pantallas (Ajustes lo muestra).
let syncStatus: SyncStatus = 'ok'
const syncListeners = new Set<() => void>()
function setSyncStatus(s: SyncStatus) {
  if (s === syncStatus) return
  syncStatus = s
  syncListeners.forEach((l) => l())
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      syncListeners.add(cb)
      return () => syncListeners.delete(cb)
    },
    () => syncStatus,
  )
}

/** Tiempo máximo esperando la primera sincronización (sin conexión se sigue con lo local). */
const FIRST_SYNC_TIMEOUT_MS = 8000

/**
 * Mantiene sincronizados los datos con la cuenta mientras haya sesión. Devuelve si ya
 * se puede mostrar la app: en un dispositivo que aún no se ha sincronizado con esta
 * cuenta se espera a traer sus datos (para no pedir otra vez la bienvenida).
 */
export function useAutoSync(uid: string | null, enabled: boolean, syncedBefore: boolean): boolean {
  const [readyFor, setReadyFor] = useState<string | null>(null)
  useEffect(() => {
    if (!uid || !enabled) return
    const ready = () => setReadyFor(uid)
    const timer = setTimeout(ready, FIRST_SYNC_TIMEOUT_MS)
    const stop = startAutoSync(uid, (e) => setSyncStatus(e ? 'error' : 'ok'), ready)
    return () => {
      clearTimeout(timer)
      stop()
    }
  }, [uid, enabled])
  return !!uid && (syncedBefore || readyFor === uid)
}
