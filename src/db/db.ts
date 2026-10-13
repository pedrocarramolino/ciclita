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

export class AppDB extends Dexie {
  periods!: EntityTable<Period, 'id'>
  days!: EntityTable<DayLog, 'date'>
  symptoms!: EntityTable<Symptom, 'id'>
  settings!: EntityTable<SettingRow, 'key'>

  constructor(name = 'registro-mensual') {
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
