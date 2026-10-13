/**
 * Cálculo de instantes a una hora local en una zona horaria (sin dependencias),
 * teniendo en cuenta los cambios de horario de verano.
 */

/** Fecha local (YYYY-MM-DD) de un instante en una zona horaria. */
export function localDate(now: Date, timezone: string): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(now)
}

export function addDaysISO(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Diferencia (ms) entre la hora local de `timezone` y UTC en el instante `at`. */
function offsetMs(at: Date, timezone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/** Instante UTC correspondiente a `ymd` a las `hhmm` (hora local de `timezone`). */
export function zonedToUtc(ymd: string, hhmm: string, timezone: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const naive = Date.UTC(y, m - 1, d, h, mi)
  // Dos pasadas para acertar también en los días de cambio de hora.
  let t = naive - offsetMs(new Date(naive), timezone)
  t = naive - offsetMs(new Date(t), timezone)
  return new Date(t)
}

/** Próxima vez (estrictamente después de `after`) que son las `hhmm` en `timezone`. */
export function nextOccurrence(hhmm: string, timezone: string, after: Date): Date {
  const today = localDate(after, timezone)
  const candidate = zonedToUtc(today, hhmm, timezone)
  return candidate > after ? candidate : zonedToUtc(addDaysISO(today, 1), hhmm, timezone)
}
