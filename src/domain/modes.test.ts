import { describe, expect, it } from 'vitest'
import { lastPeriodFromDueDate, perimenopauseInfo, pregnancyInfo } from './modes'

describe('pregnancyInfo', () => {
  it('semanas, días, trimestre y fecha probable de parto', () => {
    // Última regla el 1 de julio; hoy 13 de octubre → 104 días = 14 semanas y 6 días.
    expect(pregnancyInfo('2026-07-01', '2026-10-13')).toEqual({
      weeks: 14,
      days: 6,
      trimester: 2,
      dueDate: '2027-04-07',
      daysLeft: 176,
      progress: 104 / 280,
    })
  })

  it('trimestres: 1º hasta la semana 13, 2º de la 14 a la 27, 3º desde la 28', () => {
    expect(pregnancyInfo('2026-10-01', '2026-10-13').trimester).toBe(1)
    expect(pregnancyInfo('2026-01-01', '2026-07-16').trimester).toBe(3) // semana 28
  })

  it('pasada la fecha probable el progreso no supera el 100 %', () => {
    const p = pregnancyInfo('2026-01-01', '2026-10-13')
    expect(p.progress).toBe(1)
    expect(p.daysLeft).toBeLessThan(0)
  })

  it('calcula la última regla desde la fecha probable de parto', () => {
    expect(lastPeriodFromDueDate('2027-04-07')).toBe('2026-07-01')
  })
})

describe('perimenopauseInfo', () => {
  const p = (startDate: string) => ({ startDate, endDate: startDate })

  it('días desde el último periodo y periodos en el último año', () => {
    const info = perimenopauseInfo([p('2025-08-01'), p('2026-01-10'), p('2026-05-20'), p('2026-09-01')], '2026-10-13')
    expect(info).toEqual({ lastStart: '2026-09-01', daysSinceLast: 42, periodsLastYear: 3, twelveMonthsWithout: false })
  })

  it('12 meses sin periodo', () => {
    expect(perimenopauseInfo([p('2025-09-01')], '2026-10-13').twelveMonthsWithout).toBe(true)
  })

  it('sin datos', () => {
    expect(perimenopauseInfo([], '2026-10-13')).toEqual({ lastStart: null, daysSinceLast: null, periodsLastYear: 0, twelveMonthsWithout: false })
  })
})
