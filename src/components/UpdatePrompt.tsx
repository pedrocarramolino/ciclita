import { useRegisterSW } from 'virtual:pwa-register/react'
import { t } from '../i18n'
import { Button } from './Button'

/** Cada cuánto se buscan versiones nuevas mientras la app está abierta. */
const UPDATE_CHECK_MS = 60 * 60 * 1000

/**
 * Busca versiones nuevas al volver a la app y periódicamente. En una PWA instalada,
 * volver desde "apps recientes" no recarga la página, así que el navegador no lo
 * comprobaría por sí solo.
 */
function watchForUpdates(registration: ServiceWorkerRegistration) {
  const check = () => {
    if (navigator.onLine) void registration.update().catch(() => {})
  }
  setInterval(check, UPDATE_CHECK_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}

/**
 * Registra el service worker y, cuando hay una versión nueva descargada, pregunta
 * antes de activarla (así no se recarga la app en mitad de un registro).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW: (_url, registration) => {
      if (registration) watchForUpdates(registration)
    },
  })

  if (!needRefresh && !offlineReady) return null
  const u = t.update

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-4 shadow-xl"
    >
      <p className="font-bold">{needRefresh ? u.available : u.offlineReady}</p>
      <div className="mt-3 flex gap-2">
        {needRefresh && (
          <Button className="min-h-11 flex-1" onClick={() => void updateServiceWorker(true)}>
            {u.reload}
          </Button>
        )}
        <Button
          variant="ghost"
          className="min-h-11"
          onClick={() => {
            setNeedRefresh(false)
            setOfflineReady(false)
          }}
        >
          {needRefresh ? u.later : u.ok}
        </Button>
      </div>
    </div>
  )
}
