import { describe, expect, it } from 'vitest'
import { buildIcs } from './ics'

const NOW = new Date(Date.UTC(2026, 9, 16, 8, 0, 0))

describe('archivo de calendario de una cita', () => {
  it('con hora: evento de una hora a la hora local, lugar, notas y aviso', () => {
    const ics = buildIcs(
      {
        id: 'abc',
        date: '2026-10-22',
        time: '10:30',
        place: 'Centro de salud, consulta 3',
        notes: 'Preguntar; analítica\nY la vitamina D',
        reminder: { date: '2026-10-21', time: '20:00' },
      },
      'Ecografía · Dra. López',
      NOW,
    )
    const lines = ics.split('\r\n')
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('UID:abc@ciclita')
    expect(lines).toContain('DTSTAMP:20261016T080000Z')
    expect(lines).toContain('DTSTART:20261022T103000')
    expect(lines).toContain('DTEND:20261022T113000')
    expect(lines).toContain('SUMMARY:Ecografía · Dra. López')
    expect(lines).toContain(String.raw`LOCATION:Centro de salud\, consulta 3`)
    expect(lines).toContain(String.raw`DESCRIPTION:Preguntar\; analítica\nY la vitamina D`)
    expect(lines).toContain('BEGIN:VALARM')
    expect(lines.some((l) => l.startsWith('TRIGGER;VALUE=DATE-TIME:20261021T') && l.endsWith('Z'))).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })

  it('sin hora: evento de todo el día y sin aviso', () => {
    const ics = buildIcs({ id: 'x', date: '2026-12-31', time: null, reminder: null }, 'Análisis', NOW)
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231')
    expect(ics).toContain('DTEND;VALUE=DATE:20270101')
    expect(ics).not.toContain('VALARM')
  })

  it('parte las líneas largas a 75 bytes', () => {
    const ics = buildIcs({ id: 'y', date: '2026-12-31', time: null, reminder: null, notes: 'á'.repeat(200) }, 'X', NOW)
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })
})
