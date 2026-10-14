import { describe, expect, it } from 'vitest'
import type { DayLog } from '../db/db'
import { searchDays } from './search'

const days: DayLog[] = [
  { date: '2026-09-01', symptoms: ['Migraña', 'Náuseas'], medication: 'Ibuprofeno 600', updatedAt: 0 },
  { date: '2026-09-20', notes: 'Hoy tuve una MIGRAÑA muy fuerte después del trabajo', updatedAt: 0 },
  { date: '2026-10-03', symptoms: ['Migraña'], notes: 'Dormí poco', updatedAt: 0 },
  { date: '2026-10-05', mood: 'calm', updatedAt: 0 },
]

describe('searchDays', () => {
  it('no busca con menos de 2 letras', () => {
    expect(searchDays(days, 'm').results).toEqual([])
  })

  it('encuentra en síntomas y notas sin tildes ni mayúsculas, del más reciente al más antiguo', () => {
    const r = searchDays(days, 'migrana')
    expect(r.results.map((x) => x.date)).toEqual(['2026-10-03', '2026-09-20', '2026-09-01'])
    expect(r.results[1].matches[0]).toMatchObject({ field: 'notes', start: 13, length: 7 })
    expect(r.results[1].matches[0].text.slice(13, 20)).toBe('MIGRAÑA')
  })

  it('resume el historial del síntoma', () => {
    expect(searchDays(days, 'migr').symptoms).toEqual([{ name: 'Migraña', days: 2, last: '2026-10-03' }])
  })

  it('busca en la medicación', () => {
    const r = searchDays(days, 'ibupro')
    expect(r.results).toHaveLength(1)
    expect(r.results[0].matches).toEqual([{ field: 'medication', text: 'Ibuprofeno 600', start: 0, length: 6 }])
  })

  it('busca por el nombre traducido del síntoma', () => {
    const en = (s: string) => ({ Náuseas: 'Nausea' })[s] ?? s
    const r = searchDays(days, 'nausea', en)
    expect(r.results[0].matches[0]).toMatchObject({ field: 'symptom', text: 'Nausea' })
  })

  it('recorta las notas largas alrededor de la coincidencia', () => {
    const long = `${'a'.repeat(100)} dolor de espalda ${'b'.repeat(100)}`
    const m = searchDays([{ date: '2026-10-01', notes: long, updatedAt: 0 }], 'espalda').results[0].matches[0]
    expect(m.text.startsWith('…')).toBe(true)
    expect(m.text.endsWith('…')).toBe(true)
    expect(m.text.slice(m.start, m.start + m.length)).toBe('espalda')
  })
})
