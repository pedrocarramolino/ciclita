import { afterEach, describe, expect, it } from 'vitest'
import { AppDB } from './db'
import { addCustomSymptom, endPeriod, saveDay, startPeriod } from './repo'

const TODAY = '2026-10-13'
let database: AppDB

async function freshDB() {
  database = new AppDB(`test-${crypto.randomUUID()}`)
  await database.open()
  return database
}

afterEach(async () => {
  await database?.delete()
})

describe('saveDay', () => {
  it('guarda el registro y crea el periodo', async () => {
    const d = await freshDB()
    await saveDay('2026-10-10', { flow: 'medium', pain: 4, symptoms: ['Acné'] }, true, d, TODAY)
    expect(await d.periods.toArray()).toMatchObject([{ startDate: '2026-10-10', endDate: '2026-10-10' }])
    expect(await d.days.get('2026-10-10')).toMatchObject({ flow: 'medium', pain: 4, symptoms: ['Acné'] })
  })

  it('quitar el periodo borra el flujo, y un día vacío no deja registro', async () => {
    const d = await freshDB()
    await saveDay('2026-10-10', { flow: 'light' }, true, d, TODAY)
    await saveDay('2026-10-10', { flow: 'light', notes: '   ' }, false, d, TODAY)
    expect(await d.periods.count()).toBe(0)
    expect(await d.days.get('2026-10-10')).toBeUndefined()
  })
})

describe('startPeriod / endPeriod', () => {
  it('abre un periodo en curso y lo cierra', async () => {
    const d = await freshDB()
    await startPeriod('2026-10-10', d)
    expect(await d.periods.toArray()).toMatchObject([{ startDate: '2026-10-10', endDate: null }])
    await endPeriod('2026-10-14', d)
    expect(await d.periods.toArray()).toMatchObject([{ startDate: '2026-10-10', endDate: '2026-10-14' }])
  })

  it('no duplica si ya hay periodo ese día', async () => {
    const d = await freshDB()
    await startPeriod('2026-10-10', d)
    await startPeriod('2026-10-10', d)
    expect(await d.periods.count()).toBe(1)
  })

  it('se une al periodo que terminó el día anterior', async () => {
    const d = await freshDB()
    await d.periods.add({ startDate: '2026-10-07', endDate: '2026-10-09' })
    await startPeriod('2026-10-10', d)
    expect(await d.periods.toArray()).toMatchObject([{ startDate: '2026-10-07', endDate: null }])
  })
})

describe('addCustomSymptom', () => {
  it('añade el síntoma una sola vez, sin distinguir mayúsculas', async () => {
    const d = await freshDB()
    expect(await addCustomSymptom('  dolor de oído ', d)).toBe('Dolor de oído')
    expect(await addCustomSymptom('DOLOR DE OIDO', d)).toBe('Dolor de oído')
    expect(await d.symptoms.where('name').equals('Dolor de oído').count()).toBe(1)
  })

  it('si el síntoma ya está en el catálogo, lo usa sin crear uno nuevo', async () => {
    const d = await freshDB()
    const before = await d.symptoms.count()
    expect(await addCustomSymptom('nauseas', d)).toBe('Náuseas')
    expect(await addCustomSymptom('sofocos', d)).toBe('Sofocos')
    expect(await d.symptoms.count()).toBe(before)
  })

  it('reutiliza un síntoma predefinido', async () => {
    const d = await freshDB()
    expect(await addCustomSymptom('acné', d)).toBe('Acné')
  })
})
