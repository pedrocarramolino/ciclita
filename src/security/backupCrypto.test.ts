import { describe, expect, it } from 'vitest'
import {
  BadEncryptedBackupError,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
  WrongKeyError,
} from './backupCrypto'

// Pocas iteraciones para que las pruebas sean rápidas (el mínimo que acepta al importar).
const FAST = 100_000
const PLAIN = JSON.stringify({ app: 'ciclita', version: 1, notes: 'Datos privados con ñ y emojis 🌙' })

describe('copias cifradas', () => {
  it('cifra y descifra con la contraseña correcta', async () => {
    const file = await encryptBackup(PLAIN, 'contraseña larga', FAST)
    expect(isEncryptedBackup(file)).toBe(true)
    // Nada del contenido queda en claro.
    expect(file).not.toContain('privados')
    expect(await decryptBackup(file, 'contraseña larga')).toBe(PLAIN)
  })

  it('con otra contraseña falla con WrongKeyError', async () => {
    const file = await encryptBackup(PLAIN, 'contraseña larga', FAST)
    await expect(decryptBackup(file, 'otra contraseña')).rejects.toBeInstanceOf(WrongKeyError)
  })

  it('cada copia usa sal e IV distintos', async () => {
    const a = JSON.parse(await encryptBackup(PLAIN, 'contraseña larga', FAST))
    const b = JSON.parse(await encryptBackup(PLAIN, 'contraseña larga', FAST))
    expect(a.kdf.salt).not.toBe(b.kdf.salt)
    expect(a.iv).not.toBe(b.iv)
  })

  it('detecta archivos manipulados, dañados o con parámetros peligrosos', async () => {
    const file = JSON.parse(await encryptBackup(PLAIN, 'contraseña larga', FAST))
    const tampered = { ...file, data: file.data.slice(0, -4) + 'AAAA' }
    await expect(decryptBackup(JSON.stringify(tampered), 'contraseña larga')).rejects.toBeInstanceOf(WrongKeyError)
    const huge = { ...file, kdf: { ...file.kdf, iterations: 1e9 } }
    await expect(decryptBackup(JSON.stringify(huge), 'x')).rejects.toBeInstanceOf(BadEncryptedBackupError)
    await expect(decryptBackup('{"format":"ciclita-encrypted-backup"}', 'x')).rejects.toBeInstanceOf(BadEncryptedBackupError)
  })

  it('una copia normal no se toma por cifrada', () => {
    expect(isEncryptedBackup(PLAIN)).toBe(false)
    expect(isEncryptedBackup('no es json')).toBe(false)
  })
})
