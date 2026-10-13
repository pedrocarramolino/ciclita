import { db, type AppDB } from './db'
import type { ISODate } from '../domain/dates'
import type { ContraceptionMethod } from '../domain/reminderEvents'

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
  /** Datos opcionales que se muestran en el registro diario. */
  tracking: TrackingSettings
  /**
   * Credenciales de este dispositivo en el servidor de notificaciones (Upstash).
   * Se generan al activar el primer recordatorio; nunca se exportan.
   */
  pushDevice: PushDevice | null
  /** Último contenido sincronizado con el servidor y cuándo. */
  pushSync: { payload: string; at: number } | null
  /** Último error al sincronizar los recordatorios (null = todo bien). */
  pushError: string | null
}

export interface PushDevice {
  id: string
  secret: string
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
  /** Aviso el día antes de la ventana fértil prevista. */
  fertileEnabled: boolean
  /** Autoexploración de mama, una semana después de cada periodo. */
  breastExamEnabled: boolean
  /** Anticonceptivo con pauta (anillo, parche, inyección) y su fecha de inicio. */
  contraception: { method: ContraceptionMethod; start: ISODate | null; time: string }
}

export interface TrackingSettings {
  temperature: boolean
  mucus: boolean
  sex: boolean
  weight: boolean
}

export const DEFAULT_TRACKING: TrackingSettings = {
  temperature: false,
  mucus: false,
  sex: false,
  weight: false,
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  periodEnabled: false,
  periodDaysBefore: 2,
  dailyEnabled: false,
  dailyTime: '21:00',
  pillEnabled: false,
  pillTime: '22:00',
  discreet: true,
  fertileEnabled: false,
  breastExamEnabled: false,
  contraception: { method: 'none', start: null, time: '09:00' },
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
  tracking: DEFAULT_TRACKING,
  pushDevice: null,
  pushSync: null,
  pushError: null,
}

export async function getSettings(database: AppDB = db): Promise<Settings> {
  const rows = await database.settings.toArray()
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    reminders: {
      ...DEFAULT_REMINDERS,
      ...stored.reminders,
      contraception: { ...DEFAULT_REMINDERS.contraception, ...stored.reminders?.contraception },
    },
    tracking: { ...DEFAULT_TRACKING, ...stored.tracking },
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
