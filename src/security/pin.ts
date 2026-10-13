/**
 * PIN de 4 dígitos. Nunca se guarda en claro: se deriva un hash con PBKDF2-SHA256
 * y sal aleatoria (WebCrypto).
 *
 * Importante: el PIN evita miradas casuales, pero los datos de IndexedDB no van
 * cifrados; alguien con acceso técnico al dispositivo podría leerlos.
 */
const ITERATIONS = 210_000
const PREFIX = 'pbkdf2-sha256'

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin)

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export async function hashPin(pin: string, iterations = ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(pin, salt, iterations)
  return `${PREFIX}$${iterations}$${toB64(salt)}$${toB64(hash)}`
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [prefix, iter, salt, hash] = stored.split('$')
  if (prefix !== PREFIX || !iter || !salt || !hash) return false
  const expected = fromB64(hash)
  const actual = await derive(pin, fromB64(salt), Number(iter))
  // Comparación en tiempo constante.
  let diff = expected.length ^ actual.length
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ (actual[i] ?? 0)
  return diff === 0
}

/** Tras 5 intentos fallidos, espera creciente: 30 s, 60 s, 120 s… */
export const MAX_ATTEMPTS = 5
export function lockoutMs(failures: number): number {
  if (failures < MAX_ATTEMPTS) return 0
  return 30_000 * 2 ** Math.min(failures - MAX_ATTEMPTS, 5)
}
