/**
 * Añadir una cita al Calendario del iPhone: iOS solo ofrece "Añadir al calendario" al
 * abrir un .ics desde una dirección web (no desde el menú Compartir). La app sube el
 * archivo (POST), recibe un enlace de un solo uso y el usuario lo abre (GET).
 *
 * El archivo se guarda en Redis 10 minutos como mucho, se borra en cuanto se descarga
 * (el enlace solo sirve una vez) y nunca viaja en la URL (solo un identificador
 * aleatorio), para que no quede en los registros de peticiones.
 */
import { randomUUID } from 'node:crypto'
import { requireAccount } from '../server/firebaseAuth.js'
import { clientIp, error, json, readJson } from '../server/http.js'
import { upstash } from '../server/upstash.js'

const TTL_SECONDS = 600
const MAX_ICS = 12_000
const TOKEN_RE = /^[0-9a-f-]{36}$/i
const key = (token: string) => `ciclo:ics:${token}`

function validIcs(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length <= MAX_ICS &&
    v.startsWith('BEGIN:VCALENDAR\r\n') &&
    v.endsWith('END:VCALENDAR\r\n') &&
    v.includes('BEGIN:VEVENT')
  )
}

export async function POST(request: Request) {
  let ctx
  try {
    ctx = upstash()
  } catch (e) {
    console.error(e)
    return error('Servidor sin configurar', 503)
  }
  const { success } = await ctx.ratelimit.limit(clientIp(request))
  if (!success) return error('Demasiadas peticiones', 429)
  try {
    await requireAccount(request)
  } catch {
    return error('Falta la sesión', 401)
  }
  let body: unknown
  try {
    body = await readJson(request)
  } catch {
    return error('Cuerpo no válido', 400)
  }
  const ics = (body as { ics?: unknown })?.ics
  if (!validIcs(ics)) return error('Archivo de calendario no válido', 400)
  const token = randomUUID()
  await ctx.redis.set(key(token), ics, { ex: TTL_SECONDS })
  return json({ url: `/api/ics?t=${token}` })
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t') ?? ''
  if (!TOKEN_RE.test(token)) return error('Enlace no válido', 400)
  let ics: string | null
  try {
    ics = await upstash().redis.getdel<string>(key(token))
  } catch (e) {
    console.error(e)
    return error('Servidor sin configurar', 503)
  }
  if (!ics) {
    return new Response('Este enlace ya se ha usado o ha caducado. Vuelve a pulsar «Añadir al calendario del móvil» en Ciclita.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="cita.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
