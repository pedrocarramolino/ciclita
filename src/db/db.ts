import Dexie, { type EntityTable } from 'dexie'
import type { ISODate } from '../domain/dates'

/** Un periodo menstrual. Es la fuente de verdad de los inicios de ciclo. */
export interface Period {
  id?: number
  startDate: ISODate
  /** null mientras el periodo sigue en curso. */
  endDate: ISODate | null
}

export type Flow = 'spotting' | 'light' | 'medium' | 'heavy'

/** Registro diario. Todos los campos son opcionales. */
export interface DayLog {
  date: ISODate
  flow?: Flow
  symptoms?: string[]
  mood?: string
  /** Nivel de dolor 0–10. */
  pain?: number
  medication?: string
  notes?: string
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

/** Nombre de la base de datos IndexedDB. */
export const DB_NAME = 'ciclita'
/** Nombre anterior (versiones previas al cambio de nombre); se migra en migrate.ts. */
export const LEGACY_DB_NAME = 'registro-mensual'

export class AppDB extends Dexie {
  periods!: EntityTable<Period, 'id'>
  days!: EntityTable<DayLog, 'date'>
  symptoms!: EntityTable<Symptom, 'id'>
  settings!: EntityTable<SettingRow, 'key'>

  constructor(name = DB_NAME) {
    super(name)
    this.version(1).stores({
      periods: '++id, startDate',
      days: 'date',
      symptoms: '++id, &name',
      settings: 'key',
    })
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

export const db = new AppDB()
