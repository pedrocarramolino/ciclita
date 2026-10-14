// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dexie from 'dexie'
import { exportJSON } from '../../db/data'
import { db } from '../../db/db'
import { getSettings } from '../../db/settings'
import { today } from '../../domain/dates'
import { DataSection } from './DataSection'

/** Lo que el navegador "descarga" (jsdom no descarga archivos). */
let downloads: string[] = []

beforeEach(() => {
  downloads = []
  URL.createObjectURL = vi.fn(() => 'blob:prueba')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download)
  })
})

const fileInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!

describe('Tus datos', () => {
  it('importa una copia JSON tras confirmar y reemplaza los registros', async () => {
    // Copia hecha desde otra base de datos con un periodo y un día.
    await db.periods.add({ startDate: '2026-09-01', endDate: '2026-09-04' })
    await db.days.put({ date: '2026-09-02', mood: 'calm', updatedAt: 1 })
    const json = await exportJSON()
    await db.periods.clear()
    await db.days.clear()
    await db.periods.add({ startDate: '2020-01-01', endDate: '2020-01-03' }) // se reemplaza

    const user = userEvent.setup()
    const { container } = render(<DataSection lastBackup={null} />)
    await user.upload(fileInput(container), new File([json], 'copia.json', { type: 'application/json' }))

    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText('copia.json')).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Importado: 1 periodo y 1 día con registro.')).toBeInTheDocument()
    expect((await db.periods.toArray()).map((p) => p.startDate)).toEqual(['2026-09-01'])
    expect(await db.days.get('2026-09-02')).toMatchObject({ mood: 'calm' })
  })

  it('cancelar la importación no cambia nada', async () => {
    await db.periods.add({ startDate: '2020-01-01', endDate: '2020-01-03' })
    const user = userEvent.setup()
    const { container } = render(<DataSection lastBackup={null} />)
    await user.upload(fileInput(container), new File(['{}'], 'copia.json', { type: 'application/json' }))

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(await db.periods.count()).toBe(1)
  })

  it('un archivo que no es una copia muestra el error', async () => {
    const user = userEvent.setup()
    const { container } = render(<DataSection lastBackup={null} />)
    await user.upload(fileInput(container), new File(['hola'], 'notas.json', { type: 'application/json' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText(/No se pudo importar\. El archivo no es un JSON válido\./)).toBeInTheDocument()
  })

  it('exportar descarga el archivo y apunta la fecha de la copia', async () => {
    const user = userEvent.setup()
    render(<DataSection lastBackup={null} />)
    expect(screen.getByText('Aún no has hecho ninguna copia.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Exportar copia completa (JSON)' }))
    await waitFor(() => expect(downloads).toEqual([`ciclita-${today()}.json`]))
    await waitFor(async () => expect((await getSettings()).lastBackup).toBe(today()))
  })

  it('borrar todos los datos pide dos confirmaciones y escribir BORRAR', async () => {
    await db.periods.add({ startDate: '2026-09-01', endDate: '2026-09-04' })
    vi.spyOn(console, 'error').mockImplementation(() => {}) // jsdom no recarga la página
    const user = userEvent.setup()
    render(<DataSection lastBackup={null} />)

    await user.click(screen.getByRole('button', { name: 'Borrar todos mis datos' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Continuar' }))

    const second = within(await screen.findByRole('dialog', { name: 'Confirmación final' }))
    const confirm = second.getByRole('button', { name: 'Borrar definitivamente' })
    expect(confirm).toBeDisabled()
    await user.type(second.getByLabelText('Escribe BORRAR'), 'borrar')
    await user.click(confirm)

    // La base de datos se elimina entera (la app recarga después).
    await waitFor(async () => expect(await Dexie.exists(db.name)).toBe(false))
  })
})
