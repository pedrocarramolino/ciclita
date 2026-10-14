/**
 * Desbloqueo con Face ID, Touch ID o huella (WebAuthn, sin servidor).
 *
 * Se crea una llave de acceso (passkey) de este dispositivo para el dominio de la app.
 * Al desbloquear se le pide al sistema que la use con verificación de la persona
 * (biometría); si lo consigue, la app se abre. La comprobación es local, como la del
 * PIN sin cifrado: protege frente a miradas, no frente a quien manipule el navegador.
 *
 * Con el cifrado activado hace falta además un secreto: la extensión PRF de WebAuthn
 * (iOS 18+, Android y navegadores recientes) devuelve 32 bytes que solo esa llave puede
 * generar. Con ellos se cifra el PIN; al desbloquear con la cara o la huella se descifra
 * el PIN y con él la bóveda. Si el dispositivo no tiene PRF, en ese modo no se ofrece.
 */
import { decryptJSON, encryptJSON, randomBytes, WrongKeyError, type Sealed } from './crypto'

/** PIN cifrado con el secreto PRF de la llave, guardado en claro junto a la bóveda. */
export interface WrappedPin {
  credentialId: string
  /** Entrada de la PRF (aleatoria, distinta por activación). */
  prfSalt: Uint8Array<ArrayBuffer>
  iv: Uint8Array<ArrayBuffer>
  data: ArrayBuffer
}

const PIN_AAD = new TextEncoder().encode('ciclita-bio-pin-v1')
const RP_NAME = 'Ciclita'

export const toB64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : new Uint8Array(b))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

export const fromB64url = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

/** ¿Hay Face ID, Touch ID, huella o Windows Hello en este dispositivo? */
export async function biometricAvailable(): Promise<boolean> {
  try {
    return (
      typeof window !== 'undefined' &&
      !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    )
  } catch {
    return false
  }
}

/** El usuario canceló o el sistema no dejó usar la llave (no es un error de la app). */
export const isCancel = (e: unknown) => e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError')

/** El bit UV (user verified) de authenticatorData: la persona se identificó, no solo tocó. */
const userVerified = (authData: ArrayBuffer) => (new Uint8Array(authData)[32] & 0x04) !== 0

/**
 * Crea la llave de acceso. Devuelve su id y, si el dispositivo tiene PRF y lo
 * calcula ya al crearla, el secreto para `prfSalt`.
 */
export async function registerBiometric(
  label: string,
  prfSalt?: Uint8Array<ArrayBuffer>,
): Promise<{ credentialId: string; prfEnabled: boolean; prf: ArrayBuffer | null }> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME },
      user: { id: randomBytes(16), name: label, displayName: label },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      extensions: prfSalt ? { prf: { eval: { first: prfSalt } } } : undefined,
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new DOMException('Sin credencial', 'NotAllowedError')
  const prf = cred.getClientExtensionResults().prf
  return {
    credentialId: toB64url(cred.rawId),
    prfEnabled: !!prf?.enabled || !!prf?.results?.first,
    prf: (prf?.results?.first as ArrayBuffer | undefined) ?? null,
  }
}

/**
 * Pide la cara o la huella con la llave `credentialId`. Devuelve si se verificó a la
 * persona y, si se pasó `prfSalt` y el dispositivo lo admite, el secreto PRF.
 */
export async function authenticateBiometric(
  credentialId: string,
  prfSalt?: Uint8Array<ArrayBuffer>,
): Promise<{ verified: boolean; prf: ArrayBuffer | null }> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: fromB64url(credentialId) }],
      userVerification: 'required',
      timeout: 60_000,
      extensions: prfSalt ? { prf: { eval: { first: prfSalt } } } : undefined,
    },
  })) as PublicKeyCredential | null
  if (!cred) return { verified: false, prf: null }
  const response = cred.response as AuthenticatorAssertionResponse
  return {
    verified: toB64url(cred.rawId) === credentialId && userVerified(response.authenticatorData),
    prf: (cred.getClientExtensionResults().prf?.results?.first as ArrayBuffer | undefined) ?? null,
  }
}

/** Clave AES a partir del secreto PRF (HKDF-SHA256). */
async function prfKey(prf: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', prf, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: PIN_AAD },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function wrapPin(
  pin: string,
  prf: ArrayBuffer,
  credentialId: string,
  prfSalt: Uint8Array<ArrayBuffer>,
): Promise<WrappedPin> {
  const sealed = await encryptJSON(await prfKey(prf), pin, PIN_AAD)
  return { credentialId, prfSalt, iv: sealed.iv, data: sealed.data }
}

/** Devuelve el PIN, o null si el secreto no corresponde. */
export async function unwrapPin(w: Pick<WrappedPin, 'iv' | 'data'>, prf: ArrayBuffer): Promise<string | null> {
  try {
    return await decryptJSON<string>(await prfKey(prf), { iv: w.iv, data: w.data } satisfies Sealed, PIN_AAD)
  } catch (e) {
    if (e instanceof WrongKeyError) return null
    throw e
  }
}

/**
 * Al desactivarlo, se pide al sistema (si sabe hacerlo) que olvide la llave para que
 * no quede en Contraseñas. Si no, la usuaria puede borrarla a mano.
 */
export function forgetCredential(credentialId: string): void {
  const signal = (
    window.PublicKeyCredential as unknown as {
      signalUnknownCredential?: (o: { rpId: string; credentialId: string }) => Promise<void>
    }
  )?.signalUnknownCredential
  if (signal) void signal.call(window.PublicKeyCredential, { rpId: location.hostname, credentialId }).catch(() => {})
}

/** Obtiene el secreto PRF de una llave recién creada (crearla no siempre lo devuelve). */
export async function prfAfterRegister(
  reg: { credentialId: string; prf: ArrayBuffer | null },
  prfSalt: Uint8Array<ArrayBuffer>,
): Promise<ArrayBuffer | null> {
  if (reg.prf) return reg.prf
  const r = await authenticateBiometric(reg.credentialId, prfSalt)
  return r.verified ? r.prf : null
}
