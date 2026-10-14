import { parseISODate, type ISODate } from '../../domain/dates'

export interface CalendarFocus {
  y: number
  m: number
  /** Abrir directamente en "Editar periodos". */
  edit?: boolean
}

/** Mes con el que abrir el calendario la próxima vez (se borra al montarlo). */
let pending: CalendarFocus | null = null

/** Abre el calendario en el mes de `date` (por ejemplo, desde un aviso del inicio). */
export function openCalendarAt(date: ISODate, { edit = false }: { edit?: boolean } = {}) {
  const d = parseISODate(date)
  pending = { y: d.getFullYear(), m: d.getMonth(), edit }
  location.hash = '#/calendar'
}

/** Lectura sin efectos (válida dentro de un inicializador de estado). */
export function peekCalendarFocus(): CalendarFocus | null {
  return pending
}

export function clearCalendarFocus() {
  pending = null
}
