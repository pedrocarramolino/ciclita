import { useEffect, useState } from 'react'

function read<K extends string>(names: readonly K[]): Record<K, string> {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(names.map((n) => [n, style.getPropertyValue(`--${n}`).trim()])) as Record<K, string>
}

/**
 * Lee variables CSS del tema y se actualiza al cambiar entre claro y oscuro.
 * Necesario para librerías (Recharts) que pintan colores como atributos SVG.
 */
export function useCssVars<K extends string>(names: readonly K[]): Record<K, string> {
  const [vars, setVars] = useState(() => read(names))
  useEffect(() => {
    const obs = new MutationObserver(() => setVars(read(names)))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [names])
  return vars
}
