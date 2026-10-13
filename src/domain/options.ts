import type { Flow } from '../db/db'

export const FLOW_OPTIONS: { value: Flow; label: string; drops: number }[] = [
  { value: 'spotting', label: 'Manchado', drops: 0 },
  { value: 'light', label: 'Ligero', drops: 1 },
  { value: 'medium', label: 'Medio', drops: 2 },
  { value: 'heavy', label: 'Abundante', drops: 3 },
]

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
