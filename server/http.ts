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
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw new SyntaxError('Cuerpo demasiado grande')
  return JSON.parse(text)
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
