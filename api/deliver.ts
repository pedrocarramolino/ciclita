import { error, json } from '../server/http.js'
import { deliver } from '../server/service.js'
import { REMINDER_KINDS, type DeliverMessage } from '../server/types.js'
import { upstash } from '../server/upstash.js'

/**
 * Destino de los mensajes diferidos de QStash. Solo acepta peticiones firmadas por
 * QStash; cualquier otra recibe 401.
 */
export async function POST(request: Request) {
  const { receiver, deps, env } = upstash()
  const body = await request.text()
  const signature = request.headers.get('upstash-signature') ?? ''

  const valid = await receiver
    .verify({ signature, body, url: `${env.APP_URL}/api/deliver` })
    .catch(() => false)
  if (!valid) return error('Firma no válida', 401)

  let msg: DeliverMessage
  try {
    msg = JSON.parse(body)
    if (typeof msg.deviceId !== 'string' || typeof msg.version !== 'string' || !REMINDER_KINDS.includes(msg.kind)) {
      throw new Error()
    }
  } catch {
    // 200 para que QStash no reintente un mensaje que nunca será válido.
    return json({ result: 'invalid' })
  }

  // Un error aquí devuelve 500 y QStash reintenta.
  const result = await deliver(deps, msg)
  return json({ result })
}
