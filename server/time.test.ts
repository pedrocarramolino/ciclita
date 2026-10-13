import { describe, expect, it } from 'vitest'
import { addDaysISO, localDate, nextOccurrence, zonedToUtc } from './time.js'

const MAD = 'Europe/Madrid'

describe('zonedToUtc', () => {
  it('horario de verano (UTC+2) y de invierno (UTC+1) en Madrid', () => {
    expect(zonedToUtc('2026-07-01', '21:00', MAD).toISOString()).toBe('2026-07-01T19:00:00.000Z')
    expect(zonedToUtc('2026-12-01', '21:00', MAD).toISOString()).toBe('2026-12-01T20:00:00.000Z')
  })

  it('el día del cambio de hora', () => {
    // 25/10/2026: a las 3:00 vuelven a ser las 2:00. A las 9:00 ya es UTC+1.
    expect(zonedToUtc('2026-10-25', '09:00', MAD).toISOString()).toBe('2026-10-25T08:00:00.000Z')
  })

  it('otras zonas horarias', () => {
    expect(zonedToUtc('2026-10-13', '08:30', 'America/Mexico_City').toISOString()).toBe('2026-10-13T14:30:00.000Z')
  })
})

describe('nextOccurrence', () => {
  it('hoy si aún no ha pasado la hora; mañana si ya pasó', () => {
    const now = new Date('2026-10-13T10:00:00Z') // 12:00 en Madrid
    expect(nextOccurrence('21:00', MAD, now).toISOString()).toBe('2026-10-13T19:00:00.000Z')
    expect(nextOccurrence('09:00', MAD, now).toISOString()).toBe('2026-10-14T07:00:00.000Z')
  })

  it('justo a la hora exacta pasa al día siguiente', () => {
    const now = new Date('2026-10-13T19:00:00Z')
    expect(nextOccurrence('21:00', MAD, now).toISOString()).toBe('2026-10-14T19:00:00.000Z')
  })

  it('cruza el cambio de hora manteniendo la hora local', () => {
    const now = new Date('2026-10-24T19:30:00Z') // sábado 21:30 en Madrid (UTC+2)
    expect(nextOccurrence('21:00', MAD, now).toISOString()).toBe('2026-10-25T20:00:00.000Z') // domingo, ya UTC+1
  })
})

describe('utilidades de fecha', () => {
  it('localDate y addDaysISO', () => {
    expect(localDate(new Date('2026-10-27T23:30:00Z'), MAD)).toBe('2026-10-28')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
  })
})
