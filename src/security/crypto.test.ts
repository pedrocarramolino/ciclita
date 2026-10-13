import { describe, expect, it } from 'vitest'
import { decryptJSON, deriveKey, encryptJSON, randomBytes, WrongKeyError } from './crypto'

const ITER = 1000 // pocas iteraciones para que los tests sean rápidos

describe('cifrado con el PIN', () => {
  it('cifra y descifra con el PIN correcto', async () => {
    const salt = randomBytes(16)
    const key = await deriveKey('2580', salt, ITER)
    const value = { notes: 'Dolor fuerte', periods: [{ startDate: '2026-10-01' }] }
    const sealed = await encryptJSON(key, value)
    expect(await decryptJSON(await deriveKey('2580', salt, ITER), sealed)).toEqual(value)
  })

  it('el texto cifrado no contiene los datos en claro', async () => {
    const key = await deriveKey('2580', randomBytes(16), ITER)
    const sealed = await encryptJSON(key, { notes: 'Dolor fuerte', date: '2026-10-01' })
    const asText = new TextDecoder('latin1').decode(sealed.data)
    expect(asText).not.toContain('Dolor')
    expect(asText).not.toContain('2026-10-01')
  })

  it('con otro PIN falla', async () => {
    const salt = randomBytes(16)
    const sealed = await encryptJSON(await deriveKey('2580', salt, ITER), { a: 1 })
    await expect(decryptJSON(await deriveKey('2581', salt, ITER), sealed)).rejects.toThrow(WrongKeyError)
  })

  it('detecta datos manipulados', async () => {
    const key = await deriveKey('2580', randomBytes(16), ITER)
    const sealed = await encryptJSON(key, { a: 1 })
    const tampered = new Uint8Array(sealed.data.slice(0))
    tampered[0] ^= 1
    await expect(decryptJSON(key, { iv: sealed.iv, data: tampered.buffer })).rejects.toThrow(WrongKeyError)
  })

  it('usa un IV distinto en cada cifrado', async () => {
    const key = await deriveKey('2580', randomBytes(16), ITER)
    const a = await encryptJSON(key, { a: 1 })
    const b = await encryptJSON(key, { a: 1 })
    expect(a.iv).not.toEqual(b.iv)
  })
})
