/**
 * ¿Llegan los recordatorios a este dispositivo? Se usa en el inicio para avisar si
 * hay alguno activado pero no van a llegar (sin permiso, navegador sin notificaciones
 * o error al registrarlos en el servidor).
 */
import type { ReminderSettings } from '../db/settings'

/** Hay algún recordatorio activado (los ajustes son de la cuenta: valen en todos los dispositivos). */
export function anyReminderOn(r: ReminderSettings): boolean {
  return (
    r.periodEnabled ||
    r.dailyEnabled ||
    r.pillEnabled ||
    r.fertileEnabled ||
    r.breastExamEnabled ||
    r.temperatureEnabled ||
    r.weightEnabled ||
    r.medicationEnabled ||
    r.custom.length > 0 ||
    (r.checkupEnabled && !!r.checkupDate) ||
    (r.contraception.method !== 'none' && !!r.contraception.start)
  )
}

export type ReminderProblem =
  | { kind: 'denied' }
  | { kind: 'askPermission' }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string }

/** El problema que impide que lleguen los recordatorios a este dispositivo, o null si todo va bien. */
export function reminderProblem(
  reminders: ReminderSettings,
  permission: NotificationPermission | 'unsupported',
  pushError: string | null,
): ReminderProblem | null {
  if (!anyReminderOn(reminders)) return null
  if (permission === 'unsupported') return { kind: 'unsupported' }
  if (permission === 'denied') return { kind: 'denied' }
  if (permission === 'default') return { kind: 'askPermission' }
  if (pushError) return { kind: 'error', message: pushError }
  return null
}

/** Huella del problema: si se oculta un aviso, vuelve a salir si el problema cambia. */
export const problemKey = (p: ReminderProblem) => (p.kind === 'error' ? `error:${p.message}` : p.kind)
