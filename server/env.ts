/** Variables de entorno del servidor. Ver README → "Desplegar en Vercel con Upstash". */
const REQUIRED = [
  'QSTASH_TOKEN',
  'QSTASH_CURRENT_SIGNING_KEY',
  'QSTASH_NEXT_SIGNING_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
] as const

export type Env = Record<(typeof REQUIRED)[number], string> & {
  UPSTASH_REDIS_REST_URL: string
  UPSTASH_REDIS_REST_TOKEN: string
  APP_URL: string
}

export function getEnv(): Env {
  // Redis: nombres de la consola de Upstash o los que crea la integración de Vercel (KV_*).
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

  const missing: string[] = REQUIRED.filter((k) => !process.env[k])
  if (!redisUrl) missing.push('UPSTASH_REDIS_REST_URL (o KV_REST_API_URL)')
  if (!redisToken) missing.push('UPSTASH_REDIS_REST_TOKEN (o KV_REST_API_TOKEN)')
  if (missing.length) throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`)

  // URL pública a la que QStash entrega los mensajes.
  const appUrl =
    process.env.APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
  if (!appUrl) throw new Error('Falta APP_URL (URL pública de la app)')

  return {
    ...(Object.fromEntries(REQUIRED.map((k) => [k, process.env[k]!])) as Record<(typeof REQUIRED)[number], string>),
    UPSTASH_REDIS_REST_URL: redisUrl!,
    UPSTASH_REDIS_REST_TOKEN: redisToken!,
    APP_URL: appUrl.replace(/\/$/, ''),
  }
}
