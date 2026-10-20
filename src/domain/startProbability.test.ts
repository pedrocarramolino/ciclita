import { describe, expect, it } from 'vitest'
import type { Period } from '../db/db'
import { addDays } from './dates'
import { predict } from './prediction'
import { normalCdf, startProbabilities } from './startProbability'

/** Periodos de 5 días con los ciclos indicados, empezando el 1 de enero de 2026. */
function periods(cycles: number[]): Period[] {
  let start = '2026-01-01'
  const out: Period[] = []
  for (const c of [...cycles, 0]) {
    out.push({ startDate: start, endDate: addDays(start, 4) })
    start = addDays(start, c)
  }
  return out
}

describe('probabilidad de que empiece el periodo', () => {
  it('la normal acumulada da los valores conocidos', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6)
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3)
    expect(normalCdf(-1)).toBeCloseTo(0.1587, 3)
  })

  it('con ciclos que varían, reparte la probabilidad alrededor del día previsto', () => {
    const ps = periods([27, 29, 31, 28, 30, 29])
    const last = ps.at(-1)!.startDate
    const today = addDays(last, 20)
    const p = predict({ periods: ps, today })
    const r = startProbabilities(p, today)!
    expect(r).not.toBeNull()
    expect(r.mostLikely.date).toBe(p.nextPeriods[0].start)
    const sum = r.days.reduce((a, d) => a + d.probability, 0)
    expect(sum).toBeGreaterThan(0.9)
    expect(sum).toBeLessThanOrEqual(1.0001)
    expect(r.likely.probability).toBeGreaterThanOrEqual(0.8)
    expect(r.likely.start <= r.mostLikely.date && r.mostLikely.date <= r.likely.end).toBe(true)
    // Ningún día antes de hoy.
    expect(r.days.every((d) => d.date >= today)).toBe(true)
  })

  it('si la fecha prevista está cerca, lo de antes de hoy se reparte entre los días que quedan', () => {
    const ps = periods([25, 31, 27, 33, 26, 30])
    const last = ps.at(-1)!.startDate
    const p0 = predict({ periods: ps, today: addDays(last, 10) })
    const today = addDays(p0.nextPeriods[0].start, -1)
    const r = startProbabilities(predict({ periods: ps, today }), today)!
    const total = r.days.reduce((a, d) => a + d.probability, 0)
    expect(total).toBeGreaterThan(0.9)
    expect(r.days[0].date).toBe(today)
  })

  it('no se calcula con menos de 3 ciclos, con previsión manual, durante el periodo ni con retraso', () => {
    const few = periods([28, 30])
    const lastFew = few.at(-1)!.startDate
    expect(startProbabilities(predict({ periods: few, today: addDays(lastFew, 10) }), addDays(lastFew, 10))).toBeNull()

    const ps = periods([27, 29, 31, 28])
    const last = ps.at(-1)!.startDate
    const manual = predict({ periods: ps, today: addDays(last, 10), manual: true, userCycleLength: 28 })
    expect(startProbabilities(manual, addDays(last, 10))).toBeNull()
    expect(startProbabilities(predict({ periods: ps, today: addDays(last, 2) }), addDays(last, 2))).toBeNull()
    expect(startProbabilities(predict({ periods: ps, today: addDays(last, 35) }), addDays(last, 35))).toBeNull()
  })
})
