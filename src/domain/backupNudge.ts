/**
 * Cuándo sugerir una copia de seguridad en el inicio. Los datos solo viven en el
 * dispositivo, así que conviene recordarlo, pero sin insistir.
 */
import { diffDays, type ISODate } from './dates'

/** Sin copia: se sugiere cuando ya hay datos de hace al menos este tiempo. */
export const FIRST_NUDGE_AFTER_DAYS = 30
/** Con copia: se sugiere otra cuando la última es más antigua que esto. */
export const BACKUP_MAX_AGE_DAYS = 60
/** Tras pulsar "Más tarde", no se vuelve a mostrar hasta pasado este tiempo. */
export const SNOOZE_DAYS = 30

export interface BackupNudgeInput {
  /** Fecha del dato más antiguo (periodo o registro); null si no hay datos. */
  oldestData: ISODate | null
  /** Fecha de la última copia exportada. */
  lastBackup: ISODate | null
  /** Fecha en que se pulsó "Más tarde" por última vez. */
  snoozedOn: ISODate | null
  today: ISODate
}

export type BackupNudge = { kind: 'never' } | { kind: 'old'; days: number } | null

export function backupNudge({ oldestData, lastBackup, snoozedOn, today }: BackupNudgeInput): BackupNudge {
  if (!oldestData) return null
  if (snoozedOn && diffDays(snoozedOn, today) < SNOOZE_DAYS) return null
  if (!lastBackup) return diffDays(oldestData, today) >= FIRST_NUDGE_AFTER_DAYS ? { kind: 'never' } : null
  const days = diffDays(lastBackup, today)
  return days > BACKUP_MAX_AGE_DAYS ? { kind: 'old', days } : null
}
