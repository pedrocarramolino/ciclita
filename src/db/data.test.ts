import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppDB } from './db'
import { exportCSV, exportJSON, importFile, wipeAll } from './data'
import { getSettings, setSettings } from './settings'

const dbs: AppDB[] = []
async function freshDB() {
  const d = new AppDB(`test-${crypto.randomUUID()}`)
  dbs.push(d)
  await d.open()
  return d
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

async function seed(d: AppDB) {
  await d.periods.bulkAdd([
    { startDate: '2026-09-01', endDate: '2026-09-04' },
    { startDate: '2026-09-29', endDate: '2026-10-02' },
  ])
  await d.days.bulkPut([
    { date: '2026-09-01', flow: 'heavy', symptoms: ['Migraña'], updatedAt: 1 },
    { date: '2026-09-15', mood: 'calm', notes: 'Todo bien', updatedAt: 2 },
  ])
  await d.symptoms.add({ name: 'Migraña', builtin: false })
  await setSettings(
    {
      cycleLength: 29,
      theme: 'dark',
      pinHash: 'hash-secreto',
      onboardingDone: true,
      pushDevice: { id: 'id-dispositivo', secret: 'secreto-push' },
      lastBackup: '2026-01-02',
      backupSnoozedOn: '2026-03-04',
    },
    d,
  )
}

describe('exportar / importar', () => {
  it('JSON: restaura periodos, registros, síntomas y ajustes, pero no el PIN ni las credenciales push', async () => {
    const a = await freshDB()
    await seed(a)
    const json = await exportJSON(a)
    expect(json).not.toContain('hash-secreto')
    expect(json).not.toContain('secreto-push')
    expect(json).not.toContain('2026-01-02')
    expect(json).not.toContain('2026-03-04')

    const b = await freshDB()
    await setSettings({ pinHash: 'pin-de-b' }, b)
    await b.periods.add({ startDate: '2020-01-01', endDate: '2020-01-03' }) // se reemplaza
    const r = await importFile('copia.json', json, b)

    expect(r).toEqual({ periods: 2, days: 2 })
    expect((await b.periods.toArray()).map((p) => p.startDate)).toEqual(['2026-09-01', '2026-09-29'])
    expect(await b.days.get('2026-09-15')).toMatchObject({ mood: 'calm', notes: 'Todo bien' })
    expect(await b.symptoms.where('name').equals('Migraña').count()).toBe(1)
    const s = await getSettings(b)
    expect(s).toMatchObject({ cycleLength: 29, theme: 'dark', onboardingDone: true, pinHash: 'pin-de-b' })
  })

  it('CSV: ida y vuelta de periodos y registros', async () => {
    const a = await freshDB()
    await seed(a)
    const csv = await exportCSV(a)
    const b = await freshDB()
    const r = await importFile('datos.CSV', csv, b)
    expect(r).toEqual({ periods: 2, days: 2 })
    expect(await b.periods.toArray()).toMatchObject([
      { startDate: '2026-09-01', endDate: '2026-09-04' },
      { startDate: '2026-09-29', endDate: '2026-10-02' },
    ])
    expect(await b.days.get('2026-09-01')).toMatchObject({ flow: 'heavy', symptoms: ['Migraña'] })
  })

  it('un archivo inválido no toca los datos', async () => {
    const d = await freshDB()
    await seed(d)
    await expect(importFile('x.json', '{"nada": true}', d)).rejects.toThrow()
    expect(await d.periods.count()).toBe(2)
  })
})

describe('wipeAll', () => {
  it('borra la base de datos y el idioma elegido', async () => {
    const store = new Map([['ciclita-lang', 'en']])
    const fake = { getItem: (k: string) => store.get(k) ?? null, removeItem: (k: string) => void store.delete(k) }
    vi.stubGlobal('localStorage', fake)
    try {
      const d = await freshDB()
      await seed(d)
      await wipeAll(d)
      expect(store.has('ciclita-lang')).toBe(false)
      expect(await AppDB.exists(d.name)).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
