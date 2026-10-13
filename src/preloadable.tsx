import { lazy, type ComponentType } from 'react'

/**
 * Como React.lazy, pero con precarga: si el código ya se descargó con `preload()`,
 * el componente se pinta directamente, sin "suspender". Con React.lazy a secas, la
 * primera vez que se muestra siempre suspende y React retrasa ~300 ms la aparición
 * de la pantalla aunque el código ya esté en memoria.
 */
export function preloadable<P extends object>(load: () => Promise<ComponentType<P>>) {
  let Loaded: ComponentType<P> | null = null
  let pending: Promise<ComponentType<P>> | null = null

  const preload = () => {
    pending ??= load().then((c) => (Loaded = c))
    return pending
  }
  const Lazy = lazy(() => preload().then((c) => ({ default: c })))

  function Component(props: P) {
    return Loaded ? <Loaded {...props} /> : <Lazy {...props} />
  }
  return { Component, preload }
}
