/**
 * Comprobaciones del formulario de registro (funciones puras, sin Firebase).
 * Devuelven claves de error que la pantalla traduce.
 */
import type { ISODate } from '../domain/dates'

/** Edad mínima para dar el consentimiento por sí misma (España: 14 años, LOPDGDD art. 7). */
export const MIN_AGE = 14
export const MIN_PASSWORD = 8
export const MAX_NAME = 60

export interface RegisterForm {
  firstName: string
  lastName: string
  email: string
  password: string
  confirm: string
  birthDate: ISODate | ''
  country: string
  acceptPrivacy: boolean
  acceptHealth: boolean
  marketing: boolean
}

export type RegisterErrorKey =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'passwordShort'
  | 'passwordWeak'
  | 'confirm'
  | 'birthDate'
  | 'tooYoung'
  | 'acceptPrivacy'
  | 'acceptHealth'

export type RegisterErrors = Partial<Record<keyof RegisterForm, RegisterErrorKey>>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const isEmail = (s: string) => EMAIL_RE.test(s.trim())

/** Años cumplidos el día `today`. */
export function ageOn(birth: ISODate, today: ISODate): number {
  const [by, bm, bd] = birth.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

/** Fuerza de la contraseña de 0 (muy débil) a 4 (fuerte). */
export function passwordStrength(p: string): 0 | 1 | 2 | 3 | 4 {
  if (!p) return 0
  let score = 0
  if (p.length >= MIN_PASSWORD) score++
  if (p.length >= 12) score++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4
}

export function validateRegister(f: RegisterForm, today: ISODate): RegisterErrors {
  const e: RegisterErrors = {}
  if (!f.firstName.trim()) e.firstName = 'firstName'
  if (!f.lastName.trim()) e.lastName = 'lastName'
  if (!isEmail(f.email)) e.email = 'email'
  if (f.password.length < MIN_PASSWORD) e.password = 'passwordShort'
  // Al menos letras y números: "12345678" o "aaaaaaaa" no valen.
  else if (!/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) e.password = 'passwordWeak'
  if (f.confirm !== f.password) e.confirm = 'confirm'
  if (!f.birthDate || f.birthDate > today || f.birthDate < '1900-01-01') e.birthDate = 'birthDate'
  else if (ageOn(f.birthDate, today) < MIN_AGE) e.birthDate = 'tooYoung'
  if (!f.acceptPrivacy) e.acceptPrivacy = 'acceptPrivacy'
  if (!f.acceptHealth) e.acceptHealth = 'acceptHealth'
  return e
}
