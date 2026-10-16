/**
 * Reglas de la sincronización con la nube (funciones puras, sin Firebase).
 *
 * En la nube, por cuenta:
 *  - un documento por día con registro (`days/{fecha}`), con `updatedAt` (hora del
 *    dispositivo que lo cambió). Los días borrados se guardan como `deleted: true`
 *    para que los demás dispositivos también los borren.
 *  - tres documentos de estado: periodos, ajustes y síntomas personalizados.
 *
 * En el dispositivo se recuerda qué versión tiene la nube de cada cosa (`SyncState`):
 * así solo se sube lo que ha cambiado y no se pierde nada al llegar cambios de otro.
 */
import type { DayLog, Period } from '../db/db'
import type { Settings } from '../db/settings'
import type { ISODate } from '../domain/dates'
import { periodDateSet, setPeriodDays } from '../domain/periods'

export interface SyncState {
  /** Cuenta a la que corresponde (al cambiar de cuenta se empieza de cero). */
  uid: string
  /** Hora (del servidor, ms) del último cambio de días ya descargado. */
  lastPull: number
  /** `updatedAt` de cada día tal como está en la nube. */
  days: Record<ISODate, number>
  /** Huella de periodos, ajustes y síntomas tal como están en la nube, y su `updatedAt`. */
  periods: string | null
  periodsAt: number
  settings: string | null
  settingsAt: number
  symptoms: string | null
  symptomsAt: number
  /** Citas: `updatedAt` de cada una en la nube y último cambio descargado (estados antiguos no lo tienen). */
  appointments?: Record<string, number>
  lastPullAppointments?: number
}

export const emptySyncState = (uid: string): SyncState => ({
  uid,
  lastPull: 0,
  days: {},
  periods: null,
  periodsAt: 0,
  settings: null,
  settingsAt: 0,
  symptoms: null,
  symptomsAt: 0,
  appointments: {},
  lastPullAppointments: 0,
})

/**
 * Ajustes que viajan con la cuenta. No: PIN, Face ID, idioma y tema (son del
 * dispositivo), credenciales de avisos ni estados internos.
 */
export const SYNCED_SETTINGS = [
  'onboardingDone',
  'cycleLength',
  'periodLength',
  'manualPrediction',
  'ignoreCyclesOver',
  'reminders',
  'tracking',
  'mode',
  'pill',
  'pregnancyStart',
  'confirmedLongCycles',
] as const satisfies readonly (keyof Settings)[]

export type SyncedSettings = Pick<Settings, (typeof SYNCED_SETTINGS)[number]>

export function pickSyncedSettings(s: Settings): SyncedSettings {
  return Object.fromEntries(SYNCED_SETTINGS.map((k) => [k, s[k]])) as SyncedSettings
}

/** JSON con las claves ordenadas: el mismo contenido da siempre la misma huella. */
export function stableHash(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : val,
  )
}

/** Periodos sin ids y ordenados (lo que se guarda en la nube). */
export const normalizePeriods = (ps: Period[]) =>
  ps.map(({ startDate, endDate }) => ({ startDate, endDate })).sort((a, b) => a.startDate.localeCompare(b.startDate))

/** Qué días hay que subir (nuevos o cambiados) y cuáles marcar como borrados. */
export function planDayPush(local: DayLog[], cloud: Record<ISODate, number>): { upserts: DayLog[]; deletes: ISODate[] } {
  const here = new Set(local.map((d) => d.date))
  return {
    upserts: local.filter((d) => cloud[d.date] !== d.updatedAt),
    deletes: Object.keys(cloud).filter((date) => !here.has(date)),
  }
}

export interface RemoteDay extends Partial<DayLog> {
  date: ISODate
  updatedAt: number
  deleted?: boolean
}

/** Qué citas subir (nuevas o cambiadas) y cuáles marcar como borradas. */
export function planPush<T extends { updatedAt: number }>(
  local: T[],
  keyOf: (item: T) => string,
  cloud: Record<string, number>,
): { upserts: T[]; deletes: string[] } {
  const here = new Set(local.map(keyOf))
  return {
    upserts: local.filter((x) => cloud[keyOf(x)] !== x.updatedAt),
    deletes: Object.keys(cloud).filter((k) => !here.has(k)),
  }
}

/** Qué hacer en el dispositivo con un día que llega de la nube: gana el cambio más reciente. */
export function resolveRemoteDay(local: DayLog | undefined, remote: RemoteDay): 'put' | 'delete' | 'keep' {
  if (remote.deleted) return local && local.updatedAt <= remote.updatedAt ? 'delete' : 'keep'
  return !local || local.updatedAt < remote.updatedAt ? 'put' : 'keep'
}

/** El día tal como se guarda en el dispositivo (sin los campos propios de la nube). */
export function toLocalDay(remote: RemoteDay): DayLog {
  const { deleted: _d, syncedAt: _s, ...day } = remote as RemoteDay & { syncedAt?: unknown }
  return day as DayLog
}

/**
 * Primera vez que se une un dispositivo con datos a una cuenta que ya tiene periodos:
 * se juntan los días de periodo de los dos (no se pierde ninguno).
 */
export function mergePeriods(local: Period[], remote: Period[], today: ISODate): Period[] {
  return normalizePeriods(setPeriodDays(normalizePeriods(local), [...periodDateSet(remote, today)], true, today))
}

export const mergeSymptoms = (a: string[], b: string[]) => {
  const seen = new Map<string, string>()
  for (const s of [...a, ...b]) if (!seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s)
  return [...seen.values()].sort((x, y) => x.localeCompare(y))
}
