// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../../db/db'
import { setSettings } from '../../db/settings'
import { addDays, formatLong, today } from '../../domain/dates'
import { DaySheet } from './DaySheet'

const DAY = addDays(today(), -3)

/** Abre un recuadro (Síntomas, Estado de ánimo…) de la cuadrícula. */
async function openTile(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }))
}
const back = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Todos los registros' }))

async function openSheet(date = DAY) {
  const onClose = vi.fn()
  render(<DaySheet date={date} onClose={onClose} />)
  // El formulario aparece cuando se ha leído el día de la base de datos.
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByRole('button', { name: 'Guardar' })
  return { dialog: within(dialog), onClose }
}

describe('Registro del día', () => {
  it('guarda comienzo del periodo, flujo, síntoma, ánimo y notas', async () => {
    const user = userEvent.setup()
    const { dialog, onClose } = await openSheet()

    await user.click(dialog.getByRole('button', { name: 'Comienzo del periodo' }))
    expect(await dialog.findByText('Día 1 del periodo')).toBeInTheDocument()
    await user.click(await dialog.findByRole('button', { name: /Abundante/ }))
    await openTile(user, 'Síntomas')
    await user.click(dialog.getAllByRole('button', { name: 'Dolor de cabeza' })[0])
    await back(user)
    await openTile(user, 'Estado de ánimo')
    await user.click(dialog.getByRole('button', { name: /Calma/ }))
    await back(user)
    await user.type(dialog.getByLabelText('Notas'), 'Día largo')
    await user.click(dialog.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db.days.get(DAY)).toMatchObject({
      flow: 'heavy',
      symptoms: ['Dolor de cabeza'],
      moods: ['calm'],
      notes: 'Día largo',
    })
    // Hace 3 días y suele durar 5: sigue en curso.
    expect(await db.periods.toArray()).toMatchObject([{ startDate: DAY, endDate: null }])
  })

  it('se pueden marcar varios estados de ánimo y quitar uno tocándolo otra vez', async () => {
    const user = userEvent.setup()
    render(<DaySheet date={DAY} onClose={() => {}} />)
    await openTile(user, 'Estado de ánimo')
    const group = within(await screen.findByRole('group', { name: 'Estado de ánimo' }))
    await user.click(group.getByRole('button', { name: /Estrés/ }))
    await user.click(group.getByRole('button', { name: /Sin energía/ }))
    await user.click(group.getByRole('button', { name: /Agobio/ }))
    await user.click(group.getByRole('button', { name: /Agobio/ }))
    expect(group.getByRole('button', { name: /Estrés/ })).toHaveAttribute('aria-pressed', 'true')
    expect(group.getByRole('button', { name: /Agobio/ })).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(async () => expect((await db.days.get(DAY))?.moods).toEqual(['stressed', 'tired']))
  })

  it('un día guardado con un solo ánimo (versión anterior) se carga marcado', async () => {
    await db.days.put({ date: DAY, mood: 'sad', updatedAt: 1 })
    render(<DaySheet date={DAY} onClose={() => {}} />)
    await openTile(userEvent.setup(), 'Estado de ánimo')
    const group = within(await screen.findByRole('group', { name: 'Estado de ánimo' }))
    expect(group.getByRole('button', { name: /Tristeza/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('ofrece 16 estados de ánimo para elegir', async () => {
    render(<DaySheet date={DAY} onClose={() => {}} />)
    await openTile(userEvent.setup(), 'Estado de ánimo')
    const group = await screen.findByRole('group', { name: 'Estado de ánimo' })
    const moods = within(group).getAllByRole('button')
    expect(moods).toHaveLength(16)
    expect(moods.map((b) => b.textContent)).toEqual(expect.arrayContaining(['🎢Altibajos', '🥰Cariño', '🤯Agobio']))
  })

  it('carga lo ya guardado y al quitarlo todo borra el registro', async () => {
    await db.days.put({ date: DAY, mood: 'sad', notes: 'Algo', updatedAt: 1 })
    const user = userEvent.setup()
    const { dialog, onClose } = await openSheet()

    expect(dialog.getByLabelText('Notas')).toHaveValue('Algo')
    await openTile(user, 'Estado de ánimo')
    expect(dialog.getByRole('button', { name: /Tristeza/ })).toHaveAttribute('aria-pressed', 'true')

    await user.click(dialog.getByRole('button', { name: /Tristeza/ }))
    await back(user)
    await user.clear(dialog.getByLabelText('Notas'))
    await user.click(dialog.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db.days.get(DAY)).toBeUndefined()
  })

  it('añade un síntoma personalizado y lo marca', async () => {
    const user = userEvent.setup()
    const { dialog } = await openSheet()

    await openTile(user, 'Síntomas')
    await user.type(dialog.getByRole('textbox', { name: 'Añadir síntoma' }), 'Dolor de oído')
    await user.click(dialog.getByRole('button', { name: 'Añadir síntoma' }))

    const chip = await dialog.findByRole('button', { name: 'Dolor de oído' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(await db.symptoms.where('name').equals('Dolor de oído').count()).toBe(1)
  })

  it('muestra los campos opcionales solo si están activados', async () => {
    await setSettings({ tracking: { temperature: true, mucus: false, sex: false, weight: false, pill: false, tests: false, bloodPressure: false } })
    const user = userEvent.setup()
    const { dialog, onClose } = await openSheet()

    expect(dialog.queryByRole('button', { name: /^Peso/ })).toBeNull()
    await openTile(user, 'Temperatura')
    await user.type(await dialog.findByLabelText('Temperatura basal'), '36,55')
    await user.click(dialog.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(await db.days.get(DAY)).toMatchObject({ temperature: 36.55 })
  })
})

describe('Semana y botones de periodo', () => {
  it('al pasar a otro día de la semana guarda lo escrito en el que estaba abierto', async () => {
    const user = userEvent.setup()
    const { dialog } = await openSheet()
    await user.type(dialog.getByLabelText('Notas'), 'Primera nota')
    const other = addDays(DAY, -1)
    // El día de antes puede caer en la semana anterior: se busca en la que esté.
    const label = new RegExp(`^${formatLong(other)}`, 'i')
    if (!dialog.queryByRole('button', { name: label })) await user.click(dialog.getByRole('button', { name: 'Semana anterior' }))
    await user.click(dialog.getByRole('button', { name: label }))
    expect(await dialog.findByRole('heading', { name: new RegExp(formatLong(other), 'i') })).toBeInTheDocument()
    expect(await dialog.findByLabelText('Notas')).toHaveValue('')
    expect(await db.days.get(DAY)).toMatchObject({ notes: 'Primera nota' })
  })

  it('«Fin del periodo» cierra el periodo en curso ese día', async () => {
    await db.periods.add({ startDate: addDays(DAY, -2), endDate: null })
    const user = userEvent.setup()
    const { dialog } = await openSheet()
    expect(dialog.getByText('Día 3 del periodo')).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Termina este día' }))
    await waitFor(async () => expect(await db.periods.toArray()).toMatchObject([{ startDate: addDays(DAY, -2), endDate: DAY }]))
    await user.click(await dialog.findByRole('button', { name: 'Deshacer' }))
    await waitFor(async () => expect(await db.periods.toArray()).toMatchObject([{ endDate: null }]))
  })
})

describe('Borrar el registro del día', () => {
  it('solo aparece si hay algo guardado y avisa a la pantalla para poder deshacerlo', async () => {
    const onCleared = vi.fn()
    const { unmount } = render(<DaySheet date={DAY} onClose={() => {}} onCleared={onCleared} />)
    await screen.findByRole('button', { name: 'Guardar' })
    expect(screen.queryByRole('button', { name: 'Borrar el registro de este día' })).toBeNull()
    unmount()

    await db.days.put({ date: DAY, notes: 'Algo', moods: ['sad'], updatedAt: 1 })
    const user = userEvent.setup()
    render(<DaySheet date={DAY} onClose={() => {}} onCleared={onCleared} />)
    await user.click(await screen.findByRole('button', { name: 'Borrar el registro de este día' }))
    await waitFor(async () => expect(await db.days.get(DAY)).toBeUndefined())
    expect(onCleared).toHaveBeenCalledWith(expect.objectContaining({ days: [expect.objectContaining({ notes: 'Algo' })] }))
  })
})

