import { describe, expect, it } from 'vitest'
import { DEFAULT_REMINDERS, type ReminderSettings } from '../db/settings'
import { predict } from '../domain/prediction'
import { buildReminders, hasReminders } from './reminderPayload'

// Último periodo el 1/10 → siguiente previsto el 29/10.
const upcoming = predict({ periods: [{ startDate: '2026-10-01', endDate: '2026-10-05' }], today: '2026-10-20' })
const late = predict({ periods: [{ startDate: '2026-09-01', endDate: '2026-09-05' }], today: '2026-10-05' })
const s = (p: Partial<ReminderSettings>) => ({ ...DEFAULT_REMINDERS, ...p })

describe('buildReminders', () => {
  it('sin recordatorios activos no envía nada', () => {
    const r = buildReminders(DEFAULT_REMINDERS, upcoming)
    expect(r).toEqual({})
    expect(hasReminders(r)).toBe(false)
  })

  it('diario y píldora con su hora; en modo discreto, textos neutros', () => {
    const r = buildReminders(s({ dailyEnabled: true, pillEnabled: true, pillTime: '08:15' }), upcoming)
    expect(r.daily).toMatchObject({ time: '21:00', title: 'Ciclita' })
    expect(r.pill).toMatchObject({ time: '08:15', title: 'Ciclita' })
    expect(JSON.stringify(r)).not.toMatch(/píldora|periodo/i)
  })

  it('sin modo discreto, textos descriptivos', () => {
    const r = buildReminders(s({ pillEnabled: true, discreet: false }), upcoming)
    expect(r.pill?.body).toMatch(/píldora/)
  })

  it('aviso de periodo: intervalo de días y un texto por cada día restante', () => {
    const r = buildReminders(s({ periodEnabled: true, periodDaysBefore: 2, discreet: false }), upcoming)
    expect(r.period).toMatchObject({ from: '2026-10-27', until: '2026-10-29' })
    expect(r.period?.bodies).toEqual([
      'Tu periodo podría empezar hoy.',
      'Tu periodo podría empezar mañana.',
      'Tu periodo podría empezar en 2 días.',
    ])
  })

  it('no programa el aviso de periodo si hay retraso o no hay datos', () => {
    expect(buildReminders(s({ periodEnabled: true }), late).period).toBeUndefined()
    expect(buildReminders(s({ periodEnabled: true }), null).period).toBeUndefined()
  })
})

describe('buildReminders · recordatorios con fecha', () => {
  const ring = { contraception: { method: 'ring' as const, start: '2026-10-01', time: '21:00' } }

  it('incluye la pauta del anticonceptivo con su texto', () => {
    const r = buildReminders(s({ ...ring, discreet: false }), upcoming, '2026-10-20')
    expect(r.events?.[0]).toEqual({ date: '2026-10-22', time: '21:00', title: 'Anillo', body: 'Hoy toca retirar el anillo vaginal (semana de descanso).' })
    expect(hasReminders(r)).toBe(true)
  })

  it('en modo discreto no dice de qué se trata', () => {
    const r = buildReminders(s({ ...ring, fertileEnabled: true, breastExamEnabled: true }), upcoming, '2026-10-20')
    expect(JSON.stringify(r.events)).not.toMatch(/anillo|fértil|mama/i)
  })
})
