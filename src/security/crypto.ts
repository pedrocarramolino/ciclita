/**
 * Cifrado de los datos con el PIN (WebCrypto, sin dependencias).
 *
 *  - Clave: PBKDF2-SHA256 con sal aleatoria de 16 bytes y 600.000 iteraciones
 *    (recomendación OWASP), que convierte el PIN en una clave AES de 256 bits.
 *    La clave no es extraíble: el navegador no deja leerla.
 *  - Cifrado: AES-256-GCM con un IV aleatorio nuevo en cada guardado. GCM además
 *    autentica: con un PIN incorrecto (o datos manipulados) el descifrado falla.
 */

export const KDF_ITERATIONS = 600_000
const AAD = new TextEncoder().encode('ciclita-vault-v1')

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

export async function deriveKey(
  pin: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations = KDF_ITERATIONS,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export interface Sealed {
  iv: Uint8Array<ArrayBuffer>
  data: ArrayBuffer
}

/** `aad` separa usos (bóveda, copias): un dato cifrado para uno no vale para otro. */
export async function encryptJSON(key: CryptoKey, value: unknown, aad = AAD): Promise<Sealed> {
  const iv = randomBytes(12)
  const plain = new TextEncoder().encode(JSON.stringify(value))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, key, plain)
  return { iv, data }
}

export class WrongKeyError extends Error {}

/** Descifra; lanza WrongKeyError si la clave (el PIN) no es la correcta. */
export async function decryptJSON<T>(key: CryptoKey, sealed: Sealed, aad = AAD): Promise<T> {
  let plain: ArrayBuffer
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: aad }, key, sealed.data)
  } catch {
    throw new WrongKeyError('PIN incorrecto o datos dañados')
  }
  return JSON.parse(new TextDecoder().decode(plain)) as T
}
