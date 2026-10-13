import { describe, expect, it } from 'vitest'
import type { DayLog } from '../db/db'
import { BUILTIN_SYMPTOMS } from '../db/db'
import { CATALOG_SYMPTOMS, DEFAULT_FREQUENT, findCatalogSymptom, frequentSymptoms } from './symptoms'

const day = (date: string, symptoms: string[]): DayLog => ({ date, symptoms, updatedAt: 0 })

describe('catálogo de síntomas', () => {
  it('incluye todos los síntomas que ya existían (no se pierde nada)', () => {
    for (const s of BUILTIN_SYMPTOMS) expect(CATALOG_SYMPTOMS).toContain(s)
  })

  it('no tiene duplicados', () => {
    expect(new Set(CATALOG_SYMPTOMS).size).toBe(CATALOG_SYMPTOMS.length)
  })

  it('encuentra síntomas sin distinguir mayúsculas ni tildes', () => {
    expect(findCatalogSymptom('  nauseas ')).toBe('Náuseas')
    expect(findCatalogSymptom('MIGRAÑA')).toBe('Migraña')
    expect(findCatalogSymptom('algo raro')).toBeUndefined()
  })
})

describe('frequentSymptoms', () => {
  it('sin historial muestra los habituales', () => {
    expect(frequentSymptoms([])).toEqual(DEFAULT_FREQUENT)
  })

  it('ordena por uso e incluye los personalizados', () => {
    const days = [day('a', ['Migraña', 'Mi síntoma']), day('b', ['Migraña']), day('c', ['Mi síntoma', 'Migraña'])]
    const f = frequentSymptoms(days, 4)
    expect(f.slice(0, 2)).toEqual(['Migraña', 'Mi síntoma'])
    expect(f).toHaveLength(4)
  })
})
