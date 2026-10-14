import { describe, expect, it } from 'vitest'
import type { DayLog, Period } from '../db/db'
import { addDays } from './dates'
import { predict } from './prediction'
import { buildReport } from './report'

const TODAY = '2026-10-13'
const periodsFrom = (starts: string[], len = 5): Period[] =>
  starts.map((s) => ({ startDate: s, endDate: addDays(s, len - 1) }))

// 8 ciclos: los 5 primeros caen fuera de los últimos 3 meses.
const starts = ['2026-02-01', '2026-03-01', '2026-03-31', '2026-04-28', '2026-05-27', '2026-06-25', '2026-07-24', '2026-08-26', '2026-09-24']
const periods = periodsFrom(starts)
const days: DayLog[] = [
  { date: '2026-08-26', flow: 'heavy', pain: 8, symptoms: ['Dolor abdominal'], medication: 'Ibuprofeno 400', updatedAt: 0 },
  { date: '2026-08-27', flow: 'heavy', pain: 6, symptoms: ['Dolor abdominal', 'Cansancio'], medication: 'ibuprofeno 400', updatedAt: 0 },
  { date: '2026-09-10', pain: 0, notes: 'Bien', updatedAt: 0 },
  { date: '2026-09-24', flow: 'medium', pain: 7, symptoms: ['Dolor abdominal'], medication: 'Paracetamol', notes: 'Muy cansada', updatedAt: 0 },
  { date: '2026-03-01', flow: 'light', pain: 2, medication: 'Antiguo', updatedAt: 0 }, // fuera de 3 meses
]
const prediction = predict({ periods, today: TODAY })

describe('buildReport', () => {
  const r = buildReport(periods, days, prediction, { months: 3, includeNotes: false }, TODAY)

  it('limita los datos al intervalo elegido', () => {
    expect(r.from).toBe('2026-07-13')
    expect(r.cycles.map((c) => c.start)).toEqual(['2026-08-26', '2026-07-24'])
    expect(r.medication.map((m) => m.name)).not.toContain('Antiguo')
  })

  it('resume duración, extremos y variación de los ciclos del intervalo', () => {
    expect(r.summary).toMatchObject({ cyclesCount: 2, avgCycle: 31, shortest: 29, longest: 33, variation: 4, avgPeriod: 5 })
    expect(r.summary.lastStart).toBe('2026-09-24')
    expect(r.summary.nextPeriod?.start).toBeDefined()
  })

  it('cuenta los días por intensidad de flujo', () => {
    expect(r.flowDays).toEqual({ spotting: 0, light: 0, medium: 1, heavy: 2 })
  })

  it('resume el dolor: media, máximo y días intensos', () => {
    expect(r.pain).toEqual({ daysWithPain: 3, average: 5.3, max: 8, severeDays: 2 })
  })

  it('agrupa la medicación sin distinguir mayúsculas', () => {
    expect(r.medication).toEqual([
      { name: 'ibuprofeno 400', count: 2, last: '2026-08-27' },
      { name: 'Paracetamol', count: 1, last: '2026-09-24' },
    ])
  })

  it('incluye síntomas con su fase y su momento más habituales', () => {
    expect(r.symptoms[0]).toEqual({ name: 'Dolor abdominal', count: 3, topPhase: 'menstrual', timing: { from: 1, to: 2 } })
  })

  it('no incluye notas salvo que se pida', () => {
    expect(r.notes).toEqual([])
    const withNotes = buildReport(periods, days, prediction, { months: 3, includeNotes: true }, TODAY)
    expect(withNotes.notes).toEqual([
      { date: '2026-09-24', text: 'Muy cansada' },
      { date: '2026-09-10', text: 'Bien' },
    ])
  })

  it('resume los datos de fertilidad y peso, solo si los hay', () => {
    expect(r.fertility).toBeNull()
    const extra: DayLog[] = [
      ...days,
      { date: '2026-09-01', temperature: 36.4, weight: 63, mucus: 'creamy', updatedAt: 0 },
      { date: '2026-09-08', temperature: 36.8, sex: 'unprotected', updatedAt: 0 },
      { date: '2026-09-20', sex: 'protected', weight: 62.2, updatedAt: 0 },
    ]
    const f = buildReport(periods, extra, prediction, { months: 3, includeNotes: false }, TODAY).fertility
    expect(f).toEqual({
      temperature: { count: 2, min: 36.4, max: 36.8 },
      sex: { protected: 1, unprotected: 1 },
      mucusDays: 1,
      weight: { first: 63, last: 62.2, firstDate: '2026-09-01', lastDate: '2026-09-20' },
    })
  })

  it('"todo" empieza en el primer dato registrado', () => {
    const all = buildReport(periods, days, prediction, { months: 'all', includeNotes: false }, TODAY)
    expect(all.from).toBe('2026-02-01')
    expect(all.cycles).toHaveLength(8)
  })

  it('sin datos no falla', () => {
    const empty = buildReport([], [], predict({ periods: [], today: TODAY }), { months: 6, includeNotes: false }, TODAY)
    expect(empty.summary).toMatchObject({ cyclesCount: 0, avgCycle: null, nextPeriod: null })
    expect(empty.pain).toBeNull()
  })
})

describe('buildReport: píldora', () => {
  it('sin envase configurado no hay sección', () => {
    expect(buildReport(periods, days, prediction, { months: 3, includeNotes: false }, TODAY).pill).toBeNull()
  })

  it('cuenta tomas y lista los olvidos más recientes', () => {
    const taken: DayLog[] = ['2026-10-10', '2026-10-12'].map((date) => ({ date, pillTaken: true, updatedAt: 0 }))
    const pill = { pack: 28 as const, start: '2026-10-10' }
    const r = buildReport(periods, taken, prediction, { months: 3, includeNotes: false, pill }, TODAY).pill
    expect(r).toEqual({ expected: 3, taken: 2, missed: ['2026-10-11'], missedTotal: 1 })
  })

  it('limita la lista de olvidos pero no el total', () => {
    const pill = { pack: 28 as const, start: '2026-07-01' }
    const r = buildReport(periods, [], prediction, { months: 'all', includeNotes: false, pill }, TODAY).pill!
    expect(r.missed).toHaveLength(31)
    expect(r.missed[0]).toBe('2026-10-12')
    expect(r.missedTotal).toBeGreaterThan(31)
  })
})
