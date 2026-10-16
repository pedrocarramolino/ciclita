import { requireAccount, UnauthenticatedError } from '../server/firebaseAuth.js'
import { clientIp, error, json, readJson } from '../server/http.js'
import { AuthError, QuotaError, register, unregister } from '../server/service.js'
import { upstash } from '../server/upstash.js'
import { validateCredentials, validateRegister, ValidationError } from '../server/validate.js'

async function handle(request: Request, action: (body: unknown) => Promise<void>) {
  let ctx
  try {
    ctx = upstash()
  } catch (e) {
    console.error(e)
    return error('Servidor de notificaciones sin configurar', 503)
  }
  const { success } = await ctx.ratelimit.limit(clientIp(request))
  if (!success) return error('Demasiadas peticiones', 429)

  try {
    await action(await readJson(request))
    return json({ ok: true })
  } catch (e) {
    if (e instanceof ValidationError || e instanceof SyntaxError) return error(e.message, 400)
    if (e instanceof UnauthenticatedError) return error(e.message, 401)
    if (e instanceof AuthError) return error(e.message, 403)
    if (e instanceof QuotaError) return error(e.message, 429)
    console.error(e)
    return error('Error interno', 500)
  }
}

/** Registra o actualiza el dispositivo y sus recordatorios. Exige una sesión de Ciclita. */
export function PUT(request: Request) {
  return handle(request, async (body) => {
    const input = validateRegister(body)
    const uid = await requireAccount(request)
    await register(upstash().deps, input, uid)
  })
}

/** Borra el dispositivo y todas sus programaciones. */
export function DELETE(request: Request) {
  return handle(request, (body) => {
    const { deviceId, secret } = validateCredentials(body)
    return unregister(upstash().deps, deviceId, secret)
  })
}
