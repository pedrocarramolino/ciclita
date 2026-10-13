/** Utilidades HTTP comunes a las funciones de /api. */
export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

export const error = (message: string, status: number) => json({ error: message }, status)

/** Límite de tamaño del cuerpo para evitar abusos. */
export const MAX_BODY_BYTES = 16 * 1024

export async function readJson(request: Request): Promise<unknown> {
  // Se rechaza antes de leer el cuerpo si declara un tamaño excesivo.
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    throw new SyntaxError('Cuerpo demasiado grande')
  }
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw new SyntaxError('Cuerpo demasiado grande')
  return JSON.parse(text)
}

/** IP del cliente. En Vercel, x-real-ip la fija la plataforma (no la puede falsear el cliente). */
export function clientIp(request: Request): string {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
