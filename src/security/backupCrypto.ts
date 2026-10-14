/**
 * Copias de seguridad cifradas con contraseña. El archivo sigue siendo JSON, pero
 * solo lleva los parámetros del cifrado y los datos cifrados:
 *
 *   { format, version, kdf: { name, hash, iterations, salt }, cipher, iv, data }
 *
 * Clave: PBKDF2-SHA256 (600.000 iteraciones, sal aleatoria) → AES-256-GCM, igual que
 * la bóveda del PIN, pero con otro contexto (AAD) y una contraseña más larga: el
 * archivo sale del dispositivo y un PIN de 4 dígitos se probaría entero en minutos.
 */
import { decryptJSON, deriveKey, encryptJSON, KDF_ITERATIONS, randomBytes, WrongKeyError } from './crypto'

export const ENCRYPTED_BACKUP_FORMAT = 'ciclita-encrypted-backup'
export const MIN_BACKUP_PASSWORD = 8
/** Límites de iteraciones aceptados al importar (evita archivos que bloqueen el móvil). */
const MIN_ITERATIONS = 100_000
const MAX_ITERATIONS = 5_000_000
const AAD = new TextEncoder().encode('ciclita-backup-v1')

interface EncryptedBackupFile {
  format: typeof ENCRYPTED_BACKUP_FORMAT
  version: 1
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: 'AES-256-GCM'
  iv: string
  data: string
}

/** El archivo no es una copia cifrada válida (dañado o de un formato desconocido). */
export class BadEncryptedBackupError extends Error {}
export { WrongKeyError }

const toB64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

/** Cifra el texto de una copia (JSON) con la contraseña. Devuelve el JSON del archivo. */
export async function encryptBackup(plainJson: string, password: string, iterations = KDF_ITERATIONS): Promise<string> {
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt, iterations)
  const { iv, data } = await encryptJSON(key, plainJson, AAD)
  const file: EncryptedBackupFile = {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toB64(salt) },
    cipher: 'AES-256-GCM',
    iv: toB64(iv),
    data: toB64(new Uint8Array(data)),
  }
  return JSON.stringify(file, null, 2)
}

/** El texto es una copia cifrada de Ciclita (sin comprobar aún la contraseña). */
export function isEncryptedBackup(text: string): boolean {
  try {
    return (JSON.parse(text) as { format?: unknown })?.format === ENCRYPTED_BACKUP_FORMAT
  } catch {
    return false
  }
}

/**
 * Descifra una copia cifrada y devuelve el JSON original. Lanza WrongKeyError si la
 * contraseña no es correcta y BadEncryptedBackupError si el archivo no es válido.
 */
export async function decryptBackup(text: string, password: string): Promise<string> {
  let f: EncryptedBackupFile
  let salt: Uint8Array<ArrayBuffer>
  let iv: Uint8Array<ArrayBuffer>
  let data: Uint8Array<ArrayBuffer>
  try {
    f = JSON.parse(text) as EncryptedBackupFile
    salt = fromB64(f.kdf.salt)
    iv = fromB64(f.iv)
    data = fromB64(f.data)
  } catch {
    throw new BadEncryptedBackupError('Copia cifrada no válida')
  }
  const it = f.kdf?.iterations
  if (
    f.format !== ENCRYPTED_BACKUP_FORMAT ||
    f.version !== 1 ||
    f.kdf.name !== 'PBKDF2' ||
    f.kdf.hash !== 'SHA-256' ||
    f.cipher !== 'AES-256-GCM' ||
    !Number.isInteger(it) ||
    it < MIN_ITERATIONS ||
    it > MAX_ITERATIONS ||
    salt.length !== 16 ||
    iv.length !== 12
  ) {
    throw new BadEncryptedBackupError('Copia cifrada no compatible')
  }
  const key = await deriveKey(password, salt, it)
  const plain = await decryptJSON<unknown>(key, { iv, data: data.buffer }, AAD)
  if (typeof plain !== 'string') throw new BadEncryptedBackupError('Contenido no válido')
  return plain
}
