// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../../db/db'
import { formatLong, toISODate, type ISODate } from '../../domain/dates'
import { CalendarScreen } from './CalendarScreen'
import { openCalendarAt } from './calendarFocus'

/** Días del mes pasado (siempre en el pasado, así se pueden tocar). */
const now = new Date()
const lastMonth = (day: number): ISODate => toISODate(new Date(now.getFullYear(), now.getMonth() - 1, day))
const dayButton = (d: ISODate) => screen.getAllByRole('button', { name: (n) => n.startsWith(formatLong(d)) })[0]
const periods = async () =>
  (await db.periods.orderBy('startDate').toArray()).map(({ startDate, endDate }) => ({ startDate, endDate }))

describe('Calendario: editar periodos', () => {
  it('marca un periodo tocando el primer y el último día, y se puede deshacer', async () => {
    openCalendarAt(lastMonth(15))
    const user = userEvent.setup()
    render(<CalendarScreen />)

    await user.click(await screen.findByRole('button', { name: 'Editar periodos' }))
    await user.click(dayButton(lastMonth(14)))
    expect(dayButton(lastMonth(14))).toHaveAccessibleName(/primer día elegido/)
    expect(screen.getByText(/Ahora toca el último/)).toBeInTheDocument()

    await user.click(dayButton(lastMonth(10)))
    await waitFor(async () => expect(await periods()).toEqual([{ startDate: lastMonth(10), endDate: lastMonth(14) }]))
    expect(screen.getByRole('status')).toHaveTextContent(/\(5 días\)/)

    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(async () => expect(await periods()).toEqual([]))
  })

  it('tocar un día marcado lo quita, y un tramo demasiado largo no se marca', async () => {
    await db.periods.add({ startDate: lastMonth(3), endDate: lastMonth(7) })
    openCalendarAt(lastMonth(15), { edit: true })
    const user = userEvent.setup()
    render(<CalendarScreen />)

    // Abierto directamente en modo edición (como desde "¿Se te olvidó registrar un periodo?").
    expect(await screen.findByRole('heading', { name: 'Editar periodos' })).toBeInTheDocument()
    await waitFor(() => expect(dayButton(lastMonth(7))).toHaveAccessibleName(/Periodo/))
    await user.click(dayButton(lastMonth(7)))
    await waitFor(async () => expect(await periods()).toEqual([{ startDate: lastMonth(3), endDate: lastMonth(6) }]))

    await user.click(dayButton(lastMonth(10)))
    await user.click(dayButton(lastMonth(28)))
    expect(screen.getByRole('status')).toHaveTextContent(/Serían 19 días/)
    expect(await periods()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Listo' }))
    expect(screen.queryByRole('heading', { name: 'Editar periodos' })).toBeNull()
  })
})
