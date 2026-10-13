import { describe, expect, it } from 'vitest'
import type { Period } from '../db/db'
import { addDays } from './dates'
import {
  DEFAULT_CYCLE_LENGTH,
  DEFAULT_PERIOD_LENGTH,
  fertileWindowFor,
  predict,
} from './prediction'

const TODAY = '2026-10-13'

/** Periodos cerrados a partir de sus fechas de inicio. */
const periodsFrom = (starts: string[], length = 5): Period[] =>
  starts.map((startDate) => ({ startDate, endDate: addDays(startDate, length - 1) }))

/** Inicios hacia atrás desde `lastStart`, con las duraciones de ciclo indicadas (de más antiguo a más reciente). */
function startsWithCycles(lastStart: string, cycles: number[]): string[] {
  const starts = [lastStart]
  for (const c of [...cycles].reverse()) starts.unshift(addDays(starts[0], -c))
  return starts
}

describe('predict · sin datos', () => {
  it('usa 28 y 5 días por defecto y no predice periodos', () => {
    const p = predict({ periods: [], today: TODAY })
    expect(p.cycleLength).toBe(DEFAULT_CYCLE_LENGTH)
    expect(p.periodLength).toBe(DEFAULT_PERIOD_LENGTH)
    expect(p.cycleSource).toBe('default')
    expect(p.periodSource).toBe('default')
    expect(p.nextPeriods).toEqual([])
    expect(p.fertileWindows).toEqual([])
    expect(p.status).toEqual({ kind: 'noData' })
    expect(p.isIrregular).toBe(false)
    expect(p.variation).toBeNull()
  })

  it('usa las duraciones indicadas por la usuaria si las hay', () => {
    const p = predict({ periods: [], today: TODAY, userCycleLength: 32, userPeriodLength: 4 })
    expect(p.cycleLength).toBe(32)
    expect(p.cycleSource).toBe('user')
    expect(p.periodLength).toBe(4)
    expect(p.periodSource).toBe('user')
  })
})

describe('predict · con un solo ciclo', () => {
  it('con un único periodo registrado, predice con la duración por defecto', () => {
    const p = predict({ periods: [{ startDate: '2026-10-03', endDate: null }], today: TODAY })
    expect(p.cycleSource).toBe('default')
    expect(p.recentCycles).toEqual([])
    expect(p.nextPeriods.map((r) => r.start)).toEqual(['2026-10-31', '2026-11-28', '2026-12-26'])
    // Periodo en curso: no cuenta para la duración media del periodo.
    expect(p.periodSource).toBe('default')
  })

  it('con un único periodo y duración indicada por la usuaria, usa esa duración', () => {
    const p = predict({
      periods: periodsFrom(['2026-10-03'], 4),
      today: TODAY,
      userCycleLength: 30,
    })
    expect(p.cycleLength).toBe(30)
    expect(p.nextPeriods[0].start).toBe('2026-11-02')
    // El periodo cerrado sí cuenta: 4 días de historial.
    expect(p.periodLength).toBe(4)
    expect(p.periodSource).toBe('history')
  })

  it('con un ciclo completo (dos periodos), usa su duración', () => {
    const p = predict({ periods: periodsFrom(['2026-09-03', '2026-10-03']), today: TODAY })
    expect(p.recentCycles).toEqual([30])
    expect(p.cycleLength).toBe(30)
    expect(p.cycleSource).toBe('history')
    expect(p.variation).toBeNull()
    expect(p.isIrregular).toBe(false)
    expect(p.nextPeriods[0]).toEqual({ start: '2026-11-02', end: '2026-11-06' })
  })
})

describe('predict · ciclos regulares', () => {
  const periods = periodsFrom(startsWithCycles('2026-10-03', [28, 28, 28, 28, 28, 28]))
  const p = predict({ periods, today: TODAY })

  it('calcula las medias', () => {
    expect(p.cycleLength).toBe(28)
    expect(p.periodLength).toBe(5)
    expect(p.variation).toBe(0)
    expect(p.isIrregular).toBe(false)
  })

  it('predice los próximos 3 periodos', () => {
    expect(p.nextPeriods).toEqual([
      { start: '2026-10-31', end: '2026-11-04' },
      { start: '2026-11-28', end: '2026-12-02' },
      { start: '2026-12-26', end: '2026-12-30' },
    ])
  })

  it('estima la ovulación 14 días antes y la ventana fértil de −5 a +1', () => {
    expect(p.fertileWindows[0]).toEqual({
      start: '2026-10-12',
      ovulation: '2026-10-17',
      end: '2026-10-18',
    })
    expect(p.fertileWindows).toHaveLength(3)
  })

  it('indica el estado de hoy', () => {
    expect(p.status).toEqual({
      kind: 'upcoming',
      daysUntil: 18,
      cycleDay: 11,
      inFertileWindow: true,
    })
  })

  it('solo tiene en cuenta los últimos 6 ciclos', () => {
    const many = periodsFrom(startsWithCycles('2026-10-03', [45, 45, 30, 30, 30, 30, 30, 30]))
    const r = predict({ periods: many, today: TODAY })
    expect(r.recentCycles).toEqual([30, 30, 30, 30, 30, 30])
    expect(r.cycleLength).toBe(30)
  })
})

describe('predict · ciclos irregulares', () => {
  it('detecta una variación de más de 7 días y redondea la media', () => {
    const periods = periodsFrom(startsWithCycles('2026-10-03', [24, 35, 28, 31]))
    const p = predict({ periods, today: TODAY })
    expect(p.recentCycles).toEqual([24, 35, 28, 31])
    expect(p.variation).toBe(11)
    expect(p.isIrregular).toBe(true)
    expect(p.cycleLength).toBe(30) // 29,5 redondeado
  })

  it('una variación de exactamente 7 días no se considera irregular', () => {
    const periods = periodsFrom(startsWithCycles('2026-10-03', [26, 33]))
    expect(predict({ periods, today: TODAY }).isIrregular).toBe(false)
  })

  it('ignora huecos imposibles (registros olvidados) en las medias', () => {
    const periods = periodsFrom(startsWithCycles('2026-10-03', [28, 120, 28]))
    const p = predict({ periods, today: TODAY })
    expect(p.recentCycles).toEqual([28, 28])
    expect(p.isIrregular).toBe(false)
  })
})

describe('predict · estado de hoy', () => {
  it('durante el periodo indica el día', () => {
    const p = predict({ periods: [{ startDate: '2026-10-11', endDate: null }], today: TODAY })
    expect(p.status).toEqual({ kind: 'period', day: 3, ongoing: true })
  })

  it('el día previsto no cuenta como retraso', () => {
    const p = predict({ periods: periodsFrom(['2026-09-15']), today: TODAY })
    expect(p.status).toMatchObject({ kind: 'upcoming', daysUntil: 0 })
  })

  it('con retraso, indica los días y estima el siguiente a partir de hoy', () => {
    const p = predict({ periods: periodsFrom(['2026-09-10']), today: TODAY })
    expect(p.status).toEqual({ kind: 'late', daysLate: 5, cycleDay: 34 })
    expect(p.nextPeriods[0].start).toBe(TODAY)
    // No hay ventana fértil del ciclo actual, solo de los siguientes.
    expect(p.fertileWindows).toHaveLength(2)
    expect(p.fertileWindows.every((w) => w.start > TODAY)).toBe(true)
  })

  it('si hace más de un ciclo de retraso, marca los datos como desactualizados y proyecta al futuro', () => {
    const p = predict({ periods: periodsFrom(['2026-06-01']), today: TODAY })
    expect(p.stale).toBe(true)
    expect(p.status.kind).toBe('upcoming')
    expect(p.nextPeriods[0].start > TODAY).toBe(true)
  })
})

describe('fertileWindowFor', () => {
  it('en ciclos muy cortos la ventana no se solapa con el periodo', () => {
    // Ciclo de 18 días: ovulación el día 5, justo dentro del periodo de 5 días.
    const w = fertileWindowFor('2026-10-01', '2026-10-19', 5)
    expect(w.ovulation).toBe('2026-10-05')
    expect(w.start).toBe('2026-10-06')
    expect(w.end).toBe('2026-10-06')
  })
})
