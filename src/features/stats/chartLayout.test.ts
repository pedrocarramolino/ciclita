import { describe, expect, it } from 'vitest'
import { barPath, chartLayout, MARGIN, MAX_BAR_WIDTH, niceMax, yTicksFor } from './chartLayout'

describe('ejes', () => {
  it('el máximo del eje deja aire y es múltiplo de 5', () => {
    expect(niceMax(28)).toBe(35)
    expect(niceMax(34)).toBe(40)
    expect(niceMax(0)).toBe(5)
  })

  it('marcas cada 10 (cada 20 si el eje es muy alto)', () => {
    expect(yTicksFor(40)).toEqual([0, 10, 20, 30, 40])
    expect(yTicksFor(80)).toEqual([0, 20, 40, 60, 80])
  })
})

describe('chartLayout', () => {
  const values = [26, 34, 28]
  const l = chartLayout(values, ['ago', 'sep', 'oct'], 29, 338, 224)

  it('coloca las barras sobre el eje con su altura proporcional', () => {
    const bottom = 224 - MARGIN.bottom
    for (const b of l.bars) {
      expect(b.y + b.height).toBeCloseTo(bottom)
      expect(b.width).toBeLessThanOrEqual(MAX_BAR_WIDTH)
    }
    expect(l.bars[1].height).toBeGreaterThan(l.bars[0].height)
    // Eje 0–40: 34 días ocupa el 85 % de la altura útil.
    expect(l.bars[1].height / (bottom - MARGIN.top)).toBeCloseTo(34 / 40)
  })

  it('las zonas sensibles cubren toda la franja sin solaparse', () => {
    expect(l.bars[0].hitX).toBe(MARGIN.left)
    expect(l.bars[1].hitX).toBeCloseTo(l.bars[0].hitX + l.bars[0].hitWidth)
    expect(l.bars[0].hitWidth).toBeGreaterThan(l.bars[0].width)
  })

  it('la línea de la media está a su altura', () => {
    const bottom = 224 - MARGIN.bottom
    expect(l.averageY).toBeCloseTo(bottom - (29 / 40) * (bottom - MARGIN.top))
  })

  it('en pantallas estrechas con muchos ciclos muestra una etiqueta de cada varias, siempre la última', () => {
    const many = chartLayout(Array(12).fill(28), Array(12).fill('x'), 28, 280, 224)
    const shown = many.bars.map((b) => b.showLabel)
    expect(shown.at(-1)).toBe(true)
    expect(shown.filter(Boolean).length).toBeLessThan(12)
  })

  it('sin datos no falla', () => {
    expect(chartLayout([], [], 28, 300, 200).bars).toEqual([])
  })
})

describe('barPath', () => {
  it('redondea solo las esquinas superiores', () => {
    expect(barPath(10, 20, 20, 100)).toBe('M10,120V24Q10,20 14,20H26Q30,20 30,24V120Z')
  })

  it('una barra sin altura no se dibuja', () => {
    expect(barPath(0, 0, 10, 0)).toBe('')
  })
})
