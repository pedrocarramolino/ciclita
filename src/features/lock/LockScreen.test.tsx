// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getSettings, setSettings } from '../../db/settings'
import { hashPin, MAX_ATTEMPTS } from '../../security/pin'
import { LockScreen } from './LockScreen'

/** Hash con pocas iteraciones para que las pruebas sean rápidas. */
const setPin = async (pin: string) => setSettings({ pinHash: await hashPin(pin, 1000) })

async function typePin(user: UserEvent, pin: string) {
  for (const d of pin) await user.click(screen.getByRole('button', { name: `Dígito ${d}` }))
}

describe('Pantalla de bloqueo', () => {
  it('desbloquea con el PIN correcto', async () => {
    await setPin('2580')
    const onUnlock = vi.fn()
    const user = userEvent.setup()
    render(<LockScreen onUnlock={onUnlock} />)

    await typePin(user, '2580')
    await waitFor(() => expect(onUnlock).toHaveBeenCalledOnce())
  })

  it('con un PIN incorrecto avisa, cuenta el fallo y no desbloquea', async () => {
    await setPin('2580')
    const onUnlock = vi.fn()
    const user = userEvent.setup()
    render(<LockScreen onUnlock={onUnlock} />)

    await typePin(user, '1111')
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/PIN incorrecto/))
    expect(screen.getByRole('alert')).toHaveTextContent(`Te quedan ${MAX_ATTEMPTS - 1} intentos`)
    expect(onUnlock).not.toHaveBeenCalled()
    expect((await getSettings()).pinFailures).toBe(1)
  })

  it('tras agotar los intentos obliga a esperar y bloquea el teclado', async () => {
    await setPin('2580')
    await setSettings({ pinFailures: MAX_ATTEMPTS - 1 })
    const user = userEvent.setup()
    render(<LockScreen onUnlock={vi.fn()} />)

    await typePin(user, '0000')
    expect(await screen.findByText(/Demasiados intentos/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dígito 2' })).toBeDisabled()
  })

  it('"¿Has olvidado tu PIN?" explica que solo queda borrar los datos', async () => {
    await setPin('2580')
    const user = userEvent.setup()
    render(<LockScreen onUnlock={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '¿Has olvidado tu PIN?' }))
    expect(screen.getByText(/no se puede recuperar el PIN/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Borrar todos mis datos' })).toBeInTheDocument()
  })

  it('con Face ID o huella desbloquea al abrir, sin teclear el PIN', async () => {
    await setPin('2580')
    await setSettings({ pinFailures: 2 })
    const onUnlock = vi.fn()
    const biometric = vi.fn().mockResolvedValue(true)
    render(<LockScreen onUnlock={onUnlock} biometric={biometric} />)

    await waitFor(() => expect(onUnlock).toHaveBeenCalledOnce())
    expect(biometric).toHaveBeenCalledOnce()
    expect((await getSettings()).pinFailures).toBe(0)
  })

  it('si se cancela Face ID queda el botón para reintentarlo y el PIN', async () => {
    await setPin('2580')
    const onUnlock = vi.fn()
    const biometric = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('cancelado', 'NotAllowedError'))
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const user = userEvent.setup()
    render(<LockScreen onUnlock={onUnlock} biometric={biometric} />)

    const button = await screen.findByRole('button', { name: 'Usar Face ID o huella' })
    await waitFor(() => expect(button).toBeEnabled())
    expect(screen.getByRole('alert')).toHaveTextContent('')

    await user.click(button)
    expect(await screen.findByText('No se ha podido comprobar. Usa tu PIN.')).toBeInTheDocument()
    expect(onUnlock).not.toHaveBeenCalled()

    await user.click(button)
    await waitFor(() => expect(onUnlock).toHaveBeenCalledOnce())
  })

  it('sin Face ID activado no aparece el botón', async () => {
    await setPin('2580')
    render(<LockScreen onUnlock={vi.fn()} />)
    await screen.findByRole('button', { name: 'Dígito 1' })
    expect(screen.queryByRole('button', { name: 'Usar Face ID o huella' })).toBeNull()
  })
})

