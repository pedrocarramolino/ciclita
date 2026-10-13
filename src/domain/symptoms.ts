/**
 * Catálogo de síntomas por categorías. Vive en el código (no en la base de datos), así
 * que las ampliaciones llegan también a quien ya usaba la app o tiene los datos
 * cifrados. Los síntomas personalizados sí se guardan en la base de datos.
 */
import type { DayLog } from '../db/db'

export interface SymptomCategory {
  id: string
  label: string
  symptoms: string[]
}

export const SYMPTOM_CATALOG: SymptomCategory[] = [
  {
    id: 'pain',
    label: 'Dolor',
    symptoms: ['Dolor abdominal', 'Calambres', 'Dolor de cabeza', 'Migraña', 'Dolor lumbar', 'Dolor articular', 'Sensibilidad en el pecho'],
  },
  {
    id: 'digestion',
    label: 'Digestión',
    symptoms: ['Hinchazón', 'Náuseas', 'Diarrea', 'Estreñimiento', 'Gases'],
  },
  {
    id: 'skin',
    label: 'Piel y pelo',
    symptoms: ['Acné', 'Piel grasa', 'Piel seca', 'Caída del pelo'],
  },
  {
    id: 'energy',
    label: 'Energía y sueño',
    symptoms: ['Cansancio', 'Insomnio', 'Somnolencia', 'Dificultad para concentrarse'],
  },
  {
    id: 'appetite',
    label: 'Apetito',
    symptoms: ['Antojos', 'Más apetito', 'Menos apetito'],
  },
  {
    id: 'other',
    label: 'Otros',
    symptoms: ['Sofocos', 'Sudores nocturnos', 'Mareos', 'Retención de líquidos', 'Flujo vaginal inusual', 'Sequedad vaginal'],
  },
]

export const CATALOG_SYMPTOMS: string[] = SYMPTOM_CATALOG.flatMap((c) => c.symptoms)

/** Los que se muestran como "más usados" mientras aún no hay historial. */
export const DEFAULT_FREQUENT = [
  'Dolor abdominal',
  'Dolor de cabeza',
  'Hinchazón',
  'Sensibilidad en el pecho',
  'Acné',
  'Cansancio',
  'Náuseas',
  'Antojos',
]

/** Habituales en la perimenopausia. */
export const PERIMENOPAUSE_FREQUENT = [
  'Sofocos',
  'Sudores nocturnos',
  'Insomnio',
  'Cansancio',
  'Dolor articular',
  'Sequedad vaginal',
  'Dificultad para concentrarse',
  'Dolor de cabeza',
]

/** Busca un síntoma del catálogo sin distinguir mayúsculas ni tildes. */
export function findCatalogSymptom(name: string): string | undefined {
  const key = normalize(name)
  return CATALOG_SYMPTOMS.find((s) => normalize(s) === key)
}

export const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // Quita las marcas diacríticas (tildes) que deja normalize('NFD').
    .replace(/\p{Diacritic}/gu, '')

/**
 * Síntomas más registrados (máx. `limit`), completados con los habituales si hay pocos
 * datos. Incluye los personalizados que se usen.
 */
export function frequentSymptoms(days: DayLog[], limit = 8, defaults: string[] = DEFAULT_FREQUENT): string[] {
  const counts = new Map<string, number>()
  for (const d of days) for (const s of d.symptoms ?? []) counts.set(s, (counts.get(s) ?? 0) + 1)
  const used = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).map(([s]) => s)
  const out = used.slice(0, limit)
  for (const s of defaults) {
    if (out.length >= limit) break
    if (!out.includes(s)) out.push(s)
  }
  return out
}
