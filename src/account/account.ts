/**
 * Cuentas: registro, inicio de sesión, recuperar contraseña, cerrar sesión y
 * eliminar la cuenta. Envuelve Firebase Auth para que el resto de la app (y las
 * pruebas) no dependan de él.
 */
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { getDoc, serverTimestamp, setDoc } from 'firebase/firestore/lite'
import type { ISODate } from '../domain/dates'
import { auth } from './firebase'
import { deleteCloudData, flushSync, userDoc } from './sync'

export interface AccountUser {
  uid: string
  email: string
  emailVerified: boolean
  displayName: string | null
}

export type AccountState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: AccountUser }

export interface Profile {
  firstName: string
  lastName: string
  birthDate: ISODate
  country: string
  marketing: boolean
}

export interface RegisterInput extends Profile {
  email: string
  password: string
}

/** Versión de la política de privacidad aceptada al registrarse. */
export const PRIVACY_VERSION = '2026-10-15'

/** Error con un código propio que la pantalla traduce. */
export class AccountError extends Error {
  code: AccountErrorCode
  constructor(code: AccountErrorCode) {
    super(code)
    this.code = code
  }
}

export type AccountErrorCode =
  | 'emailInUse'
  | 'invalidEmail'
  | 'weakPassword'
  | 'wrongCredentials'
  | 'tooManyRequests'
  | 'network'
  | 'unknown'

function toAccountError(e: unknown): AccountError {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, AccountErrorCode> = {
    'auth/email-already-in-use': 'emailInUse',
    'auth/invalid-email': 'invalidEmail',
    'auth/weak-password': 'weakPassword',
    'auth/password-does-not-meet-requirements': 'weakPassword',
    'auth/invalid-credential': 'wrongCredentials',
    'auth/invalid-login-credentials': 'wrongCredentials',
    'auth/wrong-password': 'wrongCredentials',
    'auth/user-not-found': 'wrongCredentials',
    'auth/too-many-requests': 'tooManyRequests',
    'auth/network-request-failed': 'network',
  }
  if (!map[code]) console.error('Error de cuenta', e)
  return new AccountError(map[code] ?? 'unknown')
}

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw e instanceof AccountError ? e : toAccountError(e)
  }
}

const toUser = (u: User): AccountUser => ({
  uid: u.uid,
  email: u.email ?? '',
  emailVerified: u.emailVerified,
  displayName: u.displayName,
})

const listeners = new Set<(s: AccountState) => void>()
const emit = () => {
  const u = auth().currentUser
  const s: AccountState = u ? { status: 'signedIn', user: toUser(u) } : { status: 'signedOut' }
  listeners.forEach((l) => l(s))
}

/** Avisa de cada cambio de sesión (y una vez al empezar). Devuelve cómo dejar de escuchar. */
export function watchAccount(cb: (s: AccountState) => void): () => void {
  listeners.add(cb)
  const off = onAuthStateChanged(auth(), (u) => cb(u ? { status: 'signedIn', user: toUser(u) } : { status: 'signedOut' }))
  return () => {
    listeners.delete(cb)
    off()
  }
}

export function register(input: RegisterInput): Promise<void> {
  return guard(async () => {
    const { user } = await createUserWithEmailAndPassword(auth(), input.email.trim(), input.password)
    await updateProfile(user, { displayName: `${input.firstName.trim()} ${input.lastName.trim()}` })
    await setDoc(userDoc(user.uid), {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      birthDate: input.birthDate,
      country: input.country,
      marketing: input.marketing,
      // Consentimientos (RGPD): cuándo y qué versión de la política.
      privacyAcceptedAt: serverTimestamp(),
      healthConsentAt: serverTimestamp(),
      privacyVersion: PRIVACY_VERSION,
      createdAt: serverTimestamp(),
    })
    // Si falla el correo no se deshace el registro: se puede reenviar desde Ajustes.
    await sendEmailVerification(user).catch((e) => console.error('No se pudo enviar el correo de confirmación', e))
    emit()
  })
}

export function login(email: string, password: string): Promise<void> {
  return guard(async () => {
    await signInWithEmailAndPassword(auth(), email.trim(), password)
  })
}

export function sendReset(email: string): Promise<void> {
  return guard(async () => {
    await sendPasswordResetEmail(auth(), email.trim()).catch((e: { code?: string }) => {
      // No se revela si el correo tiene cuenta.
      if (e?.code !== 'auth/user-not-found') throw e
    })
  })
}

export function resendVerification(): Promise<void> {
  return guard(async () => {
    const u = auth().currentUser
    if (u) await sendEmailVerification(u)
  })
}

/** Vuelve a leer la cuenta (p. ej. para saber si ya confirmó el correo). */
export function refreshUser(): Promise<void> {
  return guard(async () => {
    await auth().currentUser?.reload()
    emit()
  })
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(userDoc(uid))
  return snap.exists() ? (snap.data() as Profile) : null
}

/** Cuenta con sesión iniciada en este dispositivo (o null). */
export function currentUid(): string | null {
  return auth().currentUser?.uid ?? null
}

/** Cierra la sesión sin subir nada (cuando no se puede, p. ej. con el PIN olvidado). */
export function signOutHere(): Promise<void> {
  return guard(() => signOut(auth()))
}

/** Cierra la sesión tras subir los últimos cambios. */
export function logout(): Promise<void> {
  return guard(async () => {
    await flushSync()
    await signOut(auth())
  })
}

/** Elimina la cuenta y todos sus datos de la nube. Pide la contraseña otra vez. */
export function deleteAccount(password: string): Promise<void> {
  return guard(async () => {
    const u = auth().currentUser
    if (!u?.email) return
    await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password))
    await flushSync()
    await deleteCloudData(u.uid)
    await deleteUser(u)
  })
}
