import { db, type AppDB } from './db'
import type { ISODate } from '../domain/dates'

export type Theme = 'light' | 'dark' | 'system'

/** Ajustes de la app con sus tipos. Se guardan como filas clave/valor. */
export interface Settings {
  onboardingDone: boolean
  /** Duración habitual indicada por la usuaria; null = "No lo sé". */
  cycleLength: number | null
  periodLength: number | null
  theme: Theme
  language: 'es'
  /** Hash PBKDF2 del PIN (fase 5). */
  pinHash: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  onboardingDone: false,
  cycleLength: null,
  periodLength: null,
  theme: 'system',
  language: 'es',
  pinHash: null,
}

export async function getSettings(database: AppDB = db): Promise<Settings> {
  const rows = await database.settings.toArray()
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return { ...DEFAULT_SETTINGS, ...stored } as Settings
}

export async function setSettings(
  patch: Partial<Settings>,
  database: AppDB = db,
): Promise<void> {
  await database.settings.bulkPut(
    Object.entries(patch).map(([key, value]) => ({ key, value })),
  )
}

export interface OnboardingResult {
  lastPeriodStart: ISODate | null
  cycleLength: number | null
  periodLength: number | null
}

/** Guarda lo indicado en el onboarding y lo marca como completado. */
export async function completeOnboarding(
  r: OnboardingResult,
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', database.periods, database.settings, async () => {
    if (r.lastPeriodStart) {
      const exists = await database.periods.where('startDate').equals(r.lastPeriodStart).count()
      if (!exists) {
        await database.periods.add({ startDate: r.lastPeriodStart, endDate: null })
      }
    }
    await setSettings(
      { cycleLength: r.cycleLength, periodLength: r.periodLength, onboardingDone: true },
      database,
    )
  })
}
