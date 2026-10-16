/**
 * Recomendaciones del embarazo: una por semana (de la 4 a la 40) y una por mes. Los
 * textos están en t.modes.pregnancy.weekTips / monthTips; aquí, solo qué toca.
 * Son consejos generales (calendario de controles habitual en España): la app recuerda
 * siempre seguir las indicaciones de la matrona o el médico.
 */
export const FIRST_TIP_WEEK = 4
export const LAST_TIP_WEEK = 40

/** Semana cuyo consejo se muestra (semanas cumplidas, entre la 4 y la 40). */
export const tipWeek = (weeks: number) => Math.min(LAST_TIP_WEEK, Math.max(FIRST_TIP_WEEK, weeks))

/** Última semana de cada mes de embarazo (1.º: hasta la 4; 9.º: de la 36 en adelante). */
const MONTH_ENDS = [4, 8, 13, 17, 22, 27, 31, 35]

/** Mes de embarazo (1–9) para las semanas cumplidas. */
export function pregnancyMonth(weeks: number): number {
  const i = MONTH_ENDS.findIndex((end) => weeks <= end)
  return i === -1 ? 9 : i + 1
}
