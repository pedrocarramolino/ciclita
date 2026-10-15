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
import { deleteCloudData } from '../../account/sync'
import { AccountSection } from './AccountSection'
import { DataSection } from './DataSection'

/** Lo que el navegador "descarga" (jsdom no descarga archivos). */
let downloads: string[] = []
let blobs: Blob[] = []

beforeEach(() => {
  downloads = []
  blobs = []
  URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b)
    return 'blob:prueba'
  })
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

  it('Tu cuenta → borrar todos los datos pide dos confirmaciones y escribir BORRAR', async () => {
    await db.periods.add({ startDate: '2026-09-01', endDate: '2026-09-04' })
    vi.spyOn(console, 'error').mockImplementation(() => {}) // jsdom no recarga la página
    const user = userEvent.setup()
    render(<AccountSection user={{ uid: 'test-uid', email: 'ana@correo.com', emailVerified: true, displayName: 'Ana' }} />)

    await user.click(screen.getByRole('button', { name: 'Borrar todos mis datos' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Continuar' }))

    const second = within(await screen.findByRole('dialog', { name: 'Confirmación final' }))
    const confirm = second.getByRole('button', { name: 'Borrar definitivamente' })
    expect(confirm).toBeDisabled()
    await user.type(second.getByLabelText('Escribe BORRAR'), 'borrar')
    await user.click(confirm)

    // Primero los registros de la cuenta (sin el perfil) y luego el dispositivo entero.
    await waitFor(async () => expect(await Dexie.exists(db.name)).toBe(false))
    expect(deleteCloudData).toHaveBeenCalledWith('test-uid', { withProfile: false })
  })

  it('exporta una copia cifrada con contraseña y la vuelve a importar', async () => {
    await db.periods.add({ startDate: '2026-09-01', endDate: '2026-09-04' })
    await db.days.put({ date: '2026-09-02', notes: 'Muy privado', updatedAt: 1 })
    const user = userEvent.setup()
    const { container } = render(<DataSection lastBackup={null} />)

    await user.click(screen.getByRole('button', { name: 'Exportar copia cifrada con contraseña' }))
    let dialog = within(await screen.findByRole('dialog', { name: 'Copia cifrada con contraseña' }))
    await user.type(dialog.getByLabelText('Contraseña'), 'corta')
    await user.click(dialog.getByRole('button', { name: 'Cifrar y exportar' }))
    expect(dialog.getByRole('alert')).toHaveTextContent('Usa al menos 8 caracteres.')

    await user.clear(dialog.getByLabelText('Contraseña'))
    await user.type(dialog.getByLabelText('Contraseña'), 'luna llena 2026')
    await user.type(dialog.getByLabelText('Repite la contraseña'), 'luna llena 2026')
    await user.click(dialog.getByRole('button', { name: 'Cifrar y exportar' }))

    dialog = within(await screen.findByRole('dialog', { name: 'Copia cifrada lista' }, { timeout: 5000 }))
    await user.click(dialog.getByRole('button', { name: 'Guardar copia' }))
    await waitFor(() => expect(downloads).toEqual([`ciclita-${today()}-cifrada.json`]))
    const text = await blobs[0].text()
    expect(text).toContain('ciclita-encrypted-backup')
    expect(text).not.toContain('Muy privado')
    await waitFor(async () => expect((await getSettings()).lastBackup).toBe(today()))

    // Se borran los datos y se importa la copia cifrada.
    await db.periods.clear()
    await db.days.clear()
    await user.upload(fileInput(container), new File([text], 'copia-cifrada.json', { type: 'application/json' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Continuar' }))

    dialog = within(await screen.findByRole('dialog', { name: 'Esta copia está cifrada' }))
    await user.type(dialog.getByLabelText('Contraseña'), 'otra contraseña')
    await user.click(dialog.getByRole('button', { name: 'Descifrar e importar' }))
    await waitFor(() => expect(dialog.getByRole('alert')).toHaveTextContent('Contraseña incorrecta.'), { timeout: 5000 })

    await user.clear(dialog.getByLabelText('Contraseña'))
    await user.type(dialog.getByLabelText('Contraseña'), 'luna llena 2026')
    await user.click(dialog.getByRole('button', { name: 'Descifrar e importar' }))
    expect(await screen.findByText('Importado: 1 periodo y 1 día con registro.', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(await db.days.get('2026-09-02')).toMatchObject({ notes: 'Muy privado' })
  }, 20_000)
})
