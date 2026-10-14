import { useLayoutEffect, useRef, useState } from 'react'

/** Ancho disponible del contenedor, actualizado al girar el móvil o cambiar el tamaño. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  // useLayoutEffect: se mide antes de pintar, así la gráfica aparece en el primer
  // fotograma sin esperar al primer aviso del ResizeObserver.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(Math.round(el.getBoundingClientRect().width))
    const obs = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, width] as const
}
