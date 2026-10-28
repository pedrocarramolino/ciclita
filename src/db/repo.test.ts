import { afterEach, describe, expect, it } from 'vitest'
import { AppDB } from './db'
import {
  addCustomSymptom,
  clearDay,
  endPeriod,
  markPeriodEnd,
  markPeriodRange,
  markPeriodStart,
  restorePeriods,
  saveDay,
  setPillTaken,
  startPeriod,
  undoPeriodEdit,
  unmarkPeriodDay,
} from './repo'

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

    await saveDay('2026-10-11', { moods: ['calm'] }, false, d, TODAY)
    await setPillTaken('2026-10-11', true, d)
    expect(await d.days.get('2026-10-11')).toMatchObject({ moods: ['calm'], pillTaken: true })
    await setPillTaken('2026-10-11', false, d)
    const day = await d.days.get('2026-10-11')
    expect(day).toMatchObject({ moods: ['calm'] })
    expect(day?.pillTaken).toBeUndefined()
  })
})

describe('deshacer inicio / fin de periodo', () => {
  it('startPeriod y endPeriod devuelven el estado anterior y restorePeriods lo recupera', async () => {
    const d = await freshDB()
    await d.periods.add({ startDate: '2026-09-15', endDate: '2026-09-19' })
    const before = await startPeriod(TODAY, d)
    expect(await d.periods.count()).toBe(2)
    await restorePeriods(before, d)
    expect(await d.periods.toArray()).toMatchObject([{ startDate: '2026-09-15', endDate: '2026-09-19' }])

    await startPeriod('2026-10-10', d)
    const beforeEnd = await endPeriod('2026-10-12', d)
    expect((await d.periods.toArray()).at(-1)).toMatchObject({ endDate: '2026-10-12' })
    await restorePeriods(beforeEnd, d)
    expect((await d.periods.toArray()).at(-1)).toMatchObject({ startDate: '2026-10-10', endDate: null })
  })
})

describe('editar periodos en el calendario', () => {
  const periodsOf = async (d: AppDB) =>
    (await d.periods.orderBy('startDate').toArray()).map(({ startDate, endDate }) => ({ startDate, endDate }))

  it('marca un tramo entero de una vez, en cualquier orden, y se une a los periodos vecinos', async () => {
    const d = await freshDB()
    await d.periods.add({ startDate: '2026-09-01', endDate: '2026-09-03' })
    await markPeriodRange('2026-09-08', '2026-09-04', d, TODAY)
    expect(await periodsOf(d)).toEqual([{ startDate: '2026-09-01', endDate: '2026-09-08' }])

    await markPeriodRange('2026-08-05', '2026-08-09', d, TODAY)
    expect(await periodsOf(d)).toEqual([
      { startDate: '2026-08-05', endDate: '2026-08-09' },
      { startDate: '2026-09-01', endDate: '2026-09-08' },
    ])
  })

  it('un periodo en curso sigue en curso si el tramo no cambia su final', async () => {
    const d = await freshDB()
    await d.periods.add({ startDate: '2026-10-11', endDate: null })
    await markPeriodRange('2026-10-08', '2026-10-10', d, TODAY)
    expect(await periodsOf(d)).toEqual([{ startDate: '2026-10-08', endDate: null }])
  })

  it('quitar un día parte el periodo, borra su flujo y se puede deshacer', async () => {
    const d = await freshDB()
    await d.periods.add({ startDate: '2026-09-01', endDate: '2026-09-05' })
    await d.days.put({ date: '2026-09-03', flow: 'heavy', updatedAt: 1 })
    await d.days.put({ date: '2026-09-04', flow: 'light', notes: 'nota', updatedAt: 1 })

    const undo = await unmarkPeriodDay('2026-09-03', d, TODAY)
    expect(await periodsOf(d)).toEqual([
      { startDate: '2026-09-01', endDate: '2026-09-02' },
      { startDate: '2026-09-04', endDate: '2026-09-05' },
    ])
    expect(await d.days.get('2026-09-03')).toBeUndefined()

    const undo2 = await unmarkPeriodDay('2026-09-04', d, TODAY)
    expect(await d.days.get('2026-09-04')).toMatchObject({ notes: 'nota' })
    expect((await d.days.get('2026-09-04'))?.flow).toBeUndefined()

    await undoPeriodEdit(undo2, d)
    await undoPeriodEdit(undo, d)
    expect(await periodsOf(d)).toEqual([{ startDate: '2026-09-01', endDate: '2026-09-05' }])
    expect(await d.days.get('2026-09-03')).toMatchObject({ flow: 'heavy' })
    expect(await d.days.get('2026-09-04')).toMatchObject({ flow: 'light', notes: 'nota' })
  })
})

describe('borrar el registro de un día', () => {
  it('borra lo apuntado y lo quita del periodo; se puede deshacer', async () => {
    const d = await freshDB()
    await d.periods.add({ startDate: '2026-09-01', endDate: '2026-09-05' })
    await d.days.put({ date: '2026-09-03', flow: 'heavy', notes: 'Muy cansada', updatedAt: 1 })

    const undo = await clearDay('2026-09-03', d, TODAY)
    expect(await d.days.get('2026-09-03')).toBeUndefined()
    expect((await d.periods.orderBy('startDate').toArray()).map(({ startDate, endDate }) => [startDate, endDate])).toEqual([
      ['2026-09-01', '2026-09-02'],
      ['2026-09-04', '2026-09-05'],
    ])

    await undoPeriodEdit(undo, d)
    expect(await d.days.get('2026-09-03')).toMatchObject({ notes: 'Muy cansada' })
    expect(await d.periods.count()).toBe(1)
  })
})


describe('comienzo y fin del periodo desde el registro del día', () => {
  it('un comienzo reciente deja el periodo en curso hasta hoy', async () => {
    const db = await freshDB()
    await markPeriodStart('2026-10-11', 5, db, TODAY)
    expect(await db.periods.toArray()).toMatchObject([{ startDate: '2026-10-11', endDate: null }])
  })

  it('un comienzo antiguo marca los días que suele durar y lo da por terminado', async () => {
    const db = await freshDB()
    const undo = await markPeriodStart('2026-09-01', 5, db, TODAY)
    expect(await db.periods.toArray()).toMatchObject([{ startDate: '2026-09-01', endDate: '2026-09-05' }])
    await undoPeriodEdit(undo, db)
    expect(await db.periods.count()).toBe(0)
  })

  it('el fin cierra el periodo en curso, lo acorta o lo alarga', async () => {
    const db = await freshDB()
    await db.periods.add({ startDate: '2026-10-09', endDate: null })
    await markPeriodEnd('2026-10-12', db, TODAY)
    expect(await db.periods.toArray()).toMatchObject([{ startDate: '2026-10-09', endDate: '2026-10-12' }])
    await markPeriodEnd('2026-10-10', db, TODAY)
    expect(await db.periods.toArray()).toMatchObject([{ startDate: '2026-10-09', endDate: '2026-10-10' }])
    await markPeriodEnd('2026-10-13', db, TODAY)
    expect(await db.periods.toArray()).toMatchObject([{ startDate: '2026-10-09', endDate: '2026-10-13' }])
  })

  it('sin un periodo empezado en los 14 días antes no hace nada', async () => {
    const db = await freshDB()
    await db.periods.add({ startDate: '2026-09-01', endDate: '2026-09-05' })
    expect(await markPeriodEnd('2026-10-12', db, TODAY)).toBeNull()
    expect(await db.periods.toArray()).toMatchObject([{ startDate: '2026-09-01', endDate: '2026-09-05' }])
  })
})
