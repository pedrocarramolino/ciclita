import { afterEach, describe, expect, it, vi } from 'vitest'
import { authenticateBiometric, fromB64url, registerBiometric, toB64url, unwrapPin, wrapPin } from './biometric'

const prf = () => crypto.getRandomValues(new Uint8Array(32)).buffer

/** authenticatorData mínima: 32 bytes del hash del dominio + flags. */
const authData = (flags: number) => {
  const a = new Uint8Array(37)
  a[32] = flags
  return a.buffer
}

const fakeCredential = (rawId: Uint8Array, flags: number, prfOut?: ArrayBuffer) => ({
  rawId: rawId.buffer,
  response: { authenticatorData: authData(flags) },
  getClientExtensionResults: () => (prfOut ? { prf: { enabled: true, results: { first: prfOut } } } : {}),
})

afterEach(() => vi.unstubAllGlobals())

describe('Face ID o huella', () => {
  it('base64url ida y vuelta', () => {
    const bytes = Uint8Array.from([0, 250, 255, 62, 63, 1])
    const s = toB64url(bytes)
    expect(s).not.toMatch(/[+/=]/)
    expect([...fromB64url(s)]).toEqual([...bytes])
  })

  it('el PIN cifrado solo se descifra con el mismo secreto de la llave', async () => {
    const secret = prf()
    const w = await wrapPin('2580', secret, 'id', new Uint8Array(32))
    expect(new TextDecoder('latin1').decode(w.data)).not.toContain('2580')
    expect(await unwrapPin(w, secret)).toBe('2580')
    expect(await unwrapPin(w, prf())).toBeNull()
  })

  it('solo da por buena la llave si el sistema verificó a la persona (bit UV)', async () => {
    const id = Uint8Array.from([1, 2, 3])
    const get = vi.fn()
    vi.stubGlobal('navigator', { credentials: { get } })

    get.mockResolvedValueOnce(fakeCredential(id, 0x05))
    expect((await authenticateBiometric(toB64url(id))).verified).toBe(true)

    get.mockResolvedValueOnce(fakeCredential(id, 0x01)) // solo presencia, sin verificación
    expect((await authenticateBiometric(toB64url(id))).verified).toBe(false)

    get.mockResolvedValueOnce(fakeCredential(Uint8Array.from([9]), 0x05)) // otra llave
    expect((await authenticateBiometric(toB64url(id))).verified).toBe(false)
  })

  it('pide el secreto PRF cuando se pasa la sal y lo devuelve', async () => {
    const id = Uint8Array.from([7])
    const secret = prf()
    const get = vi.fn().mockResolvedValue(fakeCredential(id, 0x05, secret))
    vi.stubGlobal('navigator', { credentials: { get } })
    const salt = new Uint8Array(32)

    const r = await authenticateBiometric(toB64url(id), salt)
    expect(r.prf).toBe(secret)
    expect(get.mock.calls[0][0].publicKey.extensions).toEqual({ prf: { eval: { first: salt } } })
    expect(get.mock.calls[0][0].publicKey.userVerification).toBe('required')
  })

  it('al crear la llave pide autenticador del dispositivo con verificación', async () => {
    const create = vi.fn().mockResolvedValue(fakeCredential(Uint8Array.from([4, 5]), 0x05))
    vi.stubGlobal('navigator', { credentials: { create } })
    const r = await registerBiometric('Ciclita')
    expect(r).toEqual({ credentialId: toB64url(Uint8Array.from([4, 5])), prfEnabled: false, prf: null })
    const opts = create.mock.calls[0][0].publicKey
    expect(opts.authenticatorSelection).toMatchObject({ authenticatorAttachment: 'platform', userVerification: 'required' })
    expect(opts.extensions).toBeUndefined()
  })
})
