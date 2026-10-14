import { describe, expect, it } from 'vitest'
import { parseCSV } from '../domain/backup'
import { CATALOG_SYMPTOMS, findCatalogSymptom } from '../domain/symptoms'
import { en, es, lang, symptomLabel } from '.'

describe('idiomas', () => {
  it('el español es el idioma por defecto', () => {
    expect(lang).toBe('es')
    expect(symptomLabel('Dolor de cabeza')).toBe('Dolor de cabeza')
  })

  it('todos los síntomas del catálogo tienen nombre en inglés', () => {
    expect(CATALOG_SYMPTOMS.filter((s) => !en.symptomNames[s])).toEqual([])
    expect(Object.keys(en.symptomNames).filter((s) => !CATALOG_SYMPTOMS.includes(s))).toEqual([])
  })

  it('las cabeceras CSV tienen las mismas columnas', () => {
    expect(en.csv.header).toHaveLength(es.csv.header.length)
  })

  it('reconoce síntomas escritos en inglés', () => {
    expect(findCatalogSymptom('headache')).toBe('Dolor de cabeza')
    expect(findCatalogSymptom('Hot Flushes')).toBe('Sofocos')
  })

  it('importa un CSV exportado en inglés', () => {
    const csv = [
      en.csv.header.join(';'),
      '2026-01-01;yes;Heavy;Headache, Something else;Calm;6;;;36.6;Egg white;Protected;62.5',
      '2026-01-02;yes;Light;;;;;;;;;',
    ].join('\r\n')
    const r = parseCSV(csv)
    expect(r.periods).toHaveLength(1)
    expect(r.periods[0]).toMatchObject({ startDate: '2026-01-01', endDate: '2026-01-02' })
    expect(r.days[0]).toMatchObject({
      flow: 'heavy',
      symptoms: ['Dolor de cabeza', 'Something else'],
      mood: 'calm',
      pain: 6,
      temperature: 36.6,
      mucus: 'eggwhite',
      sex: 'protected',
      weight: 62.5,
    })
  })
})

describe('momento habitual de un síntoma', () => {
  it('frases en español', () => {
    expect(es.stats.timing(1, 3)).toBe('Suele aparecer entre los días 1 y 3 del ciclo')
    expect(es.stats.timing(14, 14)).toBe('Suele aparecer el día 14 del ciclo')
    expect(es.stats.timing(-1, -1)).toBe('Suele aparecer el día antes del periodo')
    expect(es.stats.timing(-3, -1)).toBe('Suele aparecer entre 1 y 3 días antes del periodo')
    expect(es.stats.timing(-2, 2)).toBe('Suele aparecer desde 2 días antes del periodo hasta el día 2')
    expect(es.stats.timingShort(-2, -1)).toBe('1–2 días antes del periodo')
    expect(es.stats.timingShort(-1, 2)).toBe('de 1 día antes del periodo al día 2')
  })
})
