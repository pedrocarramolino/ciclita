import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { AppDB } from './db'
import { migrateLegacyDb } from './migrate'

const opened: AppDB[] = []
const names = () => {
  const id = crypto.randomUUID()
  return { legacy: `legacy-${id}`, target: `target-${id}` }
}
async function make(name: string) {
  const d = new AppDB(name)
  opened.push(d)
  await d.open()
  return d
}
afterEach(async () => {
  await Promise.all(opened.splice(0).map((d) => d.delete()))
})

describe('migrateLegacyDb', () => {
  it('sin base antigua no hace nada', async () => {
    const n = names()
    const target = await make(n.target)
    expect(await migrateLegacyDb(target, n.legacy)).toBe(false)
    expect(await Dexie.exists(n.legacy)).toBe(false)
  })

  it('copia periodos, registros, síntomas y ajustes, y borra la base antigua', async () => {
    const n = names()
    const legacy = await make(n.legacy)
    await legacy.periods.add({ startDate: '2026-09-01', endDate: '2026-09-05' })
    await legacy.days.add({ date: '2026-09-01', flow: 'heavy', symptoms: ['Migraña'], updatedAt: 1 })
    await legacy.symptoms.add({ name: 'Migraña', builtin: false })
    await legacy.settings.bulkAdd([
      { key: 'onboardingDone', value: true },
      { key: 'pinHash', value: 'hash' },
    ])
    legacy.close()

    const target = await make(n.target)
    expect(await migrateLegacyDb(target, n.legacy)).toBe(true)

    expect(await target.periods.toArray()).toMatchObject([{ startDate: '2026-09-01', endDate: '2026-09-05' }])
    expect(await target.days.get('2026-09-01')).toMatchObject({ flow: 'heavy', symptoms: ['Migraña'] })
    expect(await target.symptoms.where('name').equals('Migraña').count()).toBe(1)
    expect(await target.symptoms.where('name').equals('Acné').count()).toBe(1)
    expect((await target.settings.get('pinHash'))?.value).toBe('hash')
    expect(await Dexie.exists(n.legacy)).toBe(false)
  })

  it('si la base nueva ya tiene datos, no la sobrescribe y conserva la antigua', async () => {
    const n = names()
    const legacy = await make(n.legacy)
    await legacy.periods.add({ startDate: '2026-01-01', endDate: '2026-01-05' })
    legacy.close()
    const target = await make(n.target)
    await target.periods.add({ startDate: '2026-10-01', endDate: '2026-10-04' })

    expect(await migrateLegacyDb(target, n.legacy)).toBe(false)
    expect((await target.periods.toArray()).map((p) => p.startDate)).toEqual(['2026-10-01'])
    expect(await Dexie.exists(n.legacy)).toBe(true)
  })
})
