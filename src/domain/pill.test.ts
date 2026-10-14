import { describe, expect, it } from 'vitest'
import type { DayLog } from '../db/db'
import { missedPillDates, pillAdherence, pillDay } from './pill'

const log = (date: string): DayLog => ({ date, pillTaken: true, updatedAt: 0 })

describe('pillDay', () => {
  it('cuenta los días del envase y los de descanso', () => {
    const cfg = { pack: 21 as const, start: '2026-10-01' }
    expect(pillDay('2026-09-30', cfg)).toBeNull()
    expect(pillDay('2026-10-01', cfg)).toEqual({ day: 1, active: true })
    expect(pillDay('2026-10-21', cfg)).toEqual({ day: 21, active: true })
    expect(pillDay('2026-10-22', cfg)).toEqual({ day: 22, active: false })
    expect(pillDay('2026-10-29', cfg)).toEqual({ day: 1, active: true })
  })

  it('con 24 + 4 descansa 4 días y con 28 nunca', () => {
    expect(pillDay('2026-10-25', { pack: 24, start: '2026-10-01' })?.active).toBe(false)
    expect(pillDay('2026-10-24', { pack: 24, start: '2026-10-01' })?.active).toBe(true)
    expect(pillDay('2026-10-28', { pack: 28, start: '2026-10-01' })?.active).toBe(true)
  })
})

describe('pillAdherence', () => {
  const cfg = { pack: 21 as const, start: '2026-09-01' }

  it('cuenta tomas y olvidos; hoy sin marcar aún no es un olvido', () => {
    const days = [log('2026-09-01'), log('2026-09-02'), log('2026-09-04')]
    expect(pillAdherence(days, cfg, '2026-09-01', '2026-09-05')).toEqual({
      expected: 4,
      taken: 3,
      missed: ['2026-09-03'],
    })
  })

  it('no cuenta los días de descanso ni los anteriores al inicio', () => {
    const r = pillAdherence([], cfg, '2026-08-01', '2026-09-28')
    expect(r.expected).toBe(21)
    expect(r.missed.at(-1)).toBe('2026-09-01')
    expect(r.missed[0]).toBe('2026-09-21')
  })
})

describe('missedPillDates', () => {
  it('solo días pasados, activos y sin marcar dentro del intervalo', () => {
    const cfg = { pack: 21 as const, start: '2026-09-01' }
    const r = missedPillDates([log('2026-09-02')], cfg, '2026-08-25', '2026-09-30', '2026-09-04')
    expect([...r]).toEqual(['2026-09-01', '2026-09-03'])
  })
})
