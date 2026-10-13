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
  /** Hash PBKDF2 del PIN; null = sin PIN. */
  pinHash: string | null
  /** Intentos fallidos seguidos y momento (ms) hasta el que el PIN está bloqueado. */
  pinFailures: number
  pinLockedUntil: number
  reminders: ReminderSettings
  /** Última vez que se mostró cada recordatorio (para no repetirlo). */
  reminderLog: ReminderLog
}

export interface ReminderSettings {
  periodEnabled: boolean
  periodDaysBefore: number
  dailyEnabled: boolean
  /** 'HH:MM' */
  dailyTime: string
  pillEnabled: boolean
  pillTime: string
  /** Textos neutros que no revelan el motivo en la pantalla de bloqueo. */
  discreet: boolean
}

export interface ReminderLog {
  /** Inicio previsto del periodo sobre el que ya se avisó. */
  period?: ISODate
  daily?: ISODate
  pill?: ISODate
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  periodEnabled: false,
  periodDaysBefore: 2,
  dailyEnabled: false,
  dailyTime: '21:00',
  pillEnabled: false,
  pillTime: '22:00',
  discreet: true,
}

export const DEFAULT_SETTINGS: Settings = {
  onboardingDone: false,
  cycleLength: null,
  periodLength: null,
  theme: 'system',
  language: 'es',
  pinHash: null,
  pinFailures: 0,
  pinLockedUntil: 0,
  reminders: DEFAULT_REMINDERS,
  reminderLog: {},
}

export async function getSettings(database: AppDB = db): Promise<Settings> {
  const rows = await database.settings.toArray()
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    reminders: { ...DEFAULT_REMINDERS, ...stored.reminders },
  }
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
