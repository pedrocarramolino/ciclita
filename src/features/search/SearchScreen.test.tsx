// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../../db/db'
import { SearchScreen } from './SearchScreen'

describe('Buscar', () => {
  it('encuentra notas y síntomas, muestra el historial y abre el día', async () => {
    await db.days.bulkPut([
      { date: '2026-08-10', symptoms: ['Migraña'], medication: 'Ibuprofeno', updatedAt: 1 },
      { date: '2026-09-20', notes: 'Tuve una migraña fuerte', updatedAt: 1 },
      { date: '2026-10-01', notes: 'Todo bien', updatedAt: 1 },
    ])
    const user = userEvent.setup()
    render(<SearchScreen />)

    const input = screen.getByRole('searchbox', { name: 'Buscar en notas, síntomas y medicación' })
    expect(input).toHaveFocus()
    expect(screen.getByText(/Busca en tus notas/)).toBeInTheDocument()

    await user.type(input, 'MIGRANA')
    expect(await screen.findByText('2 días')).toBeInTheDocument()
    expect(screen.getByText(/1 día · el último, el 10 de agosto de 2026/)).toBeInTheDocument()

    const results = screen.getAllByRole('button', { name: /de 2026/ })
    expect(results.map((b) => within(b).getByText(/de 2026$/).textContent)).toEqual([
      '20 de septiembre de 2026',
      '10 de agosto de 2026',
    ])
    expect(within(results[0]).getByText('migraña').tagName).toBe('MARK')

    await user.click(results[0])
    expect(await screen.findByRole('dialog')).toHaveTextContent('Domingo, 20 de septiembre')
  })

  it('dice cuando no hay resultados', async () => {
    const user = userEvent.setup()
    render(<SearchScreen />)
    await user.type(screen.getByRole('searchbox'), 'xyz')
    expect(await screen.findByText('No hay ningún día que coincida.')).toBeInTheDocument()
  })
})
