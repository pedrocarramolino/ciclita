import { describe, expect, it } from 'vitest'
import type { DayLog, Period } from '../db/db'
import { BackupError, buildBackup, CSV_HEADER, parseBackup, parseCSV, parseCSVRows, toCSV } from './backup'
import { periodDateSet } from './periods'

const periods: Period[] = [
  { startDate: '2026-09-01', endDate: '2026-09-03' },
  { startDate: '2026-09-29', endDate: '2026-09-30' },
]
const days: DayLog[] = [
  { date: '2026-09-01', flow: 'heavy', symptoms: ['Dolor abdominal', 'Cansancio'], pain: 7, updatedAt: 1 },
  { date: '2026-09-15', moods: ['calm', 'tired'], notes: 'Notas con "comillas"; punto y coma\ny salto', updatedAt: 2 },
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
    expect(rows[0]).toEqual(CSV_HEADER)
    expect(CSV_HEADER.slice(-9)).toEqual([
      'temperatura',
      'moco',
      'relaciones',
      'peso',
      'pildora',
      'test_ovulacion',
      'test_embarazo',
      'tension',
      'pulso',
    ])
    expect(rows).toHaveLength(1 + 3 + 2 + 2) // cabecera + periodo 1 + periodo 2 + 2 días sueltos
    expect(rows[1]).toEqual(['2026-09-01', 'sí', 'Abundante', 'Dolor abdominal, Cansancio', '', '7', '', '', '', '', '', '', '', '', '', '', ''])
    const notes = rows.find((r) => r[0] === '2026-09-15')!
    expect(notes[4]).toBe('Calma, Sin energía')
    expect(notes[7]).toBe('Notas con "comillas"; punto y coma\ny salto')
  })

  it('ida y vuelta: reconstruye periodos y registros', () => {
    const back = parseCSV(csv)
    expect(back.periods).toEqual(periods)
    expect(back.days.map(({ updatedAt: _u, ...d }) => d)).toEqual(days.map(({ updatedAt: _u, ...d }) => d))
    expect(back.symptoms.sort()).toEqual(['Cansancio', 'Dolor abdominal', 'Migraña'])
  })

  it('los estados de ánimo nuevos también van y vuelven en el CSV', () => {
    const back = parseCSV(toCSV(new Set(), [{ date: '2026-09-02', moods: ['moodSwings', 'stressed'], updatedAt: 0 }]))
    expect(back.days[0].moods).toEqual(['moodSwings', 'stressed'])
    // Las copias antiguas (un solo ánimo) se siguen leyendo.
    expect(parseBackup(JSON.stringify(buildBackup({ periods: [], days: [{ date: '2026-09-02', mood: 'sad', updatedAt: 0 }], customSymptoms: [], settings: {} as never }))).days[0].moods).toEqual(['sad'])
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

describe('datos de fertilidad', () => {
  const fertile: DayLog = { date: '2026-09-14', temperature: 36.55, mucus: 'eggwhite', sex: 'unprotected', weight: 62.5, updatedAt: 1 }

  it('CSV: se exportan con coma decimal y vuelven intactos', () => {
    const csv = toCSV(new Set(), [fertile])
    const col = (name: string) => parseCSVRows(csv)[1][CSV_HEADER.indexOf(name)]
    expect(['temperatura', 'moco', 'relaciones', 'peso'].map(col)).toEqual(['36,55', 'Clara de huevo', 'Sin protección', '62,5'])
    const { updatedAt: _u, ...expected } = fertile
    expect(parseCSV(csv).days[0]).toMatchObject(expected)
  })

  it('JSON: se conservan y se descartan valores imposibles', () => {
    const b = parseBackup(
      JSON.stringify({
        app: 'ciclita',
        version: 1,
        days: [fertile, { date: '2026-09-15', temperature: 80, weight: -3, mucus: 'raro', sex: 'quizá', updatedAt: 1 }],
      }),
    )
    expect(b.days[0]).toMatchObject({ temperature: 36.55, mucus: 'eggwhite', sex: 'unprotected', weight: 62.5 })
    expect(b.days[1]).toMatchObject({ temperature: undefined, weight: undefined, mucus: undefined, sex: undefined })
  })

  it('un CSV antiguo sin las columnas nuevas se sigue importando', () => {
    const old = ['fecha;periodo;flujo;sintomas;animo;dolor;medicacion;notas', '2026-01-01;sí;Ligero;;;;;', ''].join('\r\n')
    expect(parseCSV(old).periods).toEqual([{ startDate: '2026-01-01', endDate: '2026-01-01' }])
  })
})

describe('píldora', () => {
  it('CSV: la toma va y vuelve en la columna "pildora"', () => {
    const csv = toCSV(new Set(), [{ date: '2026-10-01', pillTaken: true, updatedAt: 1 }])
    expect(parseCSVRows(csv)[1][CSV_HEADER.indexOf('pildora')]).toBe('sí')
    expect(parseCSV(csv).days).toEqual([expect.objectContaining({ date: '2026-10-01', pillTaken: true })])
  })

  it('JSON: solo acepta pillTaken verdadero', () => {
    const b = parseBackup(
      JSON.stringify({
        app: 'ciclita',
        version: 1,
        periods: [],
        days: [
          { date: '2026-10-01', pillTaken: true },
          { date: '2026-10-02', pillTaken: 'sí', notes: 'x' },
        ],
      }),
    )
    expect(b.days.map((d) => d.pillTaken)).toEqual([true, undefined])
  })
})

describe('tests, tensión y pulso', () => {
  const day: DayLog = {
    date: '2026-10-05',
    ovulationTest: 'positive',
    pregnancyTest: 'negative',
    systolic: 118,
    diastolic: 76,
    pulse: 68,
    updatedAt: 1,
  }

  it('CSV: van y vuelven en sus columnas', () => {
    const csv = toCSV(new Set(), [day])
    const row = parseCSVRows(csv)[1]
    const col = (name: string) => row[CSV_HEADER.indexOf(name)]
    expect(['test_ovulacion', 'test_embarazo', 'tension', 'pulso'].map(col)).toEqual(['Positivo', 'Negativo', '118/76', '68'])
    expect(parseCSV(csv).days).toEqual([expect.objectContaining({ ...day, updatedAt: expect.any(Number) })])
  })

  it('JSON: descarta valores imposibles y la tensión incompleta o al revés', () => {
    const backup = buildBackup({ periods: [], days: [day], customSymptoms: [], settings: {} })
    const ok = parseBackup(JSON.stringify(backup))
    expect(ok.days[0]).toMatchObject({ ovulationTest: 'positive', systolic: 118, diastolic: 76, pulse: 68 })

    const bad = parseBackup(
      JSON.stringify({
        ...backup,
        days: [
          { date: '2026-10-06', ovulationTest: 'quizá', systolic: 80, diastolic: 120, pulse: 500, updatedAt: 1 },
          { date: '2026-10-07', systolic: 120, updatedAt: 1 },
        ],
      }),
    )
    for (const d of bad.days) {
      expect(d.ovulationTest).toBeUndefined()
      expect(d.systolic).toBeUndefined()
      expect(d.diastolic).toBeUndefined()
      expect(d.pulse).toBeUndefined()
    }
  })
})
