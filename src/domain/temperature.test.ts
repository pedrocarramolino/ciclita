import { describe, expect, it } from 'vitest'
import type { DayLog } from '../db/db'
import { addDays } from './dates'
import { detectShift, temperatureCycles, type TempPoint } from './temperature'

const pts = (temps: number[], firstDay = 1): TempPoint[] =>
  temps.map((temp, i) => ({ date: addDays('2026-09-01', firstDay + i - 1), day: firstDay + i, temp }))

describe('detectShift (regla 3 sobre 6)', () => {
  it('detecta la subida y la ovulación el día anterior', () => {
    const p = pts([36.4, 36.5, 36.4, 36.3, 36.5, 36.4, 36.4, 36.6, 36.7, 36.75, 36.8])
    // Seis anteriores al día 8: máximo 36,5. Días 8, 9 y 10 por encima; el 10 ≥ 36,7.
    expect(detectShift(p)).toEqual({ coverline: 36.5, firstHighDay: 8, ovulationDay: 7 })
  })

  it('exige que la tercera toma alta suba al menos 0,2 °C', () => {
    expect(detectShift(pts([36.4, 36.5, 36.4, 36.3, 36.5, 36.4, 36.55, 36.6, 36.65]))).toBeNull()
  })

  it('con menos de 9 tomas o con huecos en las tomas altas no hay subida', () => {
    expect(detectShift(pts([36.4, 36.5, 36.4, 36.9, 37.0]))).toBeNull()
    const gap = pts([36.4, 36.5, 36.4, 36.3, 36.5, 36.4, 36.7, 36.8])
    gap.push({ date: '2026-09-15', day: 15, temp: 36.9 })
    expect(detectShift(gap)).toBeNull()
  })
})

describe('temperatureCycles', () => {
  it('agrupa las tomas por ciclo con días de ciclo y días de periodo', () => {
    const periods = [
      { startDate: '2026-09-01', endDate: '2026-09-04' },
      { startDate: '2026-09-29', endDate: null },
    ]
    const days: DayLog[] = [
      { date: '2026-09-02', temperature: 36.4, updatedAt: 0 },
      { date: '2026-09-28', temperature: 36.8, updatedAt: 0 },
      { date: '2026-10-01', temperature: 36.3, updatedAt: 0 },
      { date: '2026-09-10', mood: 'calm', updatedAt: 0 },
    ]
    const c = temperatureCycles(periods, days, '2026-10-02')
    expect(c).toHaveLength(2)
    expect(c[0]).toMatchObject({ start: '2026-09-01', end: '2026-09-28', length: 28, periodDays: [1, 2, 3, 4] })
    expect(c[0].points.map((p) => [p.day, p.temp])).toEqual([
      [2, 36.4],
      [28, 36.8],
    ])
    // Ciclo actual: periodo en curso hasta hoy.
    expect(c[1]).toMatchObject({ start: '2026-09-29', end: '2026-10-02', length: 4, periodDays: [1, 2, 3, 4] })
  })

  it('omite los ciclos sin tomas', () => {
    expect(temperatureCycles([{ startDate: '2026-09-01', endDate: '2026-09-04' }], [], '2026-10-01')).toEqual([])
  })
})
