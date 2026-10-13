import { db, type AppDB } from './db'
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
  const { reminderLog: _l, pinFailures: _f, pinLockedUntil: _u, ...rest } = settings
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

export interface ImportSummary {
  periods: number
  days: number
}

/** Ajustes que se pueden restaurar desde una copia (nunca el PIN ni datos internos). */
const RESTORABLE: (keyof Settings)[] = ['cycleLength', 'periodLength', 'theme', 'reminders']

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
    await setSettings({ ...settings, onboardingDone: true, reminderLog: {} }, database)
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

/** Borra la base de datos completa. La app vuelve al onboarding al recargar. */
export async function wipeAll(database: AppDB = db): Promise<void> {
  await database.delete()
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
