/**
 * Búsqueda en los registros: notas, medicación y síntomas, sin distinguir mayúsculas
 * ni tildes. Función pura.
 */
import type { DayLog } from '../db/db'
import type { ISODate } from './dates'
import { normalize } from './symptoms'

export const MIN_QUERY_LENGTH = 2

export type SearchField = 'notes' | 'medication' | 'symptom'

export interface SearchMatch {
  field: SearchField
  /** Texto a mostrar (en las notas, un fragmento alrededor de la coincidencia). */
  text: string
  /** Posición y longitud de la coincidencia dentro de `text`. */
  start: number
  length: number
}

export interface SearchResult {
  date: ISODate
  matches: SearchMatch[]
}

export interface SymptomHistory {
  /** Nombre guardado del síntoma. */
  name: string
  days: number
  last: ISODate
}

export interface SearchOutput {
  results: SearchResult[]
  /** Síntomas cuyo nombre coincide, con cuántos días y el último. */
  symptoms: SymptomHistory[]
}

/** Contexto que se muestra a cada lado de una coincidencia en notas largas. */
const CONTEXT = 40

/**
 * Busca `query` en los días, del más reciente al más antiguo. `label` da el nombre a
 * mostrar de un síntoma (traducido); se busca tanto en él como en el guardado.
 */
export function searchDays(days: DayLog[], query: string, label: (name: string) => string = (s) => s): SearchOutput {
  const q = normalize(query)
  if (q.length < MIN_QUERY_LENGTH) return { results: [], symptoms: [] }

  const results: SearchResult[] = []
  const history = new Map<string, SymptomHistory>()

  for (const d of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
    const matches: SearchMatch[] = []
    for (const s of d.symptoms ?? []) {
      const shown = label(s)
      if (!normalize(shown).includes(q) && !normalize(s).includes(q)) continue
      matches.push({ field: 'symptom', ...highlight(shown, q) })
      const h = history.get(s)
      if (h) h.days++
      else history.set(s, { name: s, days: 1, last: d.date })
    }
    if (d.medication) {
      const m = find(d.medication, q)
      if (m) matches.push({ field: 'medication', ...m })
    }
    if (d.notes) {
      const m = find(d.notes, q)
      if (m) matches.push({ field: 'notes', ...m })
    }
    if (matches.length) results.push({ date: d.date, matches })
  }

  return { results, symptoms: [...history.values()].sort((a, b) => b.days - a.days || b.last.localeCompare(a.last)) }
}

/** Coincidencia en `text` (o null), recortada a un fragmento si el texto es largo. */
function find(text: string, q: string): Omit<SearchMatch, 'field'> | null {
  const idx = normalizedIndex(text, q)
  if (idx < 0) return null
  const from = Math.max(0, idx - CONTEXT)
  const to = Math.min(text.length, idx + q.length + CONTEXT)
  const prefix = from > 0 ? '…' : ''
  const suffix = to < text.length ? '…' : ''
  const snippet = prefix + text.slice(from, to).replace(/\s+/g, ' ') + suffix
  // Tras compactar los espacios la posición puede moverse: se vuelve a buscar.
  const start = normalizedIndex(snippet, q)
  return { text: snippet, start, length: q.length }
}

function highlight(text: string, q: string): Omit<SearchMatch, 'field'> {
  const start = normalizedIndex(text, q)
  return start < 0 ? { text, start: 0, length: 0 } : { text, start, length: q.length }
}

/**
 * Índice de `q` (ya normalizada) en `text` ignorando mayúsculas y tildes. Se normaliza
 * carácter a carácter para que la posición corresponda al texto original.
 */
function normalizedIndex(text: string, q: string): number {
  const chars = [...text].map((c) => normalize(c) || c.toLowerCase())
  const flat = chars.join('')
  const at = flat.indexOf(q)
  if (at < 0) return -1
  // Cada carácter normalizado ocupa 1 posición salvo raras excepciones: se mapea.
  let pos = 0
  let i = 0
  for (const c of chars) {
    if (pos >= at) break
    pos += c.length
    i++
  }
  return [...text].slice(0, i).join('').length
}
