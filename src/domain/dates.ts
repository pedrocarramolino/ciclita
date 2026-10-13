/**
 * Utilidades de fechas. Todas las fechas de calendario se guardan como cadenas
 * 'YYYY-MM-DD' en hora local, para evitar desfases por zona horaria.
 */

export type ISODate = string

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function today(): ISODate {
  return toISODate(new Date())
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1)

/** "Martes, 13 de octubre" */
export function formatLong(s: ISODate): string {
  return capitalize(
    new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(
      parseISODate(s),
    ),
  )
}

/** "13 de octubre" */
export function formatDayMonth(s: ISODate): string {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long' }).format(parseISODate(s))
}

/** "Octubre de 2026" */
export function formatMonthYear(year: number, month: number): string {
  return capitalize(
    new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(new Date(year, month, 1)),
  )
}

/** Días enteros de `a` a `b` (positivo si b es posterior). */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime()
  return Math.round(ms / 86_400_000)
}
