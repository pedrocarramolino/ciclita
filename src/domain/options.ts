import type { Flow, Mucus, Sex, TestResult } from '../db/db'
import { t } from '../i18n'

const o = t.options

export const FLOW_OPTIONS: { value: Flow; label: string; drops: number }[] = [
  { value: 'spotting', label: o.flow.spotting, drops: 0 },
  { value: 'light', label: o.flow.light, drops: 1 },
  { value: 'medium', label: o.flow.medium, drops: 2 },
  { value: 'heavy', label: o.flow.heavy, drops: 3 },
]

/** Moco cervical, de menos a más fértil. */
export const MUCUS_OPTIONS: { value: Mucus; label: string }[] = [
  { value: 'dry', label: o.mucus.dry },
  { value: 'sticky', label: o.mucus.sticky },
  { value: 'creamy', label: o.mucus.creamy },
  { value: 'watery', label: o.mucus.watery },
  { value: 'eggwhite', label: o.mucus.eggwhite },
]

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'protected', label: o.sex.protected },
  { value: 'unprotected', label: o.sex.unprotected },
]

export const TEST_OPTIONS: { value: TestResult; label: string }[] = [
  { value: 'negative', label: o.test.negative },
  { value: 'positive', label: o.test.positive },
]

/** Rangos válidos para los datos numéricos. */
export const TEMPERATURE_RANGE = { min: 34, max: 42 }
export const WEIGHT_RANGE = { min: 20, max: 400 }
/** Tensión (mmHg) y pulso (lpm): márgenes amplios, solo para descartar errores de tecleo. */
export const SYSTOLIC_RANGE = { min: 60, max: 260 }
export const DIASTOLIC_RANGE = { min: 30, max: 160 }
export const PULSE_RANGE = { min: 30, max: 220 }

/** Número entero dentro del rango; null si no lo es. */
export function parseWhole(text: string, range: { min: number; max: number }): number | null {
  const v = text.trim()
  if (!/^\d{2,3}$/.test(v)) return null
  const n = Number(v)
  return n >= range.min && n <= range.max ? n : null
}

/**
 * Tensión escrita como "120/80" (también "120 80" o "120-80"). La alta tiene que ser
 * mayor que la baja; null si no es válida.
 */
export function parseBloodPressure(text: string): { systolic: number; diastolic: number } | null {
  const m = /^\s*(\d{2,3})\s*[/\-\s]\s*(\d{2,3})\s*$/.exec(text)
  if (!m) return null
  const systolic = parseWhole(m[1], SYSTOLIC_RANGE)
  const diastolic = parseWhole(m[2], DIASTOLIC_RANGE)
  return systolic !== null && diastolic !== null && systolic > diastolic ? { systolic, diastolic } : null
}

/** "120/80" (o '' si no hay tensión). */
export const formatBloodPressure = (d: { systolic?: number; diastolic?: number }) =>
  d.systolic !== undefined && d.diastolic !== undefined ? `${d.systolic}/${d.diastolic}` : ''

/** Convierte "36,55" o "36.55" en número; null si no es válido o está fuera del rango. */
export function parseDecimal(text: string, range: { min: number; max: number }): number | null {
  const n = Number(text.trim().replace(',', '.'))
  if (!text.trim() || !Number.isFinite(n) || n < range.min || n > range.max) return null
  return Math.round(n * 100) / 100
}

/**
 * Estados de ánimo con nombres en sustantivo (lenguaje neutro), de los más agradables
 * a los más difíciles. Los valores guardados no cambian nunca (solo se añaden).
 */
export const MOOD_OPTIONS: { value: keyof typeof o.mood; emoji: string; label: string }[] = (
  [
    ['happy', '😄'],
    ['loving', '🥰'],
    ['energetic', '🤩'],
    ['calm', '😌'],
    ['desire', '🔥'],
    ['neutral', '😐'],
    ['sensitive', '🥹'],
    ['moodSwings', '🎢'],
    ['sad', '😢'],
    ['lonely', '😔'],
    ['irritable', '😠'],
    ['stressed', '😫'],
    ['anxious', '😰'],
    ['overwhelmed', '🤯'],
    ['tired', '🥱'],
    ['unwell', '🤒'],
  ] as const
).map(([value, emoji]) => ({ value, emoji, label: o.mood[value] }))

/** Estados de ánimo de un día (también los guardados con la versión de uno solo). */
export const dayMoods = (d?: { moods?: string[]; mood?: string }): string[] =>
  d?.moods ?? (d?.mood ? [d.mood] : [])
