import { startTransition, useCallback, useEffect, useState } from 'react'

/**
 * Navegación mínima basada en el hash (#/calendar). Funciona en cualquier
 * hosting estático sin reglas de reescritura y respeta el botón "atrás".
 */
export const ROUTES = ['home', 'calendar', 'stats', 'settings'] as const
export type Route = (typeof ROUTES)[number]

function read(): Route {
  const r = window.location.hash.replace(/^#\/?/, '')
  return (ROUTES as readonly string[]).includes(r) ? (r as Route) : 'home'
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(read)

  useEffect(() => {
    // Como transición: si la pantalla nueva aún se está cargando, React mantiene la
    // actual en lugar de mostrar un hueco vacío.
    const onChange = () => startTransition(() => setRoute(read()))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = useCallback((r: Route) => {
    if (r !== read()) window.location.hash = `/${r}`
    window.scrollTo(0, 0)
  }, [])

  return [route, navigate]
}
