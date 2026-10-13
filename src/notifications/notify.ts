/**
 * Notificaciones locales. No hay servidor ni push: los avisos se generan en el
 * propio dispositivo cuando la app (o su service worker) está activa.
 */
import { db } from '../db/db'
import { getSettings, setSettings } from '../db/settings'
import { today } from '../domain/dates'
import { predict } from '../domain/prediction'
import { dueReminders, type DueReminder } from '../domain/reminders'
import { t } from '../i18n/es'

export const notificationsSupported = () => typeof Notification !== 'undefined'

export function permission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.requestPermission()
}

export function reminderText(r: DueReminder, discreet: boolean): { title: string; body: string } {
  const n = t.notifications
  if (discreet) return { title: n.discreetTitle, body: n.discreet[r.kind] }
  const body = r.kind === 'period' ? n.period(r.daysUntil ?? 0) : n[r.kind]
  return { title: n.titles[r.kind], body }
}

/** Muestra una notificación. En Android solo funciona a través del service worker. */
export async function showNotification(title: string, body: string, tag: string): Promise<void> {
  const options: NotificationOptions = { body, tag, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png' }
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
  if (reg) await reg.showNotification(title, options)
  else new Notification(title, options)
}

/**
 * Comprueba qué recordatorios tocan ahora, los muestra y lo apunta para no repetirlos.
 * Devuelve los recordatorios mostrados.
 */
export async function runReminders(now = new Date()): Promise<DueReminder[]> {
  if (permission() !== 'granted') return []
  const settings = await getSettings()
  const r = settings.reminders
  if (!r.periodEnabled && !r.dailyEnabled && !r.pillEnabled) return []

  const [periods, todayLog] = await Promise.all([db.periods.toArray(), db.days.get(today())])
  const prediction = predict({
    periods,
    today: today(),
    userCycleLength: settings.cycleLength,
    userPeriodLength: settings.periodLength,
  })
  const due = dueReminders({ settings: r, log: settings.reminderLog, prediction, now, todayLogged: !!todayLog })
  if (!due.length) return []

  const log = { ...settings.reminderLog }
  for (const d of due) {
    const { title, body } = reminderText(d, r.discreet)
    await showNotification(title, body, `ciclo-${d.kind}`)
    log[d.kind] = d.logValue
  }
  await setSettings({ reminderLog: log })
  return due
}
