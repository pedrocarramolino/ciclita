/**
 * Posibilidad de embarazo de un día según el ciclo (estimación, no anticonceptivo):
 *  - alta: los 2 días antes de la ovulación estimada y ese mismo día (cuando más
 *    probable es la concepción);
 *  - media: el resto de la ventana fértil y los días que el margen añade a su alrededor;
 *  - baja: los demás días del ciclo.
 * Sin previsión (sin datos, con retraso o fuera de los ciclos previstos) no se estima.
 */
import { addDays, type ISODate } from './dates'
import type { Prediction } from './prediction'

export type PregnancyChance = 'low' | 'medium' | 'high'

/** Se muestra solo en modo ciclo y sin anticonceptivo hormonal registrado. */
export const showsPregnancyChance = (s: {
  mode: string
  tracking: { pill: boolean }
  reminders: { contraception: { method: string } }
}) => s.mode === 'cycle' && !s.tracking.pill && s.reminders.contraception.method === 'none'

/** Días antes de la ovulación que cuentan como posibilidad alta. */
const HIGH_DAYS_BEFORE = 2

export function pregnancyChance(date: ISODate, prediction: Prediction | null | undefined, today: ISODate): PregnancyChance | null {
  if (!prediction || date < today) return null
  const kind = prediction.status.kind
  if (kind !== 'upcoming' && kind !== 'period') return null
  const windows = prediction.fertileWindows
  const lastPeriod = prediction.nextPeriods.at(-1)
  // Más allá del último periodo previsto no hay ventana calculada.
  if (!windows.length || !lastPeriod || date >= lastPeriod.start) return null
  for (const w of windows) {
    if (date >= addDays(w.ovulation, -HIGH_DAYS_BEFORE) && date <= w.ovulation) return 'high'
    if (date >= w.possibleStart && date <= w.possibleEnd) return 'medium'
  }
  return 'low'
}
