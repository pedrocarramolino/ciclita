import { describe, expect, it } from 'vitest'
import { addDays } from './dates'
import { predict } from './prediction'
import { addYears, buildEventReminders, checkupEvents, contraceptionEvents, MAX_EVENTS, type EventSettings } from './reminderEvents'

const TODAY = '2026-10-13'
const off: EventSettings = {
  fertileEnabled: false,
  breastExamEnabled: false,
  contraception: { method: 'none', start: null, time: '21:00' },
}

describe('pautas de anticonceptivos', () => {
  it('anillo: retirar el día 21 y poner uno nuevo el día 28, en cada ciclo', () => {
    expect(contraceptionEvents('ring', '2026-10-01', '2026-10-01', '2026-11-30')).toEqual([
      { date: '2026-10-22', type: 'ring-remove' },
      { date: '2026-10-29', type: 'ring-insert' },
      { date: '2026-11-19', type: 'ring-remove' },
      { date: '2026-11-26', type: 'ring-insert' },
    ])
  })

  it('parche: cambios semanales, semana de descanso y parche nuevo', () => {
    expect(contraceptionEvents('patch', '2026-10-01', '2026-10-01', '2026-10-29').map((e) => [e.date, e.type])).toEqual([
      ['2026-10-08', 'patch-change'],
      ['2026-10-15', 'patch-change'],
      ['2026-10-22', 'patch-remove'],
      ['2026-10-29', 'patch-new'],
    ])
  })

  it('inyección: cada 12 semanas, con aviso una semana antes', () => {
    expect(contraceptionEvents('injection', '2026-09-01', '2026-09-01', '2027-03-01')).toEqual([
      { date: '2026-11-17', type: 'injection-soon' },
      { date: '2026-11-24', type: 'injection-due' },
      { date: '2027-02-09', type: 'injection-soon' },
      { date: '2027-02-16', type: 'injection-due' },
    ])
  })

  it('con un inicio antiguo solo devuelve las fechas desde hoy', () => {
    const e = contraceptionEvents('ring', '2025-01-06', TODAY, addDays(TODAY, 60))
    expect(e.every((x) => x.date >= TODAY)).toBe(true)
    expect(e.length).toBeGreaterThan(0)
  })
})

describe('buildEventReminders', () => {
  const prediction = predict({ periods: [{ startDate: '2026-10-03', endDate: '2026-10-07' }], today: TODAY })

  it('sin nada activado no hay avisos', () => {
    expect(buildEventReminders(off, prediction, TODAY)).toEqual([])
  })

  it('anticonceptivo a su hora, ordenado por fecha', () => {
    const e = buildEventReminders({ ...off, contraception: { method: 'ring', start: '2026-10-01', time: '21:00' } }, prediction, TODAY)
    expect(e[0]).toEqual({ date: '2026-10-22', time: '21:00', type: 'ring-remove' })
    expect(e.every((x, i) => i === 0 || e[i - 1].date <= x.date)).toBe(true)
  })

  it('ventana fértil: el día anterior a cada ventana prevista', () => {
    const e = buildEventReminders({ ...off, fertileEnabled: true }, prediction, TODAY)
    const firstWindow = prediction.fertileWindows.find((w) => addDays(w.start, -1) >= TODAY)!
    expect(e[0]).toEqual({ date: addDays(firstWindow.start, -1), time: '09:00', type: 'fertile' })
  })

  it('autoexploración: una semana después de cada inicio de periodo', () => {
    const e = buildEventReminders({ ...off, breastExamEnabled: true }, prediction, TODAY)
    expect(e.map((x) => x.date)).toEqual(prediction.nextPeriods.map((p) => addDays(p.start, 7)))
  })

  it('no supera el máximo', () => {
    const e = buildEventReminders(
      { fertileEnabled: true, breastExamEnabled: true, contraception: { method: 'patch', start: '2026-10-01', time: '09:00' } },
      prediction,
      TODAY,
    )
    expect(e.length).toBeLessThanOrEqual(MAX_EVENTS)
  })
})

describe('aviso de envase nuevo de la píldora', () => {
  const off: EventSettings = {
    fertileEnabled: false,
    breastExamEnabled: false,
    contraception: { method: 'none', start: null, time: '09:00' },
  }

  it('el último día de descanso de cada envase, a la hora de la píldora', () => {
    const e = buildEventReminders({ ...off, pillPack: { active: 21, start: '2026-10-01', time: '22:00' } }, null, '2026-10-20')
    expect(e.slice(0, 3)).toEqual([
      { date: '2026-10-28', time: '22:00', type: 'pill-new-pack' },
      { date: '2026-11-25', time: '22:00', type: 'pill-new-pack' },
      { date: '2026-12-23', time: '22:00', type: 'pill-new-pack' },
    ])
  })

  it('con envase de 28 seguidas o sin envase no hay aviso', () => {
    expect(buildEventReminders({ ...off, pillPack: { active: 28, start: '2026-10-01', time: '22:00' } }, null, '2026-10-20')).toEqual([])
    expect(buildEventReminders({ ...off, pillPack: null }, null, '2026-10-20')).toEqual([])
  })
})

describe('revisión médica', () => {
  it('addYears respeta el 29 de febrero', () => {
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28')
    expect(addYears('2026-10-14', 2)).toBe('2028-10-14')
  })

  it('cada año: sigue avisando en los años siguientes aunque la fecha ya pasara', () => {
    expect(checkupEvents({ date: '2024-11-20', yearly: true }, '2026-10-20', '2027-02-17')).toEqual([
      { date: '2026-11-13', type: 'checkup-soon' },
      { date: '2026-11-20', type: 'checkup-due' },
    ])
  })

  it('sin repetir: solo esa fecha', () => {
    expect(checkupEvents({ date: '2024-11-20', yearly: false }, '2026-10-20', '2027-02-17')).toEqual([])
    expect(checkupEvents({ date: '2026-10-24', yearly: false }, '2026-10-20', '2027-02-17')).toEqual([
      { date: '2026-10-24', type: 'checkup-due' },
    ])
  })
})

