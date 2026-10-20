import { describe, expect, it } from 'vitest'
import type { DayLog } from '../db/db'
import { pressureSummary } from './bloodPressure'

const TODAY = '2026-10-20'
const d = (date: string, systolic?: number, diastolic?: number, pulse?: number): DayLog => ({
  date,
  systolic,
  diastolic,
  pulse,
  updatedAt: 0,
})

describe('resumen de tensión y pulso', () => {
  it('sin tomas no hay resumen', () => {
    expect(pressureSummary([{ date: TODAY, notes: 'x', updatedAt: 0 }], TODAY)).toBeNull()
  })

  it('la última toma y las medias de los últimos 30 días', () => {
    const s = pressureSummary([d('2026-08-01', 150, 95), d('2026-10-01', 118, 76, 70), d('2026-10-19', 122, 80, 74)], TODAY)!
    expect(s.last.date).toBe('2026-10-19')
    expect(s.recent).toEqual({ count: 2, systolic: 120, diastolic: 78, pulse: 72 })
    expect(s.readings).toHaveLength(3)
    expect(s.high).toBe(false)
  })

  it('avisa si la media reciente llega a 140/90 con al menos 3 tomas', () => {
    expect(pressureSummary([d('2026-10-10', 142, 88), d('2026-10-15', 145, 92)], TODAY)!.high).toBe(false)
    expect(pressureSummary([d('2026-10-10', 142, 88), d('2026-10-15', 145, 92), d('2026-10-18', 138, 91)], TODAY)!.high).toBe(true)
  })
})
