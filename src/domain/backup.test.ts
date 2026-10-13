import { describe, expect, it } from 'vitest'
import type { DayLog, Period } from '../db/db'
import { BackupError, buildBackup, parseBackup, parseCSV, parseCSVRows, toCSV } from './backup'
import { periodDateSet } from './periods'

const periods: Period[] = [
  { startDate: '2026-09-01', endDate: '2026-09-03' },
  { startDate: '2026-09-29', endDate: '2026-09-30' },
]
const days: DayLog[] = [
  { date: '2026-09-01', flow: 'heavy', symptoms: ['Dolor abdominal', 'Cansancio'], pain: 7, updatedAt: 1 },
  { date: '2026-09-15', mood: 'calm', notes: 'Notas con "comillas"; punto y coma\ny salto', updatedAt: 2 },
  { date: '2026-09-20', medication: 'Ibuprofeno, 400 mg', symptoms: ['Migraña'], updatedAt: 3 },
]

describe('copia JSON', () => {
  it('ida y vuelta sin perder datos y sin exportar el PIN', () => {
    const b = buildBackup({
      periods: periods.map((p, i) => ({ ...p, id: i + 1 })),
      days,
      customSymptoms: ['Migraña'],
      settings: { cycleLength: 30, pinHash: 'secreto', theme: 'dark' },
    })
    const json = JSON.stringify(b)
    expect(json).not.toContain('secreto')
    const back = parseBackup(json)
    expect(back.periods).toEqual(periods)
    expect(back.days).toEqual(days)
    expect(back.customSymptoms).toEqual(['Migraña'])
    expect(back.settings).toEqual({ cycleLength: 30, theme: 'dark' })
  })

  it('rechaza archivos que no son copias de la app', () => {
    expect(() => parseBackup('no es json')).toThrow(BackupError)
    expect(() => parseBackup('{"hola": 1}')).toThrow(BackupError)
    expect(() => parseBackup('{"app":"ciclita","version":99}')).toThrow(/más nueva/)
  })

  it('acepta copias hechas con el nombre anterior de la app', () => {
    const b = parseBackup(JSON.stringify({ app: 'registro-mensual', version: 1, periods, days: [] }))
    expect(b.app).toBe('ciclita')
    expect(b.periods).toEqual(periods)
  })

  it('descarta entradas inválidas y nunca importa un PIN', () => {
    const b = parseBackup(
      JSON.stringify({
        app: 'ciclita',
        version: 1,
        periods: [{ startDate: 'ayer', endDate: null }, { startDate: '2026-09-05', endDate: '2026-09-01' }],
        days: [{ date: '2026-09-01', pain: 42, flow: 'raro', mood: 'x', symptoms: [1, ' Acné '] }],
        settings: { pinHash: 'otro' },
      }),
    )
    expect(b.periods).toEqual([])
    expect(b.days[0]).toMatchObject({ date: '2026-09-01', symptoms: ['Acné'] })
    expect(b.days[0].pain).toBeUndefined()
    expect(b.days[0].flow).toBeUndefined()
    expect(b.settings).toEqual({})
  })
})

describe('CSV', () => {
  const csv = toCSV(periodDateSet(periods, '2026-10-13'), days)

  it('exporta cabecera, una fila por día y escapa correctamente', () => {
    const rows = parseCSVRows(csv)
    expect(rows[0]).toEqual(['fecha', 'periodo', 'flujo', 'sintomas', 'animo', 'dolor', 'medicacion', 'notas'])
    expect(rows).toHaveLength(1 + 3 + 2 + 2) // cabecera + periodo 1 + periodo 2 + 2 días sueltos
    expect(rows[1]).toEqual(['2026-09-01', 'sí', 'Abundante', 'Dolor abdominal, Cansancio', '', '7', '', ''])
    const notes = rows.find((r) => r[0] === '2026-09-15')!
    expect(notes[4]).toBe('Calma')
    expect(notes[7]).toBe('Notas con "comillas"; punto y coma\ny salto')
  })

  it('ida y vuelta: reconstruye periodos y registros', () => {
    const back = parseCSV(csv)
    expect(back.periods).toEqual(periods)
    expect(back.days.map(({ updatedAt: _u, ...d }) => d)).toEqual(days.map(({ updatedAt: _u, ...d }) => d))
    expect(back.symptoms.sort()).toEqual(['Cansancio', 'Dolor abdominal', 'Migraña'])
  })

  it('neutraliza celdas que Excel ejecutaría como fórmulas', () => {
    const csv = toCSV(new Set(), [{ date: '2026-09-02', notes: '=HYPERLINK("http://x")', medication: '+1', updatedAt: 0 }])
    const row = parseCSVRows(csv)[1]
    expect(row[6]).toBe("'+1")
    expect(row[7]).toBe(`'=HYPERLINK("http://x")`)
    // Al volver a importar, el texto original se recupera intacto.
    expect(parseCSV(csv).days[0]).toMatchObject({ medication: '+1', notes: '=HYPERLINK("http://x")' })
  })

  it('acepta CSV separados por comas', () => {
    const back = parseCSV('fecha,periodo,flujo\n2026-01-01,sí,Ligero\n2026-01-02,si,\n')
    expect(back.periods).toEqual([{ startDate: '2026-01-01', endDate: '2026-01-02' }])
    expect(back.days).toMatchObject([{ date: '2026-01-01', flow: 'light' }])
  })

  it('rechaza un CSV sin la cabecera esperada', () => {
    expect(() => parseCSV('a;b\n1;2')).toThrow(BackupError)
  })
})
