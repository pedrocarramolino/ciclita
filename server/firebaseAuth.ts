/**
 * Comprobación de la sesión de Firebase en el servidor: la app envía el identificador
 * de sesión (ID token, un JWT firmado por Google) en la cabecera Authorization y aquí
 * se verifica la firma, el proyecto y la caducidad. Así solo una cuenta real de Ciclita
 * puede registrar avisos o subir citas al calendario.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? 'ciclita'
const GOOGLE_KEYS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

export class UnauthenticatedError extends Error {}

export type VerifyIdToken = (token: string) => Promise<string>

/** Verificador de ID tokens de un proyecto de Firebase; devuelve el uid de la cuenta. */
export function makeVerifier(keys: JWTVerifyGetKey, projectId = PROJECT_ID): VerifyIdToken {
  return async (token) => {
    try {
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ['RS256'],
        audience: projectId,
        issuer: `https://securetoken.google.com/${projectId}`,
      })
      if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new Error('sub')
      return payload.sub
    } catch {
      throw new UnauthenticatedError('Sesión no válida')
    }
  }
}

let defaultVerifier: VerifyIdToken | null = null
/** Con las claves públicas de Google (se descargan y se guardan en caché). */
export const verifyIdToken: VerifyIdToken = (token) =>
  (defaultVerifier ??= makeVerifier(createRemoteJWKSet(new URL(GOOGLE_KEYS))))(token)

/** El token de "Authorization: Bearer …", o null. */
export function bearerToken(request: Request): string | null {
  const m = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(request.headers.get('authorization') ?? '')
  return m ? m[1] : null
}

/** uid de la cuenta que hace la petición; lanza UnauthenticatedError si no hay sesión válida. */
export async function requireAccount(request: Request, verify: VerifyIdToken = verifyIdToken): Promise<string> {
  const token = bearerToken(request)
  if (!token) throw new UnauthenticatedError('Falta la sesión')
  return verify(token)
}
