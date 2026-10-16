// @vitest-environment jsdom
import '../../test/ui'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../../db/db'
import { addDays, formatLong, today } from '../../domain/dates'
import { NextAppointment } from '../home/NextAppointment'
import { axeViolations } from '../../test/axe'
import { CalendarScreen } from './CalendarScreen'

const dayButton = (d: string) => screen.getAllByRole('button', { name: (n) => n.startsWith(formatLong(d)) })[0]

describe('Citas médicas', () => {
  it('se añade una cita con notas y aviso, se marca en el calendario y se puede borrar', async () => {
    const date = addDays(today(), 2)
    const user = userEvent.setup()
    render(<CalendarScreen />)

    await user.click(await screen.findByRole('button', { name: 'Añadir cita médica' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Nueva cita médica' }))
    await user.click(dialog.getByRole('button', { name: /Ecografía/ }))
    fireEvent.change(dialog.getByLabelText('Día'), { target: { value: date } })
    fireEvent.change(dialog.getByLabelText('Hora'), { target: { value: '10:30' } })
    await user.type(dialog.getByLabelText('Con quién o qué (opcional)'), 'Dra. López')
    await user.type(dialog.getByLabelText('Notas'), 'Preguntar por la analítica')
    expect(dialog.getByRole('switch', { name: 'Avisarme' })).toBeChecked()
    fireEvent.change(dialog.getByLabelText('Hora del aviso'), { target: { value: '19:00' } })
    await user.click(dialog.getByRole('button', { name: 'Guardar' }))

    await waitFor(async () => expect(await db.appointments.count()).toBe(1))
    const [saved] = await db.appointments.toArray()
    expect(saved).toMatchObject({
      type: 'ultrasound',
      date,
      time: '10:30',
      title: 'Dra. López',
      notes: 'Preguntar por la analítica',
      reminder: { time: '19:00' },
    })

    // Marcada en el calendario y en la lista.
    await waitFor(() => expect(dayButton(date)).toHaveAccessibleName(/cita médica/))
    const list = within(screen.getByRole('region', { name: 'Citas médicas' }))
    await user.click(list.getByRole('button', { name: /Ecografía · Dra. López/ }))

    const edit = within(await screen.findByRole('dialog', { name: 'Cita médica' }))
    expect(edit.getByLabelText('Notas')).toHaveValue('Preguntar por la analítica')
    expect(await axeViolations()).toEqual([])
    await user.click(edit.getByRole('button', { name: 'Borrar cita' }))
    await user.click(within(await screen.findByRole('dialog', { name: '¿Borrar esta cita?' })).getByRole('button', { name: 'Borrar cita' }))
    await waitFor(async () => expect(await db.appointments.count()).toBe(0))
  })

  it('la próxima cita aparece en el inicio', async () => {
    await db.appointments.put({
      id: 'x',
      type: 'gynecology',
      date: addDays(today(), 5),
      time: '09:15',
      reminder: null,
      updatedAt: 1,
    })
    render(<NextAppointment />)
    expect(await screen.findByText('Próxima cita')).toBeInTheDocument()
    expect(screen.getByText('Ginecología')).toBeInTheDocument()
    expect(screen.getByText(`${formatLong(addDays(today(), 5))}, 09:15`)).toBeInTheDocument()
  })
})
