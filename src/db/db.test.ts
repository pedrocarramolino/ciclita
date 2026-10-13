import { afterEach, describe, expect, it } from 'vitest'
import { AppDB, BUILTIN_SYMPTOMS } from './db'
import { completeOnboarding, getSettings } from './settings'

let database: AppDB

async function freshDB() {
  database = new AppDB(`test-${crypto.randomUUID()}`)
  await database.open()
  return database
}

afterEach(async () => {
  await database?.delete()
})

describe('base de datos', () => {
  it('carga los síntomas predefinidos al crearse', async () => {
    const d = await freshDB()
    const names = (await d.symptoms.toArray()).map((s) => s.name)
    expect(names).toEqual(BUILTIN_SYMPTOMS)
  })

  it('devuelve ajustes por defecto si no hay nada guardado', async () => {
    const s = await getSettings(await freshDB())
    expect(s.onboardingDone).toBe(false)
    expect(s.theme).toBe('system')
    expect(s.cycleLength).toBeNull()
  })

  it('el onboarding guarda el último periodo y las duraciones', async () => {
    const d = await freshDB()
    await completeOnboarding(
      { lastPeriodStart: '2026-09-20', cycleLength: 30, periodLength: 4 },
      d,
    )
    const s = await getSettings(d)
    expect(s).toMatchObject({ onboardingDone: true, cycleLength: 30, periodLength: 4 })
    expect(await d.periods.toArray()).toEqual([
      { id: 1, startDate: '2026-09-20', endDate: null },
    ])
  })

  it('el onboarding con "No lo sé" no crea periodo ni duraciones', async () => {
    const d = await freshDB()
    await completeOnboarding({ lastPeriodStart: null, cycleLength: null, periodLength: null }, d)
    expect(await d.periods.count()).toBe(0)
    expect((await getSettings(d)).cycleLength).toBeNull()
  })
})
