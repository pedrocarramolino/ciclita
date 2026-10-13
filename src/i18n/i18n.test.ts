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
