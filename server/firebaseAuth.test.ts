import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { bearerToken, makeVerifier, requireAccount, UnauthenticatedError } from './firebaseAuth.js'

const { publicKey, privateKey } = await generateKeyPair('RS256')
const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }
const verify = makeVerifier(createLocalJWKSet({ keys: [jwk] }), 'ciclita')

const token = (claims: { aud?: string; iss?: string; sub?: string; exp?: string } = {}) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setAudience(claims.aud ?? 'ciclita')
    .setIssuer(claims.iss ?? 'https://securetoken.google.com/ciclita')
    .setSubject(claims.sub ?? 'uid-123')
    .setIssuedAt()
    .setExpirationTime(claims.exp ?? '1h')
    .sign(privateKey)

const req = (auth?: string) => new Request('https://ciclita.test/api', { headers: auth ? { Authorization: auth } : {} })

describe('sesión de Firebase en el servidor', () => {
  it('acepta un token válido del proyecto y devuelve la cuenta', async () => {
    expect(await verify(await token())).toBe('uid-123')
    expect(await requireAccount(req(`Bearer ${await token()}`), verify)).toBe('uid-123')
  })

  it('rechaza tokens de otro proyecto, de otro emisor, caducados o falsificados', async () => {
    await expect(verify(await token({ aud: 'otro' }))).rejects.toBeInstanceOf(UnauthenticatedError)
    await expect(verify(await token({ iss: 'https://evil.test' }))).rejects.toBeInstanceOf(UnauthenticatedError)
    await expect(verify(await token({ exp: '-1m' }))).rejects.toBeInstanceOf(UnauthenticatedError)
    const other = await generateKeyPair('RS256')
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setAudience('ciclita')
      .setIssuer('https://securetoken.google.com/ciclita')
      .setSubject('uid-123')
      .setExpirationTime('1h')
      .sign(other.privateKey)
    await expect(verify(forged)).rejects.toBeInstanceOf(UnauthenticatedError)
  })

  it('sin cabecera o mal formada, no hay sesión', async () => {
    expect(bearerToken(req())).toBeNull()
    expect(bearerToken(req('Basic abc'))).toBeNull()
    await expect(requireAccount(req(), verify)).rejects.toBeInstanceOf(UnauthenticatedError)
  })
})
