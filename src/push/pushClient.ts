/**
 * Cliente de notificaciones push. Los recordatorios se programan en el servidor
 * (funciones de Vercel + Upstash QStash) y llegan por Web Push aunque la app esté cerrada.
 *
 * Qué se envía al servidor: la suscripción push del navegador, la zona horaria y,
 * por cada recordatorio activo, su hora y su texto (y las fechas del aviso de periodo).
 * Si no hay ningún recordatorio activo, no se envía nada y se borra lo que hubiera.
 */
import { getSettings, setSettings, type PushDevice, type Settings } from '../db/settings'
import type { Prediction } from '../domain/prediction'
import { t } from '../i18n/es'
import { buildReminders, hasReminders } from './reminderPayload'

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
}

export function permission(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported'
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!pushSupported()) return 'unsupported'
  return Notification.requestPermission()
}

/** Re-sincroniza aunque nada haya cambiado pasado este tiempo (renueva la caducidad en el servidor). */
const RESYNC_AFTER_MS = 24 * 3600_000

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function swRegistration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(t.settings.pushErrors.sw)), 10_000),
  )
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

/** Solo aceptamos respuestas JSON: en `npm run dev` sin `vercel dev`, /api devuelve el HTML de la app. */
const isJson = (res: Response) => res.headers.get('content-type')?.includes('application/json') ?? false

async function api(method: 'PUT' | 'DELETE', body: unknown) {
  let res: Response
  try {
    res = await fetch('/api/subscription', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error(t.settings.pushErrors.network)
  }
  if (!isJson(res)) throw new Error(t.settings.pushErrors.network)
  if (!res.ok) {
    const msg = await res
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => undefined)
    throw new Error(res.status === 503 ? t.settings.pushErrors.notConfigured : (msg ?? t.settings.pushErrors.server))
  }
}

async function getOrCreateSubscription(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  const res = await fetch('/api/vapid').catch(() => null)
  if (!res || !isJson(res)) throw new Error(t.settings.pushErrors.network)
  if (!res.ok) throw new Error(res.status === 503 ? t.settings.pushErrors.notConfigured : t.settings.pushErrors.server)
  const { key } = (await res.json()) as { key: string }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(key) })
}

/**
 * Cancela la suscripción push del navegador. Aunque no se pueda avisar al servidor
 * (p. ej. datos cifrados con un PIN olvidado), el siguiente envío fallará con 410 y el
 * servidor borrará el dispositivo, así que no llegarán más avisos.
 */
export async function unsubscribeBrowserPush(): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration()
  await (await reg?.pushManager.getSubscription())?.unsubscribe()
}

/** Borra este dispositivo del servidor y cancela la suscripción push. */
export async function unregisterPush(device: PushDevice | null): Promise<void> {
  if (!device) return
  await api('DELETE', { deviceId: device.id, secret: device.secret })
  await unsubscribeBrowserPush()
}

/**
 * Sincroniza los recordatorios con el servidor si han cambiado (o cada 24 h).
 * Guarda el error, si lo hay, en los ajustes para mostrarlo en pantalla.
 */
export async function syncPush(prediction: Prediction | null, opts: { force?: boolean } = {}): Promise<void> {
  const settings: Settings = await getSettings()
  const reminders = buildReminders(settings.reminders, prediction, undefined, settings.mode)

  try {
    if (!hasReminders(reminders)) {
      if (settings.pushDevice) await unregisterPush(settings.pushDevice)
      if (settings.pushDevice || settings.pushSync || settings.pushError) {
        await setSettings({ pushDevice: null, pushSync: null, pushError: null })
      }
      return
    }
    if (!pushSupported()) throw new Error(t.settings.remindersUnsupported)
    if (Notification.permission === 'denied') throw new Error(t.settings.remindersDenied)
    if (Notification.permission !== 'granted') throw new Error(t.settings.pushErrors.permission)

    const reg = await swRegistration()
    const subscription = (await getOrCreateSubscription(reg)).toJSON()
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const payload = JSON.stringify({ subscription, timezone, reminders })

    const last = settings.pushSync
    const fresh = last && last.payload === payload && Date.now() - last.at < RESYNC_AFTER_MS
    if (fresh && settings.pushDevice && !opts.force) return

    const device = settings.pushDevice ?? { id: crypto.randomUUID(), secret: randomSecret() }
    await api('PUT', { deviceId: device.id, secret: device.secret, subscription, timezone, reminders })
    await setSettings({ pushDevice: device, pushSync: { payload, at: Date.now() }, pushError: null })
  } catch (e) {
    await setSettings({ pushError: e instanceof Error ? e.message : t.settings.pushErrors.server })
  }
}

/** Notificación de prueba local, mostrada por el service worker. */
export async function showTestNotification(title: string, body: string) {
  const reg = await swRegistration()
  await reg.showNotification(title, { body, tag: 'ciclo-test', icon: '/icons/icon-192.png', badge: '/icons/badge-96.png' })
}
