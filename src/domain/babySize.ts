/**
 * Tamaño aproximado del bebé por semana de embarazo, con una comparación (fruta,
 * animal…) para hacerse una idea. Valores medios orientativos de las tablas de
 * crecimiento fetal habituales: hasta la semana 19, longitud de la cabeza a las nalgas;
 * desde la 20, de la cabeza a los pies (por eso la medida da un salto). Cada bebé crece
 * a su ritmo.
 *
 * Los nombres de cada comparación están en los textos (t.modes.pregnancy.sizes).
 */
export interface BabySize {
  /** Semana a la que corresponde (semanas cumplidas). */
  week: number
  emoji: string
  lengthCm: number
  /** Peso en gramos (las primeras semanas es demasiado pequeño para darlo). */
  weightG: number | null
}

export const FIRST_SIZE_WEEK = 4
export const LAST_SIZE_WEEK = 40

const SIZES: [number, string, number, number | null][] = [
  [4, '🌱', 0.1, null],
  [5, '🐜', 0.2, null],
  [6, '🫘', 0.6, null],
  [7, '🫐', 1.3, null],
  [8, '🐝', 1.6, 1],
  [9, '🍒', 2.3, 2],
  [10, '🫒', 3.1, 4],
  [11, '🍓', 4.1, 7],
  [12, '🍋', 5.4, 14],
  [13, '🐭', 7.4, 23],
  [14, '🍋', 8.7, 43],
  [15, '🍎', 10.1, 70],
  [16, '🥑', 11.6, 100],
  [17, '🐹', 13, 140],
  [18, '🫑', 14.2, 190],
  [19, '🥭', 15.3, 240],
  [20, '🍌', 25.6, 300],
  [21, '🥕', 26.7, 360],
  [22, '🌽', 27.8, 430],
  [23, '🍊', 28.9, 500],
  [24, '🐿️', 30, 600],
  [25, '🥦', 34.6, 660],
  [26, '🥬', 35.6, 760],
  [27, '🐇', 36.6, 875],
  [28, '🍆', 37.6, 1000],
  [29, '🎃', 38.6, 1150],
  [30, '🥥', 39.9, 1320],
  [31, '🍍', 41.1, 1500],
  [32, '🐱', 42.4, 1700],
  [33, '🍈', 43.7, 1920],
  [34, '🐶', 45, 2150],
  [35, '🍈', 46.2, 2380],
  [36, '🦆', 47.4, 2620],
  [37, '🍉', 48.6, 2860],
  [38, '🐈', 49.8, 3080],
  [39, '🍉', 50.7, 3290],
  [40, '🍉', 51.2, 3460],
]

const BY_WEEK = new Map(SIZES.map(([week, emoji, lengthCm, weightG]) => [week, { week, emoji, lengthCm, weightG }]))

/** Tamaño para las semanas cumplidas; null antes de la semana 4 (pasada la 40, el de la 40). */
export function babySize(weeks: number): BabySize | null {
  if (weeks < FIRST_SIZE_WEEK) return null
  return BY_WEEK.get(Math.min(weeks, LAST_SIZE_WEEK)) ?? null
}
