/** Variables de entorno del servidor. Ver README → "Notificaciones con Upstash". */
const REQUIRED = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
] as const

export type Env = Record<(typeof REQUIRED)[number], string> & { APP_URL: string }

export function getEnv(): Env {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length) throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`)

  // URL pública a la que QStash entrega los mensajes.
  const appUrl =
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  if (!appUrl) throw new Error('Falta APP_URL (URL pública de la app)')

  return {
    ...(Object.fromEntries(REQUIRED.map((k) => [k, process.env[k]!])) as Record<(typeof REQUIRED)[number], string>),
    APP_URL: appUrl.replace(/\/$/, ''),
  }
}
