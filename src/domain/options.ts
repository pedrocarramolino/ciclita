import type { Flow, Mucus, Sex } from '../db/db'
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

/** Rangos válidos para los datos numéricos. */
export const TEMPERATURE_RANGE = { min: 34, max: 42 }
export const WEIGHT_RANGE = { min: 20, max: 400 }

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
