import { describe, expect, it } from 'vitest'
import { DEFAULT_REMINDERS } from '../db/settings'
import { anyReminderOn, problemKey, reminderProblem } from './reminderStatus'

const on = { ...DEFAULT_REMINDERS, pillEnabled: true }

describe('¿llegan los recordatorios?', () => {
  it('sin ninguno activado no hay nada que avisar', () => {
    expect(anyReminderOn(DEFAULT_REMINDERS)).toBe(false)
    expect(reminderProblem(DEFAULT_REMINDERS, 'denied', 'error')).toBeNull()
  })

  it('detecta cada problema, del más básico al del servidor', () => {
    expect(reminderProblem(on, 'unsupported', null)).toEqual({ kind: 'unsupported' })
    expect(reminderProblem(on, 'denied', null)).toEqual({ kind: 'denied' })
    expect(reminderProblem(on, 'default', null)).toEqual({ kind: 'askPermission' })
    expect(reminderProblem(on, 'granted', 'Sesión no válida')).toEqual({ kind: 'error', message: 'Sesión no válida' })
    expect(reminderProblem(on, 'granted', null)).toBeNull()
  })

  it('cuentan también los recordatorios libres, la revisión y el anticonceptivo', () => {
    expect(anyReminderOn({ ...DEFAULT_REMINDERS, custom: [{ id: 'c', name: 'X', time: '09:00', cycleDays: null }] })).toBe(true)
    expect(anyReminderOn({ ...DEFAULT_REMINDERS, checkupEnabled: true, checkupDate: null })).toBe(false)
    expect(anyReminderOn({ ...DEFAULT_REMINDERS, contraception: { method: 'ring', start: '2026-10-01', time: '09:00' } })).toBe(true)
  })

  it('la huella cambia si cambia el error', () => {
    expect(problemKey({ kind: 'error', message: 'a' })).not.toBe(problemKey({ kind: 'error', message: 'b' }))
  })
})
