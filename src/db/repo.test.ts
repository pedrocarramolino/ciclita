import { afterEach, describe, expect, it } from 'vitest'
import { AppDB } from './db'
import { addCustomSymptom, endPeriod, saveDay, setPillTaken, startPeriod } from './repo'

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

describe('setPillTaken', () => {
  it('marca la píldora sin tocar el resto del día y al desmarcar no deja un día vacío', async () => {
    const d = await freshDB()
    await setPillTaken('2026-10-10', true, d)
    expect(await d.days.get('2026-10-10')).toMatchObject({ pillTaken: true })
    await setPillTaken('2026-10-10', false, d)
    expect(await d.days.get('2026-10-10')).toBeUndefined()

    await saveDay('2026-10-11', { mood: 'calm' }, false, d, TODAY)
    await setPillTaken('2026-10-11', true, d)
    expect(await d.days.get('2026-10-11')).toMatchObject({ mood: 'calm', pillTaken: true })
    await setPillTaken('2026-10-11', false, d)
    const day = await d.days.get('2026-10-11')
    expect(day).toMatchObject({ mood: 'calm' })
    expect(day?.pillTaken).toBeUndefined()
  })
})
