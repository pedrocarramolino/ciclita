import { describe, expect, it } from 'vitest'
import { cycleDayOf } from './calendar'

describe('día del ciclo de cada fecha', () => {
  const starts = ['2026-08-19', '2026-09-24', '2026-10-30'] // el último, previsto

  it('cuenta desde el último inicio anterior o igual (día 1 = primer día del periodo)', () => {
    expect(cycleDayOf('2026-09-24', starts)).toBe(1)
    expect(cycleDayOf('2026-10-14', starts)).toBe(21)
    expect(cycleDayOf('2026-10-29', starts)).toBe(36)
    expect(cycleDayOf('2026-10-30', starts)).toBe(1)
  })

  it('no numera antes del primer periodo ni demasiado lejos del último', () => {
    expect(cycleDayOf('2026-08-18', starts)).toBeNull()
    expect(cycleDayOf('2027-02-01', starts)).toBeNull()
  })
})
