// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, getSettings } from '../../db/settings'
import { axeViolations } from '../../test/axe'
import { RemindersSection } from './RemindersSection'

// Notificaciones permitidas (jsdom no tiene Push API).
vi.mock('../../push/pushClient', () => ({
  permission: () => 'granted',
  requestPermission: vi.fn(async () => 'granted'),
  showTestNotification: vi.fn(),
  syncPush: vi.fn(),
}))

describe('Ajustes → Recordatorios', () => {
  it('agrupa los avisos y solo muestra las opciones de los activados', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<RemindersSection settings={DEFAULT_SETTINGS} />)

    const groups = ['Tu ciclo', 'Cada día', 'Otros avisos', 'Cómo llegan']
    for (const g of groups) expect(screen.getByRole('region', { name: g })).toBeInTheDocument()
    expect(screen.queryByText('¿Qué datos se envían?')).toBeNull()
    // Sin activar, no hay opciones a la vista.
    expect(screen.queryByLabelText('Hora')).toBeNull()

    const daily = within(screen.getByRole('region', { name: 'Cada día' }))
    await user.click(daily.getByRole('switch', { name: 'Píldora anticonceptiva' }))
    await waitFor(async () => expect((await getSettings()).reminders.pillEnabled).toBe(true))
    rerender(<RemindersSection settings={await getSettings()} />)
    expect(screen.getByLabelText('Hora')).toHaveValue('22:00')
    expect(await axeViolations()).toEqual([])
  })
})
