import { describe, expect, it } from 'vitest'
import { ageOn, passwordStrength, validateRegister, type RegisterForm } from './validation'

const TODAY = '2026-10-15'
const ok: RegisterForm = {
  firstName: 'Ana',
  lastName: 'García López',
  email: 'ana@correo.com',
  password: 'ciclo2026',
  confirm: 'ciclo2026',
  birthDate: '1995-03-20',
  country: 'ES',
  acceptPrivacy: true,
  acceptHealth: true,
  marketing: false,
}

describe('validación del registro', () => {
  it('un formulario correcto no tiene errores', () => {
    expect(validateRegister(ok, TODAY)).toEqual({})
  })

  it('marca cada campo que falta o no vale', () => {
    expect(
      validateRegister(
        { ...ok, firstName: ' ', email: 'ana@', password: 'corta1', confirm: 'otra', birthDate: '', acceptHealth: false },
        TODAY,
      ),
    ).toEqual({
      firstName: 'firstName',
      email: 'email',
      password: 'passwordShort',
      confirm: 'confirm',
      birthDate: 'birthDate',
      acceptHealth: 'acceptHealth',
    })
  })

  it('la contraseña necesita letras y números', () => {
    expect(validateRegister({ ...ok, password: '12345678', confirm: '12345678' }, TODAY).password).toBe('passwordWeak')
    expect(validateRegister({ ...ok, password: 'abcdefgh', confirm: 'abcdefgh' }, TODAY).password).toBe('passwordWeak')
  })

  it('edad mínima de 14 años, contada al día', () => {
    expect(ageOn('2012-10-15', TODAY)).toBe(14)
    expect(ageOn('2012-10-16', TODAY)).toBe(13)
    expect(validateRegister({ ...ok, birthDate: '2012-10-16' }, TODAY).birthDate).toBe('tooYoung')
    expect(validateRegister({ ...ok, birthDate: '2012-10-15' }, TODAY).birthDate).toBeUndefined()
    expect(validateRegister({ ...ok, birthDate: '2030-01-01' }, TODAY).birthDate).toBe('birthDate')
  })

  it('fuerza de la contraseña', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc')).toBe(0)
    expect(passwordStrength('ciclo2026')).toBe(2)
    expect(passwordStrength('Ciclo-2026-segura')).toBe(4)
  })
})
