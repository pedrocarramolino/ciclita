import { db, diskDb, type AppDB } from './db'
import { saveFile } from '../files'
import { encryptBackup } from '../security/backupCrypto'
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
    biometric: _bio,
    lastBackup: _b,
    backupSnoozedOn: _n,
    periodEndSnooze: _p,
    sync: _sync,
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

/**
 * Descarga la copia completa (JSON) y apunta la fecha para el aviso de copias.
 * Devuelve false si no se llegó a guardar.
 */
export async function downloadBackupJSON(): Promise<boolean> {
  const saved = await downloadText(`ciclita-${today()}.json`, await exportJSON(), 'application/json')
  if (saved) await setSettings({ lastBackup: today(), backupSnoozedOn: null })
  return saved
}

/**
 * Copia completa cifrada con contraseña (ver security/backupCrypto), lista para
 * guardar. Se separa de guardarla porque cifrar tarda: en iOS el menú Compartir
 * tiene que abrirse justo al tocar un botón.
 */
export async function encryptedBackupFile(password: string): Promise<File> {
  const text = await encryptBackup(await exportJSON(), password)
  return new File([text], `ciclita-${today()}-cifrada.json`, { type: 'application/json' })
}

/** Guarda un archivo de copia y, si se guarda, apunta la fecha para el aviso de copias. */
export async function saveBackupFile(file: File): Promise<boolean> {
  const saved = await saveFile(file)
  if (saved) await setSettings({ lastBackup: today(), backupSnoozedOn: null })
  return saved
}

/** Descarga los registros en CSV (también cuenta como copia: se puede importar). */
export async function downloadBackupCSV(): Promise<boolean> {
  const saved = await downloadText(`ciclita-${today()}.csv`, await exportCSV(), 'text/csv;charset=utf-8')
  if (saved) await setSettings({ lastBackup: today(), backupSnoozedOn: null })
  return saved
}

export interface ImportSummary {
  periods: number
  days: number
}

/** Ajustes que se pueden restaurar desde una copia (nunca el PIN ni datos internos). */
const RESTORABLE: (keyof Settings)[] = [
  'cycleLength',
  'periodLength',
  'manualPrediction',
  'ignoreCyclesOver',
  'showCycleDays',
  'theme',
  'reminders',
  'tracking',
  'mode',
  'pregnancyStart',
  'pill',
  'confirmedLongCycles',
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
export function downloadText(filename: string, text: string, type: string): Promise<boolean> {
  return saveFile(new File([text], filename, { type }))
}
