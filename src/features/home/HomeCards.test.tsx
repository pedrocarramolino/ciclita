// @vitest-environment jsdom
import '../../test/ui'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../../db/db'
import { setSettings } from '../../db/settings'
import { addDays, today } from '../../domain/dates'
import { Home } from './Home'
import { PillCard } from './PillCard'

const pillOn = (start: string, pack: 21 | 24 | 28 = 21) =>
  setSettings({
    tracking: { temperature: false, mucus: false, sex: false, weight: false, pill: true, tests: false, bloodPressure: false },
    pill: { pack, start },
  })

describe('Píldora de hoy', () => {
  it('marca y desmarca la píldora de hoy', async () => {
    await pillOn(addDays(today(), -2)) // hoy es el día 3 del envase
    const user = userEvent.setup()
    render(<PillCard />)

    expect(await screen.findByText('Día 3 del envase')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Marcar como tomada' }))
    expect(await screen.findByText('Tomada')).toBeInTheDocument()
    expect(await db.days.get(today())).toMatchObject({ pillTaken: true })

    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(await screen.findByRole('button', { name: 'Marcar como tomada' })).toBeInTheDocument()
    expect(await db.days.get(today())).toBeUndefined()
  })

  it('avisa si la de ayer no está marcada', async () => {
    await pillOn(addDays(today(), -2))
    render(<PillCard />)
    expect(await screen.findByText(/La de ayer no está marcada/)).toBeInTheDocument()
  })

  it('en los días de descanso no pide marcarla', async () => {
    await pillOn(addDays(today(), -22)) // día 23: descanso en un envase 21 + 7
    render(<PillCard />)
    expect(await screen.findByText('Hoy es día de descanso: no toca píldora.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Marcar como tomada' })).toBeNull()
  })

  it('no aparece si no se registra la píldora', async () => {
    const { container } = render(<PillCard />)
    await new Promise((r) => setTimeout(r, 50))
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Preguntas del inicio', () => {
  it('solo se ve una pregunta a la vez: primero "¿Ha terminado tu periodo?"', async () => {
    // Un ciclo larguísimo (¿periodo olvidado?) y un periodo en curso desde hace 9 días.
    await setSettings({ cycleLength: 28 })
    await db.periods.bulkAdd([
      { startDate: addDays(today(), -60), endDate: addDays(today(), -56) },
      { startDate: addDays(today(), -8), endDate: null },
    ])
    const user = userEvent.setup()
    render(<Home />)
    expect(await screen.findByRole('heading', { name: '¿Ha terminado tu periodo?' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '¿Se te olvidó registrar un periodo?' })).toBeNull()

    // Al responder, sale la siguiente.
    await user.click(screen.getByRole('button', { name: 'Todavía no' }))
    expect(await screen.findByRole('heading', { name: '¿Se te olvidó registrar un periodo?' })).toBeInTheDocument()
  })
})

describe('Tu ciclo: en qué se basa la previsión', () => {
  it('con un solo ciclo lo combina con el habitual e invita a añadir periodos anteriores', async () => {
    await db.periods.bulkAdd([
      { startDate: addDays(today(), -50), endDate: addDays(today(), -46) },
      { startDate: addDays(today(), -14), endDate: addDays(today(), -10) },
    ])
    const user = userEvent.setup()
    render(<Home />)

    // Ciclo de 36 días + 28 habituales → 32.
    expect(await screen.findByText('Según tu único ciclo registrado, combinado con 28 días')).toBeInTheDocument()
    expect(screen.getByText('32')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Añadir periodos anteriores' }))
    expect(location.hash).toBe('#/calendar')
  })

  it('con tres ciclos o más usa solo los registros y no muestra la invitación', async () => {
    await db.periods.bulkAdd(
      [-90, -60, -30, -1].map((d) => ({ startDate: addDays(today(), d), endDate: addDays(today(), d + 4) })),
    )
    render(<Home />)
    expect(await screen.findByText('Según tus últimos 3 ciclos')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Añadir periodos anteriores' })).toBeNull()
  })
})

