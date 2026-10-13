import { describe, expect, it } from 'vitest'
import type { DayLog, Period } from '../db/db'
import { completedCycles, cycleExtremes, phaseOf, symptomStats } from './stats'

const TODAY = '2026-10-20'
const periods: Period[] = [
  { startDate: '2026-08-01', endDate: '2026-08-05' },
  { startDate: '2026-08-29', endDate: '2026-09-02' }, // ciclo de 28
  { startDate: '2026-09-30', endDate: '2026-10-03' }, // ciclo de 32
]

describe('completedCycles', () => {
  it('lista solo los ciclos con periodo siguiente', () => {
    expect(completedCycles(periods)).toEqual([
      { start: '2026-08-01', length: 28, periodLength: 5 },
      { start: '2026-08-29', length: 32, periodLength: 5 },
    ])
  })

  it('sin periodos o con uno solo no hay ciclos', () => {
    expect(completedCycles([])).toEqual([])
    expect(completedCycles(periods.slice(0, 1))).toEqual([])
  })
})

describe('cycleExtremes', () => {
  it('encuentra el más corto y el más largo', () => {
    const e = cycleExtremes(completedCycles(periods))
    expect(e?.shortest.length).toBe(28)
    expect(e?.longest.length).toBe(32)
  })

  it('sin ciclos devuelve null', () => {
    expect(cycleExtremes([])).toBeNull()
  })
})

describe('phaseOf', () => {
  // Ciclo 29/08 → 30/09: ovulación estimada 16/09, ventana fértil 11/09–17/09.
  const phase = (d: string) => phaseOf(d, periods, 30, 5, TODAY)

  it('sitúa cada día en su fase', () => {
    expect(phase('2026-08-30')).toBe('menstrual')
    expect(phase('2026-09-05')).toBe('follicular')
    expect(phase('2026-09-11')).toBe('ovulatory')
    expect(phase('2026-09-17')).toBe('ovulatory')
    expect(phase('2026-09-25')).toBe('luteal')
  })

  it('en el ciclo actual estima el siguiente inicio con la media', () => {
    // Ciclo 30/09 + 30 → 30/10: ovulación 16/10.
    expect(phase('2026-10-14')).toBe('ovulatory')
  })

  it('antes del primer periodo no hay fase', () => {
    expect(phase('2026-07-15')).toBeNull()
  })
})

describe('symptomStats', () => {
  const log = (date: string, symptoms: string[]): DayLog => ({ date, symptoms, updatedAt: 0 })

  it('cuenta síntomas, los ordena y calcula su fase más habitual', () => {
    const days = [
      log('2026-08-30', ['Dolor abdominal', 'Cansancio']),
      log('2026-08-31', ['Dolor abdominal']),
      log('2026-09-25', ['Hinchazón', 'Cansancio']),
      log('2026-09-26', ['Hinchazón']),
      log('2026-09-27', ['Hinchazón']),
      log('2026-07-01', ['Acné']), // antes del primer periodo
      { date: '2026-09-10', updatedAt: 0, notes: 'sin síntomas' },
    ]
    const s = symptomStats(days, periods, 30, 5, TODAY)
    expect(s.map((x) => [x.name, x.count, x.topPhase])).toEqual([
      ['Hinchazón', 3, 'luteal'],
      ['Cansancio', 2, 'menstrual'], // empate 1–1: gana la primera fase del ciclo
      ['Dolor abdominal', 2, 'menstrual'],
      ['Acné', 1, null],
    ])
  })
})
