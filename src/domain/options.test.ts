import { describe, expect, it } from 'vitest'
import { parseDecimal, TEMPERATURE_RANGE, WEIGHT_RANGE } from './options'

describe('parseDecimal', () => {
  it('acepta coma o punto decimal', () => {
    expect(parseDecimal('36,55', TEMPERATURE_RANGE)).toBe(36.55)
    expect(parseDecimal(' 36.5 ', TEMPERATURE_RANGE)).toBe(36.5)
    expect(parseDecimal('62,5', WEIGHT_RANGE)).toBe(62.5)
  })

  it('rechaza textos vacíos, no numéricos o fuera de rango', () => {
    expect(parseDecimal('', TEMPERATURE_RANGE)).toBeNull()
    expect(parseDecimal('abc', TEMPERATURE_RANGE)).toBeNull()
    expect(parseDecimal('3655', TEMPERATURE_RANGE)).toBeNull()
    expect(parseDecimal('10', WEIGHT_RANGE)).toBeNull()
  })
})
