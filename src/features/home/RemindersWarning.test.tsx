// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_REMINDERS, setSettings } from '../../db/settings'
import { permission, requestPermission, syncPush } from '../../push/pushClient'
import { RemindersWarning } from './RemindersWarning'

vi.mock('../../push/pushClient', () => ({
  permission: vi.fn(() => 'granted'),
  requestPermission: vi.fn(async () => 'granted'),
  syncPush: vi.fn(async () => {}),
}))

beforeEach(() => {
  localStorage.clear()
  vi.mocked(permission).mockReturnValue('granted')
  vi.mocked(syncPush).mockClear()
})

describe('Aviso de recordatorios que no llegan (inicio)', () => {
  it('con todo bien o sin recordatorios no aparece', async () => {
    await setSettings({ reminders: { ...DEFAULT_REMINDERS, pillEnabled: true } })
    const { container } = render(<RemindersWarning prediction={null} />)
    await new Promise((r) => setTimeout(r, 50))
    expect(container).toBeEmptyDOMElement()
  })

  it('sin permiso, lo pide y vuelve a registrar los avisos', async () => {
    vi.mocked(permission).mockReturnValue('default')
    await setSettings({ reminders: { ...DEFAULT_REMINDERS, pillEnabled: true } })
    const user = userEvent.setup()
    render(<RemindersWarning prediction={null} />)
    expect(await screen.findByRole('heading', { name: /no llegan a este dispositivo/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Permitir notificaciones' }))
    expect(requestPermission).toHaveBeenCalled()
    await waitFor(() => expect(syncPush).toHaveBeenCalledWith(null, { force: true }))
  })

  it('si el servidor dio error, lo muestra con "Reintentar"; ocultarlo vale hasta que cambie el problema', async () => {
    await setSettings({ reminders: { ...DEFAULT_REMINDERS, pillEnabled: true }, pushError: 'Sesión no válida' })
    const user = userEvent.setup()
    const { unmount } = render(<RemindersWarning prediction={null} />)
    expect(await screen.findByText(/No se han podido activar en el servidor: Sesión no válida/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ocultar en este dispositivo' }))
    expect(screen.queryByRole('heading', { name: /no llegan/ })).toBeNull()
    unmount()

    await setSettings({ pushError: 'Otro error' })
    render(<RemindersWarning prediction={null} />)
    expect(await screen.findByText(/Otro error/)).toBeInTheDocument()
  })

  it('con las notificaciones bloqueadas, lleva a los ajustes de recordatorios', async () => {
    vi.mocked(permission).mockReturnValue('denied')
    await setSettings({ reminders: { ...DEFAULT_REMINDERS, dailyEnabled: true } })
    render(<RemindersWarning prediction={null} />)
    expect(await screen.findByText(/están bloqueadas/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver recordatorios' })).toHaveAttribute('href', '#/settings/reminders')
  })
})
