import { beforeEach, describe, expect, it, vi } from 'vitest'

// Redis en memoria y sin límite de peticiones.
const store = new Map<string, string>()
vi.mock('../server/upstash.js', () => ({
  upstash: () => ({
    redis: {
      set: async (k: string, v: string) => void store.set(k, v),
      get: async (k: string) => store.get(k) ?? null,
    },
    ratelimit: { limit: async () => ({ success: true }) },
  }),
}))

// Sesión: vale cualquier cabecera "Authorization" (la verificación real se prueba aparte).
vi.mock('../server/firebaseAuth.js', () => ({
  requireAccount: async (r: Request) => {
    if (!r.headers.get('authorization')) throw new Error('sin sesión')
    return 'uid-1'
  },
}))

const { GET, POST } = await import('./ics.js')

const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:Ecografía\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
const post = (body: unknown, auth = true) =>
  POST(
    new Request('https://ciclita.test/api/ics', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: auth ? { Authorization: 'Bearer token-de-prueba' } : {},
    }),
  )

beforeEach(() => store.clear())

describe('/api/ics (añadir una cita al Calendario del iPhone)', () => {
  it('guarda el archivo y lo devuelve como calendario con un enlace sin datos de la cita', async () => {
    const res = await post({ ics: ICS })
    const { url } = (await res.json()) as { url: string }
    expect(url).toMatch(/^\/api\/ics\?t=[0-9a-f-]{36}$/)
    expect(url).not.toContain('Ecograf')

    const file = await GET(new Request(`https://ciclita.test${url}`))
    expect(file.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8')
    expect(await file.text()).toBe(ICS)
  })

  it('sin sesión de Ciclita no se puede subir nada', async () => {
    expect((await post({ ics: ICS }, false)).status).toBe(401)
    expect(store.size).toBe(0)
  })

  it('rechaza lo que no es un archivo de calendario y los enlaces caducados o inventados', async () => {
    expect((await post({ ics: 'hola' })).status).toBe(400)
    expect((await post({ ics: ICS.replace('BEGIN:VEVENT', 'X') })).status).toBe(400)
    expect((await GET(new Request('https://ciclita.test/api/ics?t=../../etc'))).status).toBe(400)
    expect((await GET(new Request('https://ciclita.test/api/ics?t=0f8b7c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f'))).status).toBe(404)
  })
})
