import { describe, expect, it } from 'vitest'
import type { Period } from '../db/db'
import { expandPeriod, MAX_ONGOING_DAYS, togglePeriodDay } from './periods'

const TODAY = '2026-10-13'
const closed = (startDate: string, endDate: string): Period => ({ startDate, endDate })

describe('expandPeriod', () => {
  it('incluye ambos extremos', () => {
    expect(expandPeriod(closed('2026-09-29', '2026-10-01'), TODAY)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ])
  })

  it('un periodo en curso llega hasta hoy', () => {
    expect(expandPeriod({ startDate: '2026-10-11', endDate: null }, TODAY)).toHaveLength(3)
  })

  it(`un periodo en curso olvidado se limita a ${MAX_ONGOING_DAYS} días`, () => {
    expect(expandPeriod({ startDate: '2026-08-01', endDate: null }, TODAY)).toHaveLength(
      MAX_ONGOING_DAYS,
    )
  })
})

describe('togglePeriodDay', () => {
  it('crea un periodo nuevo de un día', () => {
    expect(togglePeriodDay([], '2026-10-01', true, TODAY)).toEqual([closed('2026-10-01', '2026-10-01')])
  })

  it('alarga un periodo con un día contiguo', () => {
    const r = togglePeriodDay([closed('2026-10-01', '2026-10-03')], '2026-10-04', true, TODAY)
    expect(r).toEqual([closed('2026-10-01', '2026-10-04')])
  })

  it('une dos periodos separados por un día', () => {
    const r = togglePeriodDay(
      [closed('2026-10-01', '2026-10-02'), closed('2026-10-04', '2026-10-05')],
      '2026-10-03',
      true,
      TODAY,
    )
    expect(r).toEqual([closed('2026-10-01', '2026-10-05')])
  })

  it('parte un periodo al quitar un día intermedio', () => {
    const r = togglePeriodDay([closed('2026-10-01', '2026-10-05')], '2026-10-03', false, TODAY)
    expect(r).toEqual([closed('2026-10-01', '2026-10-02'), closed('2026-10-04', '2026-10-05')])
  })

  it('elimina un periodo de un solo día', () => {
    expect(togglePeriodDay([closed('2026-10-01', '2026-10-01')], '2026-10-01', false, TODAY)).toEqual([])
  })

  it('mantiene en curso un periodo si se edita su inicio', () => {
    const r = togglePeriodDay([{ startDate: '2026-10-11', endDate: null }], '2026-10-10', true, TODAY)
    expect(r).toEqual([{ startDate: '2026-10-10', endDate: null }])
  })

  it('da por terminado un periodo en curso si se quita hoy', () => {
    const r = togglePeriodDay([{ startDate: '2026-10-11', endDate: null }], TODAY, false, TODAY)
    expect(r).toEqual([closed('2026-10-11', '2026-10-12')])
  })
})
