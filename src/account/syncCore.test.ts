import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../db/settings'
import {
  mergePeriods,
  mergeSymptoms,
  pickSyncedSettings,
  planDayPush,
  planPush,
  resolveRemoteDay,
  stableHash,
  toLocalDay,
} from './syncCore'

describe('sincronización: reglas', () => {
  it('sube los días nuevos o cambiados y marca como borrados los que ya no están', () => {
    const local = [
      { date: '2026-10-01', notes: 'igual', updatedAt: 1 },
      { date: '2026-10-02', notes: 'cambiado', updatedAt: 5 },
      { date: '2026-10-03', notes: 'nuevo', updatedAt: 2 },
    ]
    const cloud = { '2026-10-01': 1, '2026-10-02': 3, '2026-10-04': 1 }
    const plan = planDayPush(local, cloud)
    expect(plan.upserts.map((d) => d.date)).toEqual(['2026-10-02', '2026-10-03'])
    expect(plan.deletes).toEqual(['2026-10-04'])
  })

  it('un día que llega de la nube: gana el cambio más reciente', () => {
    const local = { date: '2026-10-01', notes: 'aquí', updatedAt: 10 }
    expect(resolveRemoteDay(undefined, { date: '2026-10-01', updatedAt: 5 })).toBe('put')
    expect(resolveRemoteDay(local, { date: '2026-10-01', updatedAt: 20 })).toBe('put')
    expect(resolveRemoteDay(local, { date: '2026-10-01', updatedAt: 5 })).toBe('keep')
    expect(resolveRemoteDay(local, { date: '2026-10-01', updatedAt: 20, deleted: true })).toBe('delete')
    // Borrado en otro dispositivo antes de que aquí se cambiara: se conserva lo de aquí.
    expect(resolveRemoteDay(local, { date: '2026-10-01', updatedAt: 5, deleted: true })).toBe('keep')
  })

  it('el día descargado no lleva los campos propios de la nube', () => {
    expect(toLocalDay({ date: '2026-10-01', updatedAt: 3, notes: 'x', syncedAt: 1 } as never)).toEqual({
      date: '2026-10-01',
      updatedAt: 3,
      notes: 'x',
    })
  })

  it('al unir un dispositivo con datos a una cuenta con datos no se pierde ningún día de periodo', () => {
    const merged = mergePeriods(
      [{ id: 1, startDate: '2026-09-24', endDate: '2026-09-26' }],
      [
        { startDate: '2026-08-19', endDate: '2026-08-24' },
        { startDate: '2026-09-25', endDate: '2026-09-28' },
      ],
      '2026-10-15',
    )
    expect(merged).toEqual([
      { startDate: '2026-08-19', endDate: '2026-08-24' },
      { startDate: '2026-09-24', endDate: '2026-09-28' },
    ])
  })

  it('síntomas personalizados sin duplicados (sin distinguir mayúsculas)', () => {
    expect(mergeSymptoms(['Mareo', 'antojos'], ['mareo', 'Ojeras'])).toEqual(['antojos', 'Mareo', 'Ojeras'])
  })

  it('los ajustes que viajan con la cuenta no incluyen PIN, idioma ni credenciales', () => {
    const synced = pickSyncedSettings({ ...DEFAULT_SETTINGS, pinHash: 'secreto', onboardingDone: true })
    expect(synced).toHaveProperty('onboardingDone', true)
    expect(synced).not.toHaveProperty('pinHash')
    expect(synced).not.toHaveProperty('language')
    expect(synced).not.toHaveProperty('pushDevice')
    expect(synced).not.toHaveProperty('sync')
  })

  it('la huella no depende del orden de las claves', () => {
    expect(stableHash({ b: 1, a: { d: 2, c: 3 } })).toBe(stableHash({ a: { c: 3, d: 2 }, b: 1 }))
  })

  it('citas: sube las nuevas o cambiadas y marca las borradas', () => {
    const plan = planPush(
      [
        { id: 'a', updatedAt: 1 },
        { id: 'b', updatedAt: 5 },
      ],
      (x) => x.id,
      { a: 1, b: 3, c: 2 },
    )
    expect(plan.upserts.map((x) => x.id)).toEqual(['b'])
    expect(plan.deletes).toEqual(['c'])
  })
})
