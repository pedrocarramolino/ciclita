import { parseISODate, type ISODate } from '../../domain/dates'

/** Mes con el que abrir el calendario la próxima vez (se consume al leerlo). */
let pending: { y: number; m: number } | null = null

/** Abre el calendario en el mes de `date` (por ejemplo, desde un aviso del inicio). */
export function openCalendarAt(date: ISODate) {
  const d = parseISODate(date)
  pending = { y: d.getFullYear(), m: d.getMonth() }
  location.hash = '#/calendar'
}

export function takeCalendarFocus(): { y: number; m: number } | null {
  const f = pending
  pending = null
  return f
}
