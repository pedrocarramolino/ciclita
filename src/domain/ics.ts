/**
 * Archivo de calendario (.ics, iCalendar RFC 5545) de una cita médica, para añadirla
 * al calendario del móvil (Calendario de iPhone, Google Calendar…). Se genera en el
 * dispositivo: nada pasa por ningún servidor.
 */
import type { Appointment } from '../db/db'
import { addDays, type ISODate } from './dates'

/** Duración por defecto de la cita en el calendario. */
const DURATION_MIN = 60

/** Texto escapado según iCalendar (barra, punto y coma, coma y saltos de línea). */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Las líneas de más de 75 bytes se parten (las siguientes empiezan con un espacio). */
function fold(line: string): string {
  const bytes = new TextEncoder()
  const out: string[] = []
  let current = ''
  for (const ch of line) {
    if (bytes.encode(current + ch).length > (out.length ? 74 : 75)) {
      out.push(current)
      current = ch
    } else current += ch
  }
  out.push(current)
  return out.join('\r\n ')
}

const compactDate = (d: ISODate) => d.replace(/-/g, '')
const pad = (n: number) => String(n).padStart(2, '0')

/** Fecha y hora "flotante" (la hora local del dispositivo): 20261022T103000. */
function localStamp(date: ISODate, time: string, plusMinutes = 0): string {
  const [y, m, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const dt = new Date(y, m - 1, d, h, mi + plusMinutes)
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`
}

/** Instante en UTC: 20261021T180000Z. */
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function buildIcs(
  a: Pick<Appointment, 'id' | 'date' | 'time' | 'place' | 'notes' | 'reminder'>,
  summary: string,
  now: Date = new Date(),
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ciclita//Citas medicas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${a.id}@ciclita`,
    `DTSTAMP:${utcStamp(now)}`,
    ...(a.time
      ? [`DTSTART:${localStamp(a.date, a.time)}`, `DTEND:${localStamp(a.date, a.time, DURATION_MIN)}`]
      : [`DTSTART;VALUE=DATE:${compactDate(a.date)}`, `DTEND;VALUE=DATE:${compactDate(addDays(a.date, 1))}`]),
    `SUMMARY:${esc(summary)}`,
    ...(a.place ? [`LOCATION:${esc(a.place)}`] : []),
    ...(a.notes ? [`DESCRIPTION:${esc(a.notes)}`] : []),
  ]
  if (a.reminder) {
    const [y, m, d] = a.reminder.date.split('-').map(Number)
    const [h, mi] = a.reminder.time.split(':').map(Number)
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(summary)}`,
      `TRIGGER;VALUE=DATE-TIME:${utcStamp(new Date(y, m - 1, d, h, mi))}`,
      'END:VALARM',
    )
  }
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
