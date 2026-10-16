/**
 * Catálogo de síntomas por categorías. Vive en el código (no en la base de datos), así
 * que las ampliaciones llegan también a quien ya usaba la app o tiene los datos
 * cifrados. Los síntomas personalizados sí se guardan en la base de datos.
 */
import type { DayLog } from '../db/db'
import { en, locale, t } from '../i18n'

export interface SymptomCategory {
  id: string
  label: string
  symptoms: string[]
}

export const SYMPTOM_CATALOG: SymptomCategory[] = [
  {
    id: 'pain',
    label: t.symptomCategories.pain,
    symptoms: [
      'Dolor abdominal',
      'Calambres',
      'Dolor de cabeza',
      'Migraña',
      'Dolor lumbar',
      'Dolor articular',
      'Sensibilidad en el pecho',
      'Dolor ovárico',
      'Dolor pélvico',
      'Dolor en las relaciones',
      'Dolor muscular',
      'Calambres en las piernas',
    ],
  },
  {
    id: 'digestion',
    label: t.symptomCategories.digestion,
    symptoms: [
      'Hinchazón',
      'Náuseas',
      'Vómitos',
      'Acidez',
      'Dolor de estómago',
      'Diarrea',
      'Estreñimiento',
      'Gases',
    ],
  },
  {
    id: 'intimate',
    label: t.symptomCategories.intimate,
    symptoms: [
      'Manchado entre reglas',
      'Coágulos',
      'Flujo vaginal inusual',
      'Flujo con mal olor',
      'Picor vaginal',
      'Sequedad vaginal',
      'Más deseo sexual',
      'Menos deseo sexual',
    ],
  },
  {
    id: 'urinary',
    label: t.symptomCategories.urinary,
    symptoms: [
      'Ganas de orinar a menudo',
      'Escozor al orinar',
      'Pérdidas de orina',
    ],
  },
  {
    id: 'skin',
    label: t.symptomCategories.skin,
    symptoms: [
      'Acné',
      'Piel grasa',
      'Piel seca',
      'Picor en la piel',
      'Caída del pelo',
      'Más vello',
      'Manchas en la piel',
    ],
  },
  {
    id: 'energy',
    label: t.symptomCategories.energy,
    symptoms: [
      'Cansancio',
      'Debilidad',
      'Insomnio',
      'Sueño agitado',
      'Somnolencia',
      'Dificultad para concentrarse',
    ],
  },
  {
    id: 'appetite',
    label: t.symptomCategories.appetite,
    symptoms: [
      'Antojos',
      'Antojo de dulce',
      'Antojo de salado',
      'Más apetito',
      'Menos apetito',
      'Más sed',
    ],
  },
  {
    id: 'other',
    label: t.symptomCategories.other,
    symptoms: [
      'Sofocos',
      'Sudores nocturnos',
      'Escalofríos',
      'Fiebre',
      'Mareos',
      'Palpitaciones',
      'Retención de líquidos',
      'Pies hinchados',
      'Congestión nasal',
      'Sangrado de encías',
    ],
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

/** Habituales en el embarazo. */
export const PREGNANCY_FREQUENT = [
  'Náuseas',
  'Vómitos',
  'Acidez',
  'Cansancio',
  'Ganas de orinar a menudo',
  'Calambres en las piernas',
  'Pies hinchados',
  'Estreñimiento',
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

/**
 * Busca un síntoma del catálogo sin distinguir mayúsculas ni tildes, también por su
 * nombre en inglés. Devuelve el nombre guardado (en español).
 */
export function findCatalogSymptom(name: string): string | undefined {
  const key = normalize(name)
  return CATALOG_SYMPTOMS.find((s) => normalize(s) === key || normalize(en.symptomNames[s] ?? '') === key)
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
  const used = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], locale)).map(([s]) => s)
  const out = used.slice(0, limit)
  for (const s of defaults) {
    if (out.length >= limit) break
    if (!out.includes(s)) out.push(s)
  }
  return out
}
