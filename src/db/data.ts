import { db, diskDb, type AppDB } from './db'
import { clearLanguage } from '../i18n'
import { closeVaultSession } from './vault'
import { getSettings, setSettings, type Settings } from './settings'
import { buildBackup, parseBackup, parseCSV, toCSV } from '../domain/backup'
import { today, type ISODate } from '../domain/dates'
import { periodDateSet } from '../domain/periods'

export async function exportJSON(database: AppDB = db): Promise<string> {
  const [periods, days, symptoms, settings] = await Promise.all([
    database.periods.toArray(),
    database.days.toArray(),
    database.symptoms.toArray(),
    getSettings(database),
  ])
  // Datos internos y credenciales del servidor de avisos no se exportan.
  const {
    pushDevice: _d,
    pushSync: _s,
    pushError: _e,
    pinFailures: _f,
    pinLockedUntil: _u,
    lastBackup: _b,
    backupSnoozedOn: _n,
    ...rest
  } = settings
  const backup = buildBackup({
    periods,
    days,
    customSymptoms: symptoms.filter((s) => !s.builtin).map((s) => s.name),
    settings: rest,
  })
  return JSON.stringify(backup, null, 2)
}

export async function exportCSV(database: AppDB = db): Promise<string> {
  const [periods, days] = await Promise.all([database.periods.toArray(), database.days.toArray()])
  return toCSV(periodDateSet(periods, today()), days)
}

/** Descarga la copia completa (JSON) y apunta la fecha para el aviso de copias. */
export async function downloadBackupJSON(): Promise<void> {
  downloadText(`ciclita-${today()}.json`, await exportJSON(), 'application/json')
  await setSettings({ lastBackup: today(), backupSnoozedOn: null })
}

/** Descarga los registros en CSV (también cuenta como copia: se puede importar). */
export async function downloadBackupCSV(): Promise<void> {
  downloadText(`ciclita-${today()}.csv`, await exportCSV(), 'text/csv;charset=utf-8')
  await setSettings({ lastBackup: today(), backupSnoozedOn: null })
}

export interface ImportSummary {
  periods: number
  days: number
}

/** Ajustes que se pueden restaurar desde una copia (nunca el PIN ni datos internos). */
const RESTORABLE: (keyof Settings)[] = [
  'cycleLength',
  'periodLength',
  'theme',
  'reminders',
  'tracking',
  'mode',
  'pregnancyStart',
]

async function replaceAll(
  database: AppDB,
  periods: { startDate: ISODate; endDate: ISODate | null }[],
  days: Parameters<typeof database.days.bulkPut>[0],
  symptoms: string[],
  settings: Partial<Settings>,
) {
  await database.transaction('rw', [database.periods, database.days, database.symptoms, database.settings], async () => {
    await database.periods.clear()
    await database.days.clear()
    await database.periods.bulkAdd(periods)
    await database.days.bulkPut(days)
    const existing = new Set((await database.symptoms.toArray()).map((s) => s.name.toLowerCase()))
    const fresh = [...new Set(symptoms)].filter((s) => !existing.has(s.toLowerCase()))
    await database.symptoms.bulkAdd(fresh.map((name) => ({ name, builtin: false })))
    await setSettings({ ...settings, onboardingDone: true }, database)
  })
}

/**
 * Importa un archivo (.json o .csv) REEMPLAZANDO los periodos y registros actuales.
 * Lanza BackupError si el archivo no es válido.
 */
export async function importFile(
  name: string,
  text: string,
  database: AppDB = db,
): Promise<ImportSummary> {
  if (name.toLowerCase().endsWith('.csv')) {
    const r = parseCSV(text)
    await replaceAll(database, r.periods, r.days, r.symptoms, {})
    return { periods: r.periods.length, days: r.days.length }
  }
  const b = parseBackup(text)
  const settings = Object.fromEntries(
    Object.entries(b.settings).filter(([k]) => RESTORABLE.includes(k as keyof Settings)),
  ) as Partial<Settings>
  const symptoms = [...b.customSymptoms, ...b.days.flatMap((d) => d.symptoms ?? [])]
  await replaceAll(database, b.periods, b.days, symptoms, settings)
  return { periods: b.periods.length, days: b.days.length }
}

/**
 * Borra todos los datos del dispositivo: la base de datos en disco (incluida la
 * bóveda cifrada) y, si estaba desbloqueada, la copia en memoria. La app vuelve al
 * onboarding al recargar.
 */
export async function wipeAll(disk: AppDB = diskDb): Promise<void> {
  await closeVaultSession().catch(() => {})
  await disk.delete()
  clearLanguage()
}

/** Descarga un texto como archivo, sin pasar por ningún servidor. */
export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
