import { describe, expect, it } from 'vitest'
import { parseBloodPressure, parseDecimal, parseWhole, PULSE_RANGE, TEMPERATURE_RANGE, WEIGHT_RANGE } from './options'

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

describe('tensión y pulso', () => {
  it('lee la tensión con barra, espacio o guion', () => {
    expect(parseBloodPressure('120/80')).toEqual({ systolic: 120, diastolic: 80 })
    expect(parseBloodPressure(' 135 85 ')).toEqual({ systolic: 135, diastolic: 85 })
    expect(parseBloodPressure('110-70')).toEqual({ systolic: 110, diastolic: 70 })
  })

  it('rechaza la tensión al revés, fuera de rango o incompleta', () => {
    expect(parseBloodPressure('80/120')).toBeNull()
    expect(parseBloodPressure('300/80')).toBeNull()
    expect(parseBloodPressure('120')).toBeNull()
    expect(parseBloodPressure('12,5/8')).toBeNull()
  })

  it('el pulso es un número entero razonable', () => {
    expect(parseWhole('72', PULSE_RANGE)).toBe(72)
    expect(parseWhole('7', PULSE_RANGE)).toBeNull()
    expect(parseWhole('72.5', PULSE_RANGE)).toBeNull()
    expect(parseWhole('250', PULSE_RANGE)).toBeNull()
  })
})
