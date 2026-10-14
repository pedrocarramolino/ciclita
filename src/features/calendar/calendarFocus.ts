import { parseISODate, type ISODate } from '../../domain/dates'

/** Mes con el que abrir el calendario la próxima vez (se borra al montarlo). */
let pending: { y: number; m: number } | null = null

/** Abre el calendario en el mes de `date` (por ejemplo, desde un aviso del inicio). */
export function openCalendarAt(date: ISODate) {
  const d = parseISODate(date)
  pending = { y: d.getFullYear(), m: d.getMonth() }
  location.hash = '#/calendar'
}

/** Lectura sin efectos (válida dentro de un inicializador de estado). */
export function peekCalendarFocus(): { y: number; m: number } | null {
  return pending
}

export function clearCalendarFocus() {
  pending = null
}
