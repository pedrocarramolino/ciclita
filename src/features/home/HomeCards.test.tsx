// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../../db/db'
import { getSettings, setSettings } from '../../db/settings'
import { addDays, today } from '../../domain/dates'
import { BackupNudgeCard } from './BackupNudgeCard'
import { PillCard } from './PillCard'

const pillOn = (start: string, pack: 21 | 24 | 28 = 21) =>
  setSettings({
    tracking: { temperature: false, mucus: false, sex: false, weight: false, pill: true },
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

describe('Aviso de copia de seguridad', () => {
  it('aparece tras un mes de datos sin copia y "Más tarde" lo oculta', async () => {
    await db.periods.add({ startDate: addDays(today(), -40), endDate: addDays(today(), -36) })
    const user = userEvent.setup()
    render(<BackupNudgeCard />)

    expect(await screen.findByRole('heading', { name: 'Haz una copia de seguridad' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Más tarde' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Haz una copia de seguridad' })).toBeNull())
    expect((await getSettings()).backupSnoozedOn).toBe(today())
  })

  it('no aparece con una copia reciente', async () => {
    await db.periods.add({ startDate: addDays(today(), -40), endDate: addDays(today(), -36) })
    await setSettings({ lastBackup: addDays(today(), -5) })
    const { container } = render(<BackupNudgeCard />)
    await new Promise((r) => setTimeout(r, 50))
    expect(container).toBeEmptyDOMElement()
  })
})
