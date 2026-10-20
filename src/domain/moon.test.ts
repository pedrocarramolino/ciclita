import { describe, expect, it } from 'vitest'
import { julianToDate, moonPhases, truePhase } from './moon'

/** Instante calculado de la fase más cercana a `utc` (busca la lunación). */
function nearest(utc: string, phase: number): number {
  const target = Date.parse(utc)
  const k0 = Math.round((target / 86_400_000 + 2440587.5 - 2415020.76) / 29.530588853)
  const times = [k0 - 1, k0, k0 + 1].map((k) => julianToDate(truePhase(k, phase)).getTime())
  return times.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a))
}

describe('fases de la luna', () => {
  // Instantes publicados (UTC) por los observatorios.
  it.each([
    ['2000-01-06T18:14Z', 0],
    ['2024-04-08T18:21Z', 0],
    ['2024-01-18T03:53Z', 0.25],
    ['2024-01-25T17:54Z', 0.5],
    ['2024-02-02T23:18Z', 0.75],
  ])('%s (fase %s) con menos de 10 minutos de error', (utc, phase) => {
    const minutes = Math.abs(nearest(utc, phase) - Date.parse(utc)) / 60_000
    expect(minutes).toBeLessThan(10)
  })

  it('lista las fases de un intervalo por fecha, una cada 7 días más o menos', () => {
    const phases = moonPhases('2024-01-10', '2024-01-30')
    expect(phases.get('2024-01-18')).toBe('firstQuarter')
    expect(phases.get('2024-01-25')).toBe('full')
    expect([...phases.keys()].every((d) => d >= '2024-01-10' && d <= '2024-01-30')).toBe(true)
    expect(phases.get('2024-01-11')).toBe('new')
    expect(phases.size).toBe(3)

    const year = moonPhases('2024-01-01', '2024-12-31')
    // 12 o 13 lunaciones al año: entre 48 y 52 fases principales.
    expect(year.size).toBeGreaterThanOrEqual(48)
    expect(year.size).toBeLessThanOrEqual(52)
    expect(year.get('2024-04-08')).toBe('new')
  })
})
