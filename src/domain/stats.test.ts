import { describe, expect, it } from 'vitest'
import type { DayLog, Period } from '../db/db'
import { completedCycles, cycleExtremes, phaseOf, symptomStats, symptomTiming } from './stats'

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

describe('cuándo suele aparecer cada síntoma', () => {
  it('symptomTiming: tramo central si es estrecho; null con pocos datos o sin patrón', () => {
    expect(symptomTiming([1, 2, 2, 3, 1])).toEqual({ from: 1, to: 3 })
    expect(symptomTiming([1, 2])).toBeNull()
    expect(symptomTiming([1, 8, 15, 22, 27])).toBeNull()
  })

  it('symptomTiming: junta los días de antes del periodo con los primeros del ciclo', () => {
    // Del día antes del periodo al día 1 (el 60 % central).
    expect(symptomTiming([-2, -1, 1, 2, -1, 1])).toEqual({ from: -1, to: 1 })
    // Solo antes del periodo.
    expect(symptomTiming([-3, -2, -2, -1])).toEqual({ from: -3, to: -1 })
  })

  it('symptomStats sitúa cada aparición en su ciclo', () => {
    const periods: Period[] = [
      { startDate: '2026-07-01', endDate: '2026-07-05' },
      { startDate: '2026-07-29', endDate: '2026-08-02' },
      { startDate: '2026-08-26', endDate: '2026-08-30' },
    ]
    const log = (date: string, symptoms: string[]): DayLog => ({ date, symptoms, updatedAt: 0 })
    const days = [
      // Hinchazón 2 y 1 días antes de cada periodo.
      log('2026-07-27', ['Hinchazón']),
      log('2026-07-28', ['Hinchazón']),
      log('2026-08-24', ['Hinchazón']),
      log('2026-08-25', ['Hinchazón']),
      // Dolor los días 1 y 2.
      log('2026-07-01', ['Dolor abdominal']),
      log('2026-07-02', ['Dolor abdominal']),
      log('2026-07-29', ['Dolor abdominal']),
      log('2026-08-26', ['Dolor abdominal']),
    ]
    const stats = symptomStats(days, periods, 28, 5, '2026-09-10')
    expect(stats.find((s) => s.name === 'Hinchazón')?.timing).toEqual({ from: -2, to: -1 })
    expect(stats.find((s) => s.name === 'Dolor abdominal')?.timing).toEqual({ from: 1, to: 2 })
  })
})
