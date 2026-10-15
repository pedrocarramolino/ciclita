import type { Lang } from '../i18n'
import { db, type AppDB } from './db'
import { addDays, today as todayISO, type ISODate } from '../domain/dates'
import { DEFAULT_PERIOD_LENGTH } from '../domain/prediction'
import type { ContraceptionMethod } from '../domain/reminderEvents'
import type { AppMode } from '../domain/modes'
import type { PillPack } from '../domain/pill'
import type { SyncState } from '../account/syncCore'

export type Theme = 'light' | 'dark' | 'system'

/** Ajustes de la app con sus tipos. Se guardan como filas clave/valor. */
export interface Settings {
  onboardingDone: boolean
  /** Duración habitual indicada por la usuaria; null = "No lo sé". */
  cycleLength: number | null
  periodLength: number | null
  /** Previsión con las duraciones indicadas en lugar de las del historial. */
  manualPrediction: boolean
  theme: Theme
  language: Lang
  /** Hash PBKDF2 del PIN; null = sin PIN. */
  pinHash: string | null
  /** Intentos fallidos seguidos y momento (ms) hasta el que el PIN está bloqueado. */
  pinFailures: number
  pinLockedUntil: number
  /** Llave de acceso de este dispositivo para desbloquear con Face ID o huella. */
  biometric: { credentialId: string } | null
  reminders: ReminderSettings
  /** Datos opcionales que se muestran en el registro diario. */
  tracking: TrackingSettings
  /** Modo de la app: ciclo menstrual, embarazo o perimenopausia. */
  mode: AppMode
  /** Envase de la píldora (si se registra en "Qué registras"). */
  pill: { pack: PillPack; start: ISODate | null }
  /** Embarazo: primer día de la última regla (base de las semanas y la fecha de parto). */
  pregnancyStart: ISODate | null
  /**
   * Credenciales de este dispositivo en el servidor de notificaciones (Upstash).
   * Se generan al activar el primer recordatorio; nunca se exportan.
   */
  pushDevice: PushDevice | null
  /** Último contenido sincronizado con el servidor y cuándo. */
  pushSync: { payload: string; at: number } | null
  /** Último error al sincronizar los recordatorios (null = todo bien). */
  pushError: string | null
  /** Día de la última copia de seguridad exportada. */
  lastBackup: ISODate | null
  /** Día en que se pospuso el aviso de copia de seguridad del inicio. */
  backupSnoozedOn: ISODate | null
  /** Inicios de ciclos largos que la usuaria confirmó como reales (no fue un periodo olvidado). */
  confirmedLongCycles: ISODate[]
  /** "¿Ha terminado tu periodo?" pospuesto: periodo al que se refiere y día hasta el que no se pregunta. */
  periodEndSnooze: { start: ISODate; until: ISODate } | null
  /** Qué tiene la nube de la cuenta (ver account/syncCore.ts). Nunca se exporta. */
  sync: SyncState | null
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
  /** Tomar la temperatura basal cada mañana. */
  temperatureEnabled: boolean
  temperatureTime: string
  /** Pesarse: todos los días (null) o un día de la semana (0 = domingo … 6 = sábado). */
  weightEnabled: boolean
  weightTime: string
  weightDay: number | null
  /** Vitaminas o una medicación diaria, con el nombre que se quiera. */
  medicationEnabled: boolean
  medicationName: string
  medicationTime: string
  /** Revisión médica (DIU, implante, citología…): una semana antes y el mismo día. */
  checkupEnabled: boolean
  checkupDate: ISODate | null
  checkupYearly: boolean
  /** Recordatorios libres (p. ej. una pastilla los días 15 a 26 del ciclo). */
  custom: CustomReminder[]
}

export interface CustomReminder {
  id: string
  name: string
  /** 'HH:MM' */
  time: string
  /** Solo esos días del ciclo (1 = primer día del periodo); null = todos los días. */
  cycleDays: { from: number; to: number } | null
}

export interface TrackingSettings {
  temperature: boolean
  mucus: boolean
  sex: boolean
  weight: boolean
  pill: boolean
}

export const DEFAULT_TRACKING: TrackingSettings = {
  temperature: false,
  mucus: false,
  sex: false,
  weight: false,
  pill: false,
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
  temperatureEnabled: false,
  temperatureTime: '07:00',
  weightEnabled: false,
  weightTime: '08:00',
  weightDay: 1,
  medicationEnabled: false,
  medicationName: '',
  medicationTime: '09:00',
  checkupEnabled: false,
  checkupDate: null,
  checkupYearly: true,
  custom: [],
}

export const DEFAULT_SETTINGS: Settings = {
  onboardingDone: false,
  cycleLength: null,
  periodLength: null,
  manualPrediction: false,
  theme: 'system',
  language: 'es',
  pinHash: null,
  pinFailures: 0,
  pinLockedUntil: 0,
  biometric: null,
  reminders: DEFAULT_REMINDERS,
  tracking: DEFAULT_TRACKING,
  mode: 'cycle',
  pill: { pack: 21, start: null },
  pregnancyStart: null,
  pushDevice: null,
  pushSync: null,
  pushError: null,
  lastBackup: null,
  backupSnoozedOn: null,
  confirmedLongCycles: [],
  periodEndSnooze: null,
  sync: null,
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
    pill: { ...DEFAULT_SETTINGS.pill, ...stored.pill },
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
  /** Modo elegido (por defecto, ciclo). En embarazo, el último periodo es el inicio. */
  mode?: AppMode
}

/** Guarda lo indicado en el onboarding y lo marca como completado. */
export async function completeOnboarding(
  r: OnboardingResult,
  database: AppDB = db,
  today: ISODate = todayISO(),
): Promise<void> {
  await database.transaction('rw', database.periods, database.settings, async () => {
    if (r.lastPeriodStart) {
      const exists = await database.periods.where('startDate').equals(r.lastPeriodStart).count()
      if (!exists) {
        // Si ya han pasado los días que suele durar, se da por terminado; si no, sigue
        // en curso y se cierra con "Ha terminado mi periodo".
        const end = addDays(r.lastPeriodStart, (r.periodLength ?? DEFAULT_PERIOD_LENGTH) - 1)
        await database.periods.add({ startDate: r.lastPeriodStart, endDate: end < today ? end : null })
      }
    }
    const mode = r.mode ?? 'cycle'
    await setSettings(
      {
        cycleLength: r.cycleLength,
        periodLength: r.periodLength,
        mode,
        ...(mode === 'pregnancy' ? { pregnancyStart: r.lastPeriodStart } : {}),
        onboardingDone: true,
      },
      database,
    )
  })
}
