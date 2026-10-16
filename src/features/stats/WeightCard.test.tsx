// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../test/axe'
import { WeightCard } from './WeightCard'

const TODAY = '2026-10-16'
const days = [
  { date: '2026-03-10', weight: 65, updatedAt: 1 },
  { date: '2026-08-20', weight: 63.5, updatedAt: 1 },
  { date: '2026-10-01', weight: 62.8, updatedAt: 1 },
  { date: '2026-10-02', notes: 'sin peso', updatedAt: 1 },
]

describe('Gráfica de peso', () => {
  it('muestra el último peso, el cambio del rango y la tabla; se puede cambiar el rango', async () => {
    const user = userEvent.setup()
    render(<WeightCard days={days} periods={[]} today={TODAY} />)
    expect(screen.getByRole('heading', { name: 'Peso' })).toBeInTheDocument()
    expect(screen.getAllByText('62,8 kg').length).toBeGreaterThan(0) // tarjeta y tabla
    // Últimos 3 meses: de 63,5 a 62,8.
    expect(screen.getByText('−0,7 kg')).toBeInTheDocument()
    expect(screen.getByText('2 pesadas en este periodo')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Todo' }))
    expect(screen.getByText('−2,2 kg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'true')

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(4) // cabecera + 3 pesadas
    expect(await axeViolations()).toEqual([])
  })

  it('sin ningún peso registrado no aparece', () => {
    const { container } = render(<WeightCard days={[{ date: '2026-10-01', notes: 'x', updatedAt: 1 }]} periods={[]} today={TODAY} />)
    expect(container).toBeEmptyDOMElement()
  })
})
