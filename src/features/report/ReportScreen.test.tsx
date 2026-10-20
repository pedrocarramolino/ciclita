// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/db'
import { setSettings } from '../../db/settings'
import { addDays, today } from '../../domain/dates'
import { ReportScreen } from './ReportScreen'

let downloads: File[] = []

beforeEach(async () => {
  downloads = []
  URL.revokeObjectURL = vi.fn()
  URL.createObjectURL = vi.fn((f: Blob) => {
    downloads.push(f as File)
    return 'blob:prueba'
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

  const starts = [-90, -61, -33, -5].map((n) => addDays(today(), n))
  await db.periods.bulkAdd(starts.map((s) => ({ startDate: s, endDate: addDays(s, 4) })))
  await db.days.bulkPut([
    { date: starts[2], flow: 'heavy', pain: 8, symptoms: ['Migraña'], notes: 'Nota privada', updatedAt: 1 },
    { date: addDays(today(), -1), pillTaken: true, updatedAt: 1 },
  ])
})

describe('Informe para tu médico', () => {
  it('muestra el resumen y genera el PDF para descargar', async () => {
    const user = userEvent.setup()
    render(<ReportScreen />)

    expect(await screen.findByText('Ciclos completos registrados')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Migraña' })).toBeInTheDocument()
    // Sin pedirlo, las notas no se incluyen.
    expect(screen.queryByText('Nota privada')).toBeNull()

    const download = screen.getByRole('button', { name: 'Descargar PDF' })
    await waitFor(() => expect(download).toBeEnabled(), { timeout: 5000 })
    await user.click(download)

    await waitFor(() => expect(downloads).toHaveLength(1))
    expect(downloads[0].name).toBe(`ciclita-informe-${today()}.pdf`)
    expect(downloads[0].type).toBe('application/pdf')
  })

  it('incluye las notas si se pide y la sección de la píldora si se registra', async () => {
    await setSettings({
      tracking: { temperature: false, mucus: false, sex: false, weight: false, pill: true, tests: false, bloodPressure: false },
      pill: { pack: 28, start: addDays(today(), -3) },
    })
    const user = userEvent.setup()
    render(<ReportScreen />)

    await user.click(await screen.findByRole('switch', { name: 'Incluir mis notas' }))
    expect(await screen.findByText('Nota privada')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Píldora anticonceptiva' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '1 de 3' })).toBeInTheDocument()
  })
})
