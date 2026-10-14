/**
 * Píldora anticonceptiva: qué días toca tomarla según el tipo de envase y cuántas se
 * han marcado como tomadas. Funciones puras.
 */
import type { DayLog } from '../db/db'
import { addDays, diffDays, type ISODate } from './dates'

/** Píldoras activas por envase de 28 días: 21 + 7 de descanso, 24 + 4, o 28 seguidas. */
export type PillPack = 21 | 24 | 28
export const PILL_PACKS: PillPack[] = [21, 24, 28]
const CYCLE = 28

export interface PillConfig {
  pack: PillPack
  /** Primer día del envase actual (o de cualquier envase anterior). */
  start: ISODate
}

/**
 * Envase que se envía con el recordatorio de la píldora para que no suene en los días
 * de descanso. Solo si se registra la píldora con su envase y este tiene descanso.
 */
export function reminderPillPack(
  tracking: boolean,
  pill: { pack: PillPack; start: ISODate | null },
): { active: number; start: ISODate } | undefined {
  return tracking && pill.start && pill.pack < CYCLE ? { active: pill.pack, start: pill.start } : undefined
}

export interface PillDay {
  /** Día del envase, 1–28. */
  day: number
  /** Toca tomar píldora activa (fuera de los días de descanso). */
  active: boolean
}

/** Día del envase para una fecha; null si es anterior al inicio. */
export function pillDay(date: ISODate, cfg: PillConfig): PillDay | null {
  const diff = diffDays(cfg.start, date)
  if (diff < 0) return null
  const day = (diff % CYCLE) + 1
  return { day, active: day <= cfg.pack }
}

export interface PillAdherence {
  /** Días en que tocaba tomarla (hoy solo cuenta si ya está marcada). */
  expected: number
  taken: number
  /** Días pasados en que tocaba y no se marcó, del más reciente al más antiguo. */
  missed: ISODate[]
}

/** Tomas entre `from` y `today` (incluidos). */
export function pillAdherence(days: DayLog[], cfg: PillConfig, from: ISODate, today: ISODate): PillAdherence {
  const taken = new Set(days.filter((d) => d.pillTaken).map((d) => d.date))
  const out: PillAdherence = { expected: 0, taken: 0, missed: [] }
  const first = from > cfg.start ? from : cfg.start
  for (let d = first; d <= today; d = addDays(d, 1)) {
    if (!pillDay(d, cfg)?.active) continue
    if (taken.has(d)) {
      out.expected++
      out.taken++
    } else if (d < today) {
      out.expected++
      out.missed.unshift(d)
    }
  }
  return out
}

/** Días pasados sin marcar como tomada entre `from` y `to` (para el calendario). */
export function missedPillDates(days: DayLog[], cfg: PillConfig, from: ISODate, to: ISODate, today: ISODate): Set<ISODate> {
  const taken = new Set(days.filter((d) => d.pillTaken).map((d) => d.date))
  const out = new Set<ISODate>()
  for (let d = from > cfg.start ? from : cfg.start; d <= to && d < today; d = addDays(d, 1)) {
    if (pillDay(d, cfg)?.active && !taken.has(d)) out.add(d)
  }
  return out
}
