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

  it('un recordatorio libre solo unos días del ciclo (p. ej. del 15 al 26)', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<RemindersSection settings={DEFAULT_SETTINGS} />)
    await user.click(screen.getByRole('button', { name: 'Añadir recordatorio' }))
    await waitFor(async () => expect((await getSettings()).reminders.custom).toHaveLength(1))
    rerender(<RemindersSection settings={await getSettings()} />)

    const group = within(screen.getByRole('region', { name: 'Tus recordatorios' }))
    await user.type(group.getByLabelText('Qué es'), 'P')
    // En la app los ajustes llegan en vivo; aquí se vuelven a pasar tras cada cambio.
    await waitFor(async () => expect((await getSettings()).reminders.custom[0].name).toBe('P'))
    rerender(<RemindersSection settings={await getSettings()} />)
    await user.selectOptions(group.getByLabelText('Cuándo'), 'cycle')
    await waitFor(async () =>
      expect((await getSettings()).reminders.custom[0]).toMatchObject({ name: 'P', cycleDays: { from: 15, to: 26 } }),
    )
    rerender(<RemindersSection settings={await getSettings()} />)
    expect(group.getByLabelText('Desde el día')).toHaveValue(15)
    expect(group.getByLabelText('Hasta el día')).toHaveValue(26)

    await user.click(group.getByRole('button', { name: 'Quitar este recordatorio' }))
    await waitFor(async () => expect((await getSettings()).reminders.custom).toEqual([]))
  })
})

