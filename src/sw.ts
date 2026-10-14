/// <reference lib="webworker" />
/**
 * Service worker:
 *  - Modo offline: precarga toda la app (HTML, JS, CSS, fuentes e iconos) y sirve
 *    index.html para cualquier navegación, así la app abre sin conexión.
 *  - Notificaciones: muestra los Web Push enviados por el servidor (Upstash QStash).
 *  - Actualizaciones: la nueva versión espera hasta que la app pide activarla.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null } | string>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Navegaciones → index.html precargado (la app usa rutas con #, pero así cubrimos
// cualquier URL). Las llamadas a /api nunca se sirven desde la caché.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
  actions?: { action: string; title: string }[]
}

/** Botón "Ya la he tomado" del aviso de la píldora: abre la app y la marca (ver Home). */
/** Botones de las notificaciones y la dirección que abren (las acciones las hace Home). */
const ACTION_URLS: Record<string, string> = {
  'pill-taken': '/#/pill-taken',
  'period-started': '/#/period-started',
}

self.addEventListener('push', (event) => {
  let data: PushPayload = { title: 'Ciclita', body: 'Tienes un recordatorio.' }
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
      // Solo se aceptan acciones conocidas; iOS no muestra botones en avisos web.
      actions: (data.actions ?? []).filter((a) => a.action in ACTION_URLS).slice(0, 1),
    } as NotificationOptions),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Solo se abren páginas de la propia app, aunque el aviso dijera otra cosa.
  let url = new URL('/', self.location.origin).href
  const wanted = ACTION_URLS[event.action] ?? ((event.notification.data?.url as string) ?? '/')
  try {
    const target = new URL(wanted, self.location.origin)
    if (target.origin === self.location.origin) url = target.href
  } catch {
    // URL no válida: se abre el inicio.
  }
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
