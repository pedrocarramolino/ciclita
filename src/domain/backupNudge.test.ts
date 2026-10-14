import { describe, expect, it } from 'vitest'
import { backupNudge } from './backupNudge'

const today = '2026-10-14'

describe('backupNudge', () => {
  it('no sugiere nada sin datos', () => {
    expect(backupNudge({ oldestData: null, lastBackup: null, snoozedOn: null, today })).toBeNull()
  })

  it('sin copia, espera a que haya un mes de datos', () => {
    expect(backupNudge({ oldestData: '2026-09-20', lastBackup: null, snoozedOn: null, today })).toBeNull()
    expect(backupNudge({ oldestData: '2026-09-14', lastBackup: null, snoozedOn: null, today })).toEqual({ kind: 'never' })
  })

  it('con copia, la sugiere cuando tiene más de 60 días', () => {
    const base = { oldestData: '2025-01-01', snoozedOn: null, today }
    expect(backupNudge({ ...base, lastBackup: '2026-08-20' })).toBeNull()
    expect(backupNudge({ ...base, lastBackup: '2026-08-15' })).toBeNull()
    expect(backupNudge({ ...base, lastBackup: '2026-08-13' })).toEqual({ kind: 'old', days: 62 })
  })

  it('"Más tarde" la oculta durante 30 días', () => {
    const base = { oldestData: '2025-01-01', lastBackup: null, today }
    expect(backupNudge({ ...base, snoozedOn: '2026-09-20' })).toBeNull()
    expect(backupNudge({ ...base, snoozedOn: '2026-09-14' })).toEqual({ kind: 'never' })
  })
})
