import { describe, expect, it } from 'vitest'
import type { Period } from '../db/db'
import { addDays } from './dates'
import { dateRange, expandPeriod, MAX_ONGOING_DAYS, periodEndQuestion, togglePeriodDay } from './periods'

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

describe('periodEndQuestion', () => {
  const ongoing = [{ startDate: '2026-10-01', endDate: null }]

  it('pregunta cuando el periodo dura 2 días más de lo habitual', () => {
    expect(periodEndQuestion(ongoing, 5, '2026-10-07')).toBeNull() // día 7
    expect(periodEndQuestion(ongoing, 5, '2026-10-08')).toEqual({ start: '2026-10-01', days: 8, lastPossible: '2026-10-08' })
  })

  it('no pregunta si el periodo está cerrado o se pospuso', () => {
    expect(periodEndQuestion([{ startDate: '2026-10-01', endDate: '2026-10-05' }], 5, '2026-10-10')).toBeNull()
    const snooze = { start: '2026-10-01', until: '2026-10-10' }
    expect(periodEndQuestion(ongoing, 5, '2026-10-09', snooze)).toBeNull()
    expect(periodEndQuestion(ongoing, 5, '2026-10-10', snooze)).not.toBeNull()
    // Un aplazamiento de otro periodo no cuenta.
    expect(periodEndQuestion(ongoing, 5, '2026-10-09', { start: '2026-09-01', until: '2026-10-20' })).not.toBeNull()
  })

  it('el último día elegible no pasa del tope de un periodo en curso', () => {
    expect(periodEndQuestion(ongoing, 5, '2026-10-30')?.lastPossible).toBe(addDays('2026-10-01', MAX_ONGOING_DAYS - 1))
  })
})

describe('dateRange', () => {
  it('da los días entre dos fechas en cualquier orden', () => {
    expect(dateRange('2026-09-30', '2026-10-02')).toEqual(['2026-09-30', '2026-10-01', '2026-10-02'])
    expect(dateRange('2026-10-02', '2026-09-30')).toEqual(['2026-09-30', '2026-10-01', '2026-10-02'])
    expect(dateRange('2026-10-02', '2026-10-02')).toEqual(['2026-10-02'])
  })
})

