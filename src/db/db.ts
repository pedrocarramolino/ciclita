import Dexie, { type DexieOptions, type EntityTable } from 'dexie'
import type { ISODate } from '../domain/dates'
import type { WrappedPin } from '../security/biometric'

/** Un periodo menstrual. Es la fuente de verdad de los inicios de ciclo. */
export interface Period {
  id?: number
  startDate: ISODate
  /** null mientras el periodo sigue en curso. */
  endDate: ISODate | null
}

export type Flow = 'spotting' | 'light' | 'medium' | 'heavy'
export type Mucus = 'dry' | 'sticky' | 'creamy' | 'watery' | 'eggwhite'
export type Sex = 'protected' | 'unprotected'

/** Registro diario. Todos los campos son opcionales. */
export interface DayLog {
  date: ISODate
  flow?: Flow
  symptoms?: string[]
  /** Estados de ánimo del día (se pueden marcar varios). */
  moods?: string[]
  /** Versiones anteriores: un solo estado de ánimo. Se lee con dayMoods() y al guardar pasa a `moods`. */
  mood?: string
  /** Nivel de dolor 0–10. */
  pain?: number
  medication?: string
  notes?: string
  /** Temperatura basal en °C (opcional, ver Ajustes → Qué registras). */
  temperature?: number
  mucus?: Mucus
  sex?: Sex
  /** Peso en kg. */
  weight?: number
  /** Píldora anticonceptiva marcada como tomada. */
  pillTaken?: boolean
  updatedAt: number
}

export interface Symptom {
  id?: number
  name: string
  builtin: boolean
}

export interface SettingRow {
  key: string
  value: unknown
}

/**
 * Bóveda cifrada (ver vault.ts). Con el cifrado activado, es lo único que queda en
 * disco: todos los datos van dentro de `data`, cifrados con AES-GCM.
 */
export interface VaultRow {
  key: 'vault'
  version: 1
  salt: Uint8Array<ArrayBuffer>
  iterations: number
  iv: Uint8Array<ArrayBuffer>
  data: ArrayBuffer
  /** Intentos fallidos y bloqueo temporal (antes de desbloquear no hay otro sitio donde guardarlos). */
  failures: number
  lockedUntil: number
  /** Tema elegido, en claro, para que la pantalla de desbloqueo use los colores correctos. */
  theme?: string
  /** Desbloqueo con Face ID o huella: el PIN cifrado con el secreto de la llave de acceso. */
  bio?: WrappedPin
}

/** Nombre de la base de datos IndexedDB. */
export const DB_NAME = 'ciclita'
/** Nombre anterior (versiones previas al cambio de nombre); se migra en migrate.ts. */
export const LEGACY_DB_NAME = 'registro-mensual'

export class AppDB extends Dexie {
  periods!: EntityTable<Period, 'id'>
  days!: EntityTable<DayLog, 'date'>
  symptoms!: EntityTable<Symptom, 'id'>
  settings!: EntityTable<SettingRow, 'key'>
  vault!: EntityTable<VaultRow, 'key'>

  constructor(name = DB_NAME, options?: DexieOptions) {
    super(name, options)
    this.version(1).stores({
      periods: '++id, startDate',
      days: 'date',
      symptoms: '++id, &name',
      settings: 'key',
    })
    this.version(2).stores({ vault: 'key' })
    this.on('populate', (tx) => {
      tx.table('symptoms').bulkAdd(BUILTIN_SYMPTOMS.map((name) => ({ name, builtin: true })))
    })
  }
}

export const BUILTIN_SYMPTOMS = [
  'Dolor abdominal',
  'Dolor de cabeza',
  'Hinchazón',
  'Sensibilidad en el pecho',
  'Acné',
  'Cansancio',
  'Náuseas',
  'Antojos',
  'Dolor lumbar',
  'Insomnio',
]

/** Base de datos en disco (IndexedDB real del navegador). */
export const diskDb = new AppDB()

/**
 * Base de datos que usa la app. Normalmente es la de disco; con el cifrado activado,
 * tras desbloquear es una copia en memoria (vault.ts) y en disco solo queda la bóveda.
 */
export let db: AppDB = diskDb

export function setActiveDb(d: AppDB) {
  db = d
}
