/// <reference lib="webworker" />
/**
 * Service worker: precarga de la app (modo offline, se completa en la fase 6) y
 * recepción de las notificaciones Web Push enviadas por el servidor (Upstash QStash).
 */
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('install', () => void self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
}

self.addEventListener('push', (event) => {
  let data: PushPayload = { title: 'Ciclo', body: 'Tienes un recordatorio.' }
  try {
    data = { ...data, ...(event.data?.json() as PushPayload) }
  } catch {
    // Push sin contenido o no JSON: se muestra el texto genérico.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: data.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data?.url as string) ?? '/', self.location.origin).href
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((w) => new URL(w.url).origin === self.location.origin)
      if (existing) {
        await existing.navigate(url).catch(() => {})
        return existing.focus()
      }
      return self.clients.openWindow(url)
    })(),
  )
})
