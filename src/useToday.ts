import { useEffect, useState } from 'react'
import { today, type ISODate } from './domain/dates'

/**
 * Fecha de hoy que se actualiza sola: al volver a la app (una PWA puede quedarse días
 * abierta en segundo plano) y a medianoche si está a la vista.
 */
export function useToday(): ISODate {
  const [day, setDay] = useState(today)
  useEffect(() => {
    const refresh = () => setDay(today())
    const onVisible = () => !document.hidden && refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    // Programa la comprobación para justo después de la próxima medianoche.
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
    const id = setTimeout(refresh, midnight.getTime() - now.getTime())
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
      clearTimeout(id)
    }
  }, [day])
  return day
}
