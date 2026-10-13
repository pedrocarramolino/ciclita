import { error, json } from '../server/http.js'

/** Clave pública VAPID que el navegador necesita para suscribirse a Web Push. */
export function GET() {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) return error('Servidor de notificaciones sin configurar', 503)
  return json({ key })
}
