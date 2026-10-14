// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getSettings } from '../../db/settings'
import { SettingsScreen } from './SettingsScreen'

describe('Ajustes: previsiones', () => {
  it('pasar a "Con estas duraciones" fija 28/5 si no había y oculta "No lo sé"', async () => {
    const user = userEvent.setup()
    render(<SettingsScreen />)
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
