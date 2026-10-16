import { describe, expect, it } from 'vitest'
import { weightLayout } from './weightLayout'

const points = [
  { date: '2026-08-01', weight: 62.4 },
  { date: '2026-09-01', weight: 63.1 },
  { date: '2026-10-01', weight: 62.0 },
]

describe('geometría de la gráfica de peso', () => {
  const l = weightLayout(points, [{ start: '2026-09-24', end: '2026-09-28' }], '2026-07-16', '2026-10-16', 340, 220)

  it('los puntos van en orden y dentro del área', () => {
    const xs = l.points.map((p) => p.cx)
    expect(xs).toEqual([...xs].sort((a, b) => a - b))
    for (const p of l.points) {
      expect(p.cx).toBeGreaterThanOrEqual(l.plot.left)
      expect(p.cx).toBeLessThanOrEqual(l.plot.right)
      expect(p.cy).toBeGreaterThanOrEqual(l.plot.top)
      expect(p.cy).toBeLessThanOrEqual(l.plot.bottom)
    }
    expect(l.line.startsWith('M')).toBe(true)
  })

  it('eje Y con un rango mínimo y marcas redondas que cubren todos los pesos', () => {
    expect(l.yTicks[0]).toBeLessThanOrEqual(62)
    expect(l.yTicks.at(-1)).toBeGreaterThanOrEqual(63.1)
    expect(l.yTicks.at(-1)! - l.yTicks[0]).toBeGreaterThanOrEqual(2)
  })

  it('una marca por cada mes del rango y la franja del periodo', () => {
    expect(l.monthTicks).toEqual(['2026-08-01', '2026-09-01', '2026-10-01'])
    expect(l.periodBands).toHaveLength(1)
    expect(l.periodBands[0].width).toBeGreaterThan(0)
  })
})
