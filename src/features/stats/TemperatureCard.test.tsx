// @vitest-environment jsdom
import '../../test/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { addDays } from '../../domain/dates'
import { temperatureCycles } from '../../domain/temperature'
import { TemperatureCard } from './TemperatureCard'

const S1 = '2026-09-01'
const S2 = '2026-09-29'
const periods = [
  { startDate: S1, endDate: addDays(S1, 4) },
  { startDate: S2, endDate: addDays(S2, 4) },
]
const before = [36.3, 36.4, 36.35, 36.3, 36.4, 36.35, 36.4, 36.3, 36.35, 36.4, 36.3, 36.35, 36.4, 36.35]
const after = [36.7, 36.75, 36.8, 36.8]
const days = [
  ...[...before, ...after].map((temperature, i) => ({ date: addDays(S1, i), temperature, updatedAt: 0 })),
  { date: addDays(S2, 1), temperature: 36.4, updatedAt: 0 },
]

describe('Temperatura basal', () => {
  it('muestra el ciclo actual y, en el anterior, la subida detectada', async () => {
    const cycles = temperatureCycles(periods, days, '2026-10-02')
    const user = userEvent.setup()
    render(<TemperatureCard cycles={cycles} />)

    expect(screen.getByText(/Ciclo del 29 de septiembre · ciclo actual/)).toBeInTheDocument()
    expect(screen.getByText(/Aún no se ve una subida clara/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ciclo siguiente' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Ciclo anterior' }))
    expect(screen.getByText(/Ciclo del 1 de septiembre/)).toBeInTheDocument()
    expect(screen.getByText('La temperatura subió el día 15 del ciclo: la ovulación fue probablemente el día 14.')).toBeInTheDocument()
    // La tabla accesible tiene todas las tomas.
    expect(screen.getAllByRole('row')).toHaveLength(1 + before.length + after.length)
  })
})
