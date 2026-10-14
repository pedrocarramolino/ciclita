import { useEffect, useRef } from 'react'

/**
 * Ejecuta `action` cuando la dirección es `hash` (al abrir la pantalla o si cambia
 * con la app ya abierta, p. ej. desde una notificación) y la deja en `#/home`.
 */
export function useHashAction(hash: string, action: () => void) {
  const ref = useRef(action)
  useEffect(() => {
    ref.current = action
  })
  useEffect(() => {
    const check = () => {
      if (window.location.hash !== hash) return
      history.replaceState(null, '', '#/home')
      ref.current()
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [hash])
}
