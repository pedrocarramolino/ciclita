import type { Flow, Mucus, Sex } from '../db/db'

export const FLOW_OPTIONS: { value: Flow; label: string; drops: number }[] = [
  { value: 'spotting', label: 'Manchado', drops: 0 },
  { value: 'light', label: 'Ligero', drops: 1 },
  { value: 'medium', label: 'Medio', drops: 2 },
  { value: 'heavy', label: 'Abundante', drops: 3 },
]

/** Moco cervical, de menos a más fértil. */
export const MUCUS_OPTIONS: { value: Mucus; label: string }[] = [
  { value: 'dry', label: 'Seco' },
  { value: 'sticky', label: 'Pegajoso' },
  { value: 'creamy', label: 'Cremoso' },
  { value: 'watery', label: 'Acuoso' },
  { value: 'eggwhite', label: 'Clara de huevo' },
]

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'protected', label: 'Con protección' },
  { value: 'unprotected', label: 'Sin protección' },
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

/** Estados de ánimo con nombres en sustantivo (lenguaje neutro). */
export const MOOD_OPTIONS: { value: string; emoji: string; label: string }[] = [
  { value: 'happy', emoji: '😄', label: 'Alegría' },
  { value: 'calm', emoji: '😌', label: 'Calma' },
  { value: 'neutral', emoji: '😐', label: 'Normal' },
  { value: 'sad', emoji: '😢', label: 'Tristeza' },
  { value: 'irritable', emoji: '😠', label: 'Irritabilidad' },
  { value: 'anxious', emoji: '😰', label: 'Ansiedad' },
  { value: 'tired', emoji: '🥱', label: 'Sin energía' },
]
