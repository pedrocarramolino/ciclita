// @vitest-environment jsdom
import '../../test/ui'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountError, login, register, sendReset } from '../../account/account'
import { AuthScreen } from './AuthScreen'

beforeEach(() => {
  vi.mocked(register).mockReset().mockResolvedValue()
  vi.mocked(login).mockReset().mockResolvedValue()
  vi.mocked(sendReset).mockReset().mockResolvedValue()
})

async function fillRegister(user: UserEvent) {
  await user.type(screen.getByLabelText('Nombre'), 'Ana')
  await user.type(screen.getByLabelText('Apellidos'), 'García López')
  await user.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com')
  await user.type(screen.getByLabelText('Contraseña'), 'ciclo2026')
  await user.type(screen.getByLabelText('Repite la contraseña'), 'ciclo2026')
  fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '1995-03-20' } })
  await user.click(screen.getByRole('checkbox', { name: /acepto la/ }))
  await user.click(screen.getByRole('checkbox', { name: /datos de salud/ }))
}

describe('Registro', () => {
  it('crea la cuenta con todos los datos', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)
    expect(screen.getByRole('heading', { name: 'Crea tu cuenta' })).toBeInTheDocument()
    await fillRegister(user)
    await user.selectOptions(screen.getByLabelText('País (opcional)'), 'ES')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(register).toHaveBeenCalledWith({
      firstName: 'Ana',
      lastName: 'García López',
      email: 'ana@correo.com',
      password: 'ciclo2026',
      birthDate: '1995-03-20',
      country: 'ES',
      marketing: false,
    })
  })

  it('sin rellenar, marca los campos, avisa y no envía nada', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los 7 campos marcados.')
    expect(screen.getByLabelText('Nombre')).toHaveAccessibleDescription('Escribe tu nombre.')
    expect(screen.getByLabelText('Nombre')).toHaveFocus()
    expect(screen.getByRole('checkbox', { name: /datos de salud/ })).toBeInvalid()
    expect(register).not.toHaveBeenCalled()
  })

  it('menores de 14 años no pueden registrarse', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)
    await fillRegister(user)
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '2015-01-01' } })
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(screen.getByText('Para usar Ciclita tienes que tener al menos 14 años.')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('si el correo ya tiene cuenta, lo dice en ese campo', async () => {
    vi.mocked(register).mockRejectedValue(new AccountError('emailInUse'))
    const user = userEvent.setup()
    render(<AuthScreen />)
    await fillRegister(user)
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    expect(await screen.findByText(/Ya hay una cuenta con este correo/)).toBeInTheDocument()
    expect(screen.getByLabelText('Correo electrónico')).toBeInvalid()
  })

  it('la contraseña se puede mostrar y se indica su seguridad', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)
    const input = screen.getByLabelText('Contraseña')
    await user.type(input, 'Ciclo-2026-segura')
    expect(screen.getByRole('img', { name: 'Seguridad de la contraseña: Fuerte' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Mostrar contraseña' })[0])
    expect(input).toHaveAttribute('type', 'text')
  })

  it('se puede leer la política de privacidad y volver', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getAllByRole('button', { name: /política de privacidad/i })[0])
    expect(screen.getByRole('heading', { name: 'Política de privacidad' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.getByRole('heading', { name: 'Crea tu cuenta' })).toBeInTheDocument()
  })
})

describe('Inicio de sesión', () => {
  it('entra con correo y contraseña', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: 'Inicia sesión' }))
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com')
    await user.type(screen.getByLabelText('Contraseña'), 'ciclo2026')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(login).toHaveBeenCalledWith('ana@correo.com', 'ciclo2026')
  })

  it('con datos incorrectos lo avisa', async () => {
    vi.mocked(login).mockRejectedValue(new AccountError('wrongCredentials'))
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: 'Inicia sesión' }))
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com')
    await user.type(screen.getByLabelText('Contraseña'), 'mal')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('El correo o la contraseña no son correctos.')
  })

  it('recuperar la contraseña envía el enlace sin decir si el correo existe', async () => {
    const user = userEvent.setup()
    render(<AuthScreen />)
    await user.click(screen.getByRole('button', { name: 'Inicia sesión' }))
    await user.click(screen.getByRole('button', { name: '¿Has olvidado tu contraseña?' }))
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.com')
    await user.click(screen.getByRole('button', { name: 'Enviar enlace' }))
    expect(sendReset).toHaveBeenCalledWith('ana@correo.com')
    expect(await screen.findByText(/Si hay una cuenta con ese correo/)).toBeInTheDocument()
  })
})
