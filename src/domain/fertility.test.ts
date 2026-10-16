import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { pregnancyChance, showsPregnancyChance } from './fertility'
import { predict } from './prediction'

// Ciclos de 28 días: último periodo el 1/10 → siguiente el 29/10 y ovulación el 15/10.
const periods = ['2026-08-06', '2026-09-03', '2026-10-01'].map((s) => ({ startDate: s, endDate: addDays(s, 4) }))
const TODAY = '2026-10-05'
const p = predict({ periods, today: TODAY })

describe('posibilidad de embarazo según el día', () => {
  it('alta los 2 días antes de la ovulación y ese día; media en el resto de la ventana; baja fuera', () => {
    expect(p.fertileWindows[0].ovulation).toBe('2026-10-15')
    expect(pregnancyChance('2026-10-13', p, TODAY)).toBe('high')
    expect(pregnancyChance('2026-10-15', p, TODAY)).toBe('high')
    expect(pregnancyChance('2026-10-10', p, TODAY)).toBe('medium')
    expect(pregnancyChance('2026-10-16', p, TODAY)).toBe('medium')
    expect(pregnancyChance('2026-10-20', p, TODAY)).toBe('low')
    expect(pregnancyChance(TODAY, p, TODAY)).toBe('low')
  })

  it('no se estima para días pasados, sin datos o con retraso', () => {
    expect(pregnancyChance('2026-10-01', p, TODAY)).toBeNull()
    expect(pregnancyChance(TODAY, predict({ periods: [], today: TODAY }), TODAY)).toBeNull()
    const late = predict({ periods, today: '2026-11-03' })
    expect(late.status.kind).toBe('late')
    expect(pregnancyChance('2026-11-03', late, '2026-11-03')).toBeNull()
  })

  it('solo en modo ciclo y sin anticonceptivo hormonal registrado', () => {
    const base = { mode: 'cycle', tracking: { pill: false }, reminders: { contraception: { method: 'none' } } }
    expect(showsPregnancyChance(base)).toBe(true)
    expect(showsPregnancyChance({ ...base, mode: 'pregnancy' })).toBe(false)
    expect(showsPregnancyChance({ ...base, tracking: { pill: true } })).toBe(false)
    expect(showsPregnancyChance({ ...base, reminders: { contraception: { method: 'ring' } } })).toBe(false)
  })
})
