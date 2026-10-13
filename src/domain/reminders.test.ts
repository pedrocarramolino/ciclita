import { describe, expect, it } from 'vitest'
import { DEFAULT_REMINDERS, type ReminderSettings } from '../db/settings'
import { predict } from './prediction'
import { dueReminders } from './reminders'

const at = (iso: string) => new Date(iso)
// Último periodo el 1/10 → siguiente previsto el 29/10.
const prediction = predict({
  periods: [{ startDate: '2026-10-01', endDate: '2026-10-05' }],
  today: '2026-10-27',
})
const settings = (s: Partial<ReminderSettings>) => ({ ...DEFAULT_REMINDERS, ...s })

describe('dueReminders', () => {
  it('no avisa de nada si todo está desactivado', () => {
    expect(
      dueReminders({ settings: DEFAULT_REMINDERS, log: {}, prediction, now: at('2026-10-27T22:30'), todayLogged: false }),
    ).toEqual([])
  })

  it('avisa del periodo X días antes, a partir de las 9:00 y una sola vez', () => {
    const s = settings({ periodEnabled: true, periodDaysBefore: 2 })
    expect(dueReminders({ settings: s, log: {}, prediction, now: at('2026-10-27T08:59'), todayLogged: false })).toEqual([])
    expect(dueReminders({ settings: s, log: {}, prediction, now: at('2026-10-27T09:00'), todayLogged: false })).toEqual([
      { kind: 'period', logValue: '2026-10-29', daysUntil: 2 },
    ])
    expect(
      dueReminders({ settings: s, log: { period: '2026-10-29' }, prediction, now: at('2026-10-28T10:00'), todayLogged: false }),
    ).toEqual([])
  })

  it('no avisa del periodo si aún falta más de lo configurado', () => {
    const s = settings({ periodEnabled: true, periodDaysBefore: 1 })
    expect(dueReminders({ settings: s, log: {}, prediction, now: at('2026-10-27T12:00'), todayLogged: false })).toEqual([])
  })

  it('recordatorio diario: a su hora, si no se ha registrado nada hoy', () => {
    const s = settings({ dailyEnabled: true, dailyTime: '21:00' })
    const base = { settings: s, log: {}, prediction, todayLogged: false }
    expect(dueReminders({ ...base, now: at('2026-10-27T20:59') })).toEqual([])
    expect(dueReminders({ ...base, now: at('2026-10-27T21:00') })).toEqual([{ kind: 'daily', logValue: '2026-10-27' }])
    expect(dueReminders({ ...base, todayLogged: true, now: at('2026-10-27T21:00') })).toEqual([])
    expect(dueReminders({ ...base, log: { daily: '2026-10-27' }, now: at('2026-10-27T23:00') })).toEqual([])
  })

  it('píldora: cada día a su hora', () => {
    const s = settings({ pillEnabled: true, pillTime: '08:30' })
    const r = dueReminders({ settings: s, log: { pill: '2026-10-26' }, prediction, now: at('2026-10-27T08:31'), todayLogged: true })
    expect(r).toEqual([{ kind: 'pill', logValue: '2026-10-27' }])
  })
})
