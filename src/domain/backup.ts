/**
 * Copias de seguridad: exportar e importar en JSON (copia completa) y CSV
 * (un registro por día, legible en una hoja de cálculo).
 */
import type { DayLog, Flow, Mucus, Period, Sex } from '../db/db'
import { diffDays, type ISODate } from './dates'
import { FLOW_OPTIONS, MOOD_OPTIONS, MUCUS_OPTIONS, SEX_OPTIONS, TEMPERATURE_RANGE, WEIGHT_RANGE } from './options'

export const BACKUP_APP = 'ciclita'
/** Identificador de las copias hechas antes del cambio de nombre (se siguen aceptando). */
const LEGACY_BACKUP_APPS = ['registro-mensual']
export const BACKUP_VERSION = 1

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  periods: Period[]
  days: DayLog[]
  customSymptoms: string[]
  /** Ajustes sin el PIN (no se exporta por seguridad). */
  settings: Record<string, unknown>
}

export class BackupError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const FLOWS = new Set<Flow>(['spotting', 'light', 'medium', 'heavy'])
const MUCUS = new Set<Mucus>(MUCUS_OPTIONS.map((o) => o.value))
const SEXES = new Set<Sex>(SEX_OPTIONS.map((o) => o.value))
const inRange = (v: unknown, r: { min: number; max: number }) =>
  typeof v === 'number' && Number.isFinite(v) && v >= r.min && v <= r.max ? Math.round(v * 100) / 100 : undefined
const isDate = (v: unknown): v is ISODate => typeof v === 'string' && DATE_RE.test(v)
const optStr = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined

export function buildBackup(
  data: Omit<Backup, 'app' | 'version' | 'exportedAt'>,
  now = new Date(),
): Backup {
  const { pinHash: _omit, ...settings } = data.settings
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    periods: data.periods.map(({ startDate, endDate }) => ({ startDate, endDate })),
    days: data.days,
    customSymptoms: data.customSymptoms,
    settings,
  }
}

function sanitizeDay(raw: unknown): DayLog | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  if (!isDate(d.date)) return null
  const pain = typeof d.pain === 'number' && d.pain >= 0 && d.pain <= 10 ? Math.round(d.pain) : undefined
  const symptoms = Array.isArray(d.symptoms)
    ? d.symptoms.filter((s): s is string => typeof s === 'string' && !!s.trim()).map((s) => s.trim().slice(0, 40))
    : undefined
  return {
    date: d.date,
    flow: FLOWS.has(d.flow as Flow) ? (d.flow as Flow) : undefined,
    symptoms: symptoms?.length ? symptoms : undefined,
    mood: MOOD_OPTIONS.some((m) => m.value === d.mood) ? (d.mood as string) : undefined,
    pain,
    medication: optStr(d.medication, 200),
    notes: optStr(d.notes, 2000),
    temperature: inRange(d.temperature, TEMPERATURE_RANGE),
    mucus: MUCUS.has(d.mucus as Mucus) ? (d.mucus as Mucus) : undefined,
    sex: SEXES.has(d.sex as Sex) ? (d.sex as Sex) : undefined,
    weight: inRange(d.weight, WEIGHT_RANGE),
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : Date.now(),
  }
}

/** Valida y limpia una copia JSON. Lanza BackupError si no es una copia de esta app. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError('El archivo no es un JSON válido.')
  }
  const b = raw as Partial<Backup>
  const knownApp = b && (b.app === BACKUP_APP || LEGACY_BACKUP_APPS.includes(String(b.app)))
  if (!knownApp || typeof b.version !== 'number') {
    throw new BackupError('El archivo no parece una copia de seguridad de esta app.')
  }
  if (b.version > BACKUP_VERSION) {
    throw new BackupError('La copia es de una versión más nueva de la app.')
  }
  const periods = (Array.isArray(b.periods) ? b.periods : [])
    .filter((p) => p && isDate(p.startDate) && (p.endDate === null || isDate(p.endDate)))
    .filter((p) => p.endDate === null || p.endDate >= p.startDate)
    .map(({ startDate, endDate }) => ({ startDate, endDate }))
  const days = (Array.isArray(b.days) ? b.days : []).map(sanitizeDay).filter((d): d is DayLog => !!d)
  const customSymptoms = (Array.isArray(b.customSymptoms) ? b.customSymptoms : [])
    .filter((s): s is string => typeof s === 'string' && !!s.trim())
    .map((s) => s.trim().slice(0, 40))
  const { pinHash: _omit, ...settings } =
    b.settings && typeof b.settings === 'object' ? (b.settings as Record<string, unknown>) : {}
  return {
    app: BACKUP_APP,
    version: b.version,
    exportedAt: String(b.exportedAt ?? ''),
    periods,
    days,
    customSymptoms,
    settings,
  }
}

// ---------- CSV ----------

const SEP = ';' // Excel en español usa ';' como separador de columnas.
export const CSV_HEADER = [
  'fecha',
  'periodo',
  'flujo',
  'sintomas',
  'animo',
  'dolor',
  'medicacion',
  'notas',
  'temperatura',
  'moco',
  'relaciones',
  'peso',
]

const flowLabel = (f?: Flow) => FLOW_OPTIONS.find((o) => o.value === f)?.label ?? ''
const moodLabel = (m?: string) => MOOD_OPTIONS.find((o) => o.value === m)?.label ?? ''
const mucusLabel = (m?: Mucus) => MUCUS_OPTIONS.find((o) => o.value === m)?.label ?? ''
const sexLabel = (s?: Sex) => SEX_OPTIONS.find((o) => o.value === s)?.label ?? ''
// Decimales con coma, como espera Excel en español.
const decimal = (n?: number) => (n === undefined ? '' : String(n).replace('.', ','))
const parseNum = (s: string) => (s === '' ? undefined : Number(s.replace(',', '.')))
const norm = (s: string) => s.trim().toLowerCase()

/**
 * Celda CSV segura. Las que empiezan por = + - @ (o tabulador / retorno) se prefijan
 * con ' para que Excel no las ejecute como fórmulas (inyección CSV).
 */
function csvCell(raw: string): string {
  const v = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return /[";\n\r,]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** Una fila por cada día que está en un periodo o tiene registro, ordenadas por fecha. */
export function toCSV(periodDays: Set<ISODate>, days: DayLog[]): string {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const dates = [...new Set([...periodDays, ...byDate.keys()])].sort()
  const rows = dates.map((date) => {
    const d = byDate.get(date)
    return [
      date,
      periodDays.has(date) ? 'sí' : 'no',
      flowLabel(d?.flow),
      (d?.symptoms ?? []).join(', '),
      moodLabel(d?.mood),
      d?.pain === undefined ? '' : String(d.pain),
      d?.medication ?? '',
      d?.notes ?? '',
      decimal(d?.temperature),
      mucusLabel(d?.mucus),
      sexLabel(d?.sex),
      decimal(d?.weight),
    ]
      .map(csvCell)
      .join(SEP)
  })
  // BOM para que Excel detecte UTF-8 (tildes y eñes).
  return '﻿' + [CSV_HEADER.join(SEP), ...rows].join('\r\n') + '\r\n'
}

/** Parser CSV mínimo con soporte de comillas, saltos de línea entre comillas y ';' o ','. */
export function parseCSVRows(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const sep = firstLine.includes(';') ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

export interface CSVImport {
  periods: Period[]
  days: DayLog[]
  symptoms: string[]
}

/** Lee un CSV exportado por la app. Los días con periodo="sí" consecutivos forman periodos. */
export function parseCSV(text: string): CSVImport {
  const rows = parseCSVRows(text)
  const header = rows.shift()?.map(norm)
  if (!header || header[0] !== 'fecha' || !header.includes('periodo')) {
    throw new BackupError('El CSV no tiene el formato de esta app (falta la cabecera "fecha;periodo;…").')
  }
  const col = (name: string) => header.indexOf(name)
  // Quita el ' que añade la exportación delante de las celdas tipo fórmula.
  const unescapeFormula = (v: string) => (/^'[=+\-@\t\r]/.test(v) ? v.slice(1) : v)
  const get = (r: string[], name: string) =>
    col(name) >= 0 ? unescapeFormula((r[col(name)] ?? '').trim()) : ''

  const periodDates: ISODate[] = []
  const days: DayLog[] = []
  const symptoms = new Set<string>()

  for (const r of rows) {
    const date = get(r, 'fecha')
    if (!DATE_RE.test(date)) continue
    if (['sí', 'si', 'yes', '1', 'true'].includes(norm(get(r, 'periodo')))) periodDates.push(date)

    const sym = get(r, 'sintomas')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    sym.forEach((s) => symptoms.add(s))
    const painRaw = get(r, 'dolor')
    const day = sanitizeDay({
      date,
      flow: FLOW_OPTIONS.find((o) => norm(o.label) === norm(get(r, 'flujo')))?.value,
      symptoms: sym,
      mood: MOOD_OPTIONS.find((o) => norm(o.label) === norm(get(r, 'animo')))?.value,
      pain: painRaw === '' ? undefined : Number(painRaw),
      medication: get(r, 'medicacion'),
      notes: get(r, 'notas'),
      temperature: parseNum(get(r, 'temperatura')),
      mucus: MUCUS_OPTIONS.find((o) => norm(o.label) === norm(get(r, 'moco')))?.value,
      sex: SEX_OPTIONS.find((o) => norm(o.label) === norm(get(r, 'relaciones')))?.value,
      weight: parseNum(get(r, 'peso')),
    })
    const hasData =
      day &&
      (day.flow ||
        day.symptoms ||
        day.mood ||
        day.pain !== undefined ||
        day.medication ||
        day.notes ||
        day.temperature !== undefined ||
        day.mucus ||
        day.sex ||
        day.weight !== undefined)
    if (day && hasData) {
      days.push(day)
    }
  }

  const periods: Period[] = []
  for (const d of [...new Set(periodDates)].sort()) {
    const last = periods.at(-1)
    if (last && diffDays(last.endDate!, d) === 1) last.endDate = d
    else periods.push({ startDate: d, endDate: d })
  }
  return { periods, days, symptoms: [...symptoms] }
}
