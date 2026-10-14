import { describe, expect, it } from 'vitest'
import type { TempCycle } from '../../domain/temperature'
import { tempLayout } from './tempLayout'

const cycle = (points: [number, number][], length = 28, periodDays = [1, 2, 3, 4, 5]): TempCycle => ({
  start: '2026-09-01',
  end: '2026-09-28',
  length,
  periodDays,
  points: points.map(([day, temp]) => ({ date: `2026-09-${String(day).padStart(2, '0')}`, day, temp })),
  shift: null,
})

describe('tempLayout', () => {
  it('coloca el día 1 a la izquierda y el último a la derecha; más temperatura, más arriba', () => {
    const l = tempLayout(cycle([[1, 36.4], [28, 36.9]]), 300, 200)
    expect(l.x(1)).toBe(l.plot.left)
    expect(l.x(28)).toBe(l.plot.right)
    expect(l.points[1].cy).toBeLessThan(l.points[0].cy)
  })

  it('el eje Y abarca al menos 0,6 °C y sus marcas caen dentro', () => {
    const l = tempLayout(cycle([[3, 36.5], [4, 36.52]]), 300, 200)
    expect(l.yTicks.at(-1)! - l.yTicks[0]).toBeGreaterThanOrEqual(0.5)
    for (const v of l.yTicks) {
      expect(l.y(v)).toBeGreaterThanOrEqual(l.plot.top - 0.01)
      expect(l.y(v)).toBeLessThanOrEqual(l.plot.bottom + 0.01)
    }
  })

  it('marca días cada semana y la franja del periodo', () => {
    const l = tempLayout(cycle([[2, 36.4]]), 300, 200)
    expect(l.xTicks).toEqual([1, 7, 14, 21, 28])
    expect(l.periodBand!.x).toBe(l.plot.left)
    expect(l.periodBand!.width).toBeGreaterThan(0)
  })

  it('separa los huecos entre tomas en un trazo aparte', () => {
    const l = tempLayout(cycle([[1, 36.4], [2, 36.5], [5, 36.6]]), 300, 200)
    expect(l.line.match(/M/g)).toHaveLength(2)
    expect(l.gaps).not.toBe('')
  })

  it('las zonas sensibles cubren todo el ancho sin solaparse', () => {
    const l = tempLayout(cycle([[1, 36.4], [10, 36.5], [20, 36.6]]), 300, 200)
    expect(l.points[0].hitX).toBe(l.plot.left)
    const last = l.points.at(-1)!
    expect(last.hitX + last.hitWidth).toBeCloseTo(l.plot.right)
    expect(l.points[0].hitX + l.points[0].hitWidth).toBeCloseTo(l.points[1].hitX)
  })
})
