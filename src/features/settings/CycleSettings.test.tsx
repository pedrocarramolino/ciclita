// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getSettings } from '../../db/settings'
import { SettingsScreen } from './SettingsScreen'

describe('Ajustes: previsiones', () => {
  it('pasar a "Con estas duraciones" fija 28/5 si no había y oculta "No lo sé"', async () => {
    location.hash = '#/settings/cycle'
    const user = userEvent.setup()
    render(<SettingsScreen />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Tu ciclo' })).toBeInTheDocument()
    expect(await screen.findByRole('radio', { name: /Automáticas/ })).toBeChecked()
    expect(screen.getByRole('button', { name: /No lo sé/ })).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Con estas duraciones/ }))
    await waitFor(async () =>
      expect(await getSettings()).toMatchObject({ manualPrediction: true, cycleLength: 28, periodLength: 5 }),
    )
    expect(screen.queryByRole('button', { name: /No lo sé/ })).toBeNull()
    expect(screen.getByText('Las previsiones usan siempre estas duraciones.')).toBeInTheDocument()
  })
})

describe('Ajustes: menú', () => {
  it('agrupa los apartados y "Tus datos" tiene solo exportar e importar y el informe', async () => {
    location.hash = '#/settings'
    render(<SettingsScreen />)
    const data = await screen.findByRole('region', { name: 'Tus datos' })
    const links = within(data).getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['#/settings/backup', '#/report'])
    expect(links[0]).toHaveTextContent('Exportar e importar')
    expect(links[1]).toHaveTextContent('Informe para el médico')
    // Resúmenes de cada apartado.
    expect(screen.getByRole('link', { name: /Recordatorios.*Desactivados/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Privacidad y seguridad.*Sin PIN/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Ana Prueba.*prueba@ciclita\.test/ })).toBeInTheDocument()
  })

  it('cada apartado se abre en su página y "Ajustes" vuelve al menú', async () => {
    location.hash = '#/settings/reminders'
    const user = userEvent.setup()
    render(<SettingsScreen />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Recordatorios' })).toBeInTheDocument()
    // El título no se repite dentro de la página.
    expect(screen.getAllByText('Recordatorios')).toHaveLength(1)
    await user.click(screen.getByRole('link', { name: 'Ajustes' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Ajustes' })).toBeInTheDocument()
  })
})
