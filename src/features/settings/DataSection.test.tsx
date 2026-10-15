// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dexie from 'dexie'
import { exportCSV } from '../../db/data'
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

describe('Exportar e importar (CSV)', () => {
  it('solo ofrece exportar e importar registros en CSV', () => {
    render(<DataSection lastBackup={null} />)
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Exportar registros (CSV)',
      'Importar registros (CSV)',
    ])
  })

  it('exportar descarga el CSV y apunta la fecha de la copia', async () => {
    await db.periods.add({ startDate: '2026-09-01', endDate: '2026-09-02' })
    const user = userEvent.setup()
    render(<DataSection lastBackup={null} />)
    expect(screen.getByText('Aún no has hecho ninguna copia.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Exportar registros (CSV)' }))
    await waitFor(() => expect(downloads).toEqual([`ciclita-${today()}.csv`]))
    expect(await blobs[0].text()).toContain('2026-09-01')
    await waitFor(async () => expect((await getSettings()).lastBackup).toBe(today()))
  })

  it('importa un CSV tras confirmar y reemplaza los registros', async () => {
    // CSV hecho con un periodo y un día con nota.
    await db.periods.add({ startDate: '2026-09-01', endDate: '2026-09-02' })
    await db.days.put({ date: '2026-09-02', notes: 'Hola', updatedAt: 1 })
    const csv = await exportCSV()
    await db.periods.clear()
    await db.days.clear()
    await db.periods.add({ startDate: '2020-01-01', endDate: '2020-01-03' }) // se reemplaza

    const user = userEvent.setup()
    const { container } = render(<DataSection lastBackup={null} />)
    expect(fileInput(container)).toHaveAttribute('accept', '.csv,text/csv')
    await user.upload(fileInput(container), new File([csv], 'registros.csv', { type: 'text/csv' }))

    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByText('registros.csv')).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText(/^Importado: 1 periodo/)).toBeInTheDocument()
    expect((await db.periods.toArray()).map((p) => p.startDate)).toEqual(['2026-09-01'])
    expect(await db.days.get('2026-09-02')).toMatchObject({ notes: 'Hola' })
  })

  it('cancelar la importación no cambia nada', async () => {
    await db.periods.add({ startDate: '2020-01-01', endDate: '2020-01-03' })
    const user = userEvent.setup()
    const { container } = render(<DataSection lastBackup={null} />)
    await user.upload(fileInput(container), new File(['fecha'], 'registros.csv', { type: 'text/csv' }))

    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    expect(await db.periods.count()).toBe(1)
  })

  it('un archivo que no es CSV no se importa', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const { container } = render(<DataSection lastBackup={null} />)
    await user.upload(fileInput(container), new File(['{}'], 'copia.json', { type: 'application/json' }))
    expect(await screen.findByText('No se pudo importar. Elige un archivo CSV exportado de Ciclita.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
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

})
