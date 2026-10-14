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

  it('aviso de periodo: incluye los periodos previstos siguientes', () => {
    const r = buildReminders(s({ periodEnabled: true, periodDaysBefore: 2 }), upcoming)
    expect(r.period?.next).toHaveLength(upcoming!.nextPeriods.length - 1)
    r.period!.next!.forEach((w, i) => {
      expect(w.until).toBe(upcoming!.nextPeriods[i + 1].start)
      expect(w.from < w.until).toBe(true)
    })
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

describe('buildReminders · modos', () => {
  it('en embarazo o perimenopausia no se programan avisos de periodo ni de ventana fértil', () => {
    const r = s({ periodEnabled: true, fertileEnabled: true, dailyEnabled: true })
    for (const mode of ['pregnancy', 'perimenopause'] as const) {
      const out = buildReminders(r, upcoming, '2026-10-20', mode)
      expect(out.period).toBeUndefined()
      expect(out.events).toBeUndefined()
      expect(out.daily).toBeDefined() // el resto sigue funcionando
    }
    expect(buildReminders(r, upcoming, '2026-10-20', 'cycle').period).toBeDefined()
  })
})

describe('píldora con envase', () => {
  it('envía el envase solo si tiene días de descanso y se registra la píldora', async () => {
    const { reminderPillPack } = await import('../domain/pill')
    expect(reminderPillPack(true, { pack: 21, start: '2026-10-01' })).toEqual({ active: 21, start: '2026-10-01' })
    expect(reminderPillPack(true, { pack: 28, start: '2026-10-01' })).toBeUndefined()
    expect(reminderPillPack(false, { pack: 21, start: '2026-10-01' })).toBeUndefined()
    expect(reminderPillPack(true, { pack: 24, start: null })).toBeUndefined()

    const r = buildReminders({ ...DEFAULT_REMINDERS, pillEnabled: true }, null, '2026-10-20', 'cycle', {
      pack: { active: 24, start: '2026-10-01' },
    })
    expect(r.pill?.pack).toEqual({ active: 24, start: '2026-10-01' })
    expect(r.pill?.takenAction).toBeUndefined()
  })

  it('con las tomas registradas, la notificación lleva el botón (neutro en modo discreto)', () => {
    const on = { ...DEFAULT_REMINDERS, pillEnabled: true }
    expect(buildReminders({ ...on, discreet: false }, null, '2026-10-20', 'cycle', { trackTaken: true }).pill?.takenAction).toBe(
      'Ya la he tomado',
    )
    expect(buildReminders({ ...on, discreet: true }, null, '2026-10-20', 'cycle', { trackTaken: true }).pill?.takenAction).toBe('Hecho')
  })
})

describe('envase nuevo en los avisos', () => {
  it('solo con recordatorio de píldora y envase con descanso', () => {
    const pack = { active: 24, start: '2026-10-01' }
    const on = buildReminders({ ...DEFAULT_REMINDERS, pillEnabled: true, discreet: false }, null, '2026-10-20', 'cycle', { pack })
    expect(on.events?.[0]).toMatchObject({ date: '2026-10-28', body: 'Mañana empiezas un envase nuevo de la píldora.' })
    const off = buildReminders({ ...DEFAULT_REMINDERS, pillEnabled: false }, null, '2026-10-20', 'cycle', { pack })
    expect(off.events).toBeUndefined()
  })
})
