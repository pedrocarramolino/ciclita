// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSettings } from '../../db/settings'
import { toB64url } from '../../security/biometric'
import { hashPin } from '../../security/pin'
import { BiometricSetting } from './BiometricSetting'

afterEach(() => {
  vi.unstubAllGlobals()
})

const withPlatformAuthenticator = (create = vi.fn()) => {
  vi.stubGlobal('PublicKeyCredential', { isUserVerifyingPlatformAuthenticatorAvailable: async () => true })
  Object.defineProperty(navigator, 'credentials', { value: { create }, configurable: true })
  return create
}

describe('Ajuste de Face ID o huella', () => {
  it('no aparece si el dispositivo no lo tiene', async () => {
    vi.stubGlobal('PublicKeyCredential', { isUserVerifyingPlatformAuthenticatorAvailable: async () => false })
    const { container } = render(<BiometricSetting pinHash="h" credentialId={null} encrypted={false} />)
    await new Promise((r) => setTimeout(r, 30))
    expect(container).toBeEmptyDOMElement()
  })

  it('se activa tras comprobar el PIN y crear la llave', async () => {
    const rawId = Uint8Array.from([1, 2, 3])
    const create = withPlatformAuthenticator(
      vi.fn().mockResolvedValue({ rawId: rawId.buffer, getClientExtensionResults: () => ({}) }),
    )
    const pinHash = await hashPin('2580', 1000)
    const user = userEvent.setup()
    render(<BiometricSetting pinHash={pinHash} credentialId={null} encrypted={false} />)

    await user.click(await screen.findByRole('button', { name: 'Activar Face ID o huella' }))
    for (const d of '1111') await user.click(screen.getByRole('button', { name: `Dígito ${d}` }))
    expect(await screen.findByText('PIN incorrecto. Inténtalo de nuevo.')).toBeInTheDocument()
    for (const d of '2580') await user.click(screen.getByRole('button', { name: `Dígito ${d}` }))

    await user.click(await screen.findByRole('button', { name: 'Continuar' }))
    await waitFor(async () => expect((await getSettings()).biometric).toEqual({ credentialId: toB64url(rawId) }))
    expect(create).toHaveBeenCalledOnce()
    expect(await screen.findByText('Face ID o huella activado.')).toBeInTheDocument()
  })
})
