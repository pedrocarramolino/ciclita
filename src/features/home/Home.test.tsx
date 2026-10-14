// @vitest-environment jsdom
import '../../test/ui'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { db } from '../../db/db'
import { getSettings, setSettings } from '../../db/settings'
import { addDays, today } from '../../domain/dates'
import { Home } from './Home'

const T = today()

describe('Inicio: avisos de periodo', () => {
  it('pregunta si ha terminado un periodo que dura más de lo habitual y lo cierra ayer', async () => {
    await db.periods.add({ startDate: addDays(T, -8), endDate: null }) // 9 días en curso
    const user = userEvent.setup()
    render(<Home />)

    const card = within((await screen.findByRole('heading', { name: '¿Ha terminado tu periodo?' })).closest('section')!)
    expect(card.getByText('Lleva 9 días marcado como en curso.')).toBeInTheDocument()
    await user.click(card.getByRole('button', { name: 'Sí, terminó ayer' }))

    await waitFor(async () => expect((await db.periods.toArray())[0].endDate).toBe(addDays(T, -1)))
    expect(await screen.findByText('Has marcado el final de tu periodo.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(async () => expect((await db.periods.toArray())[0].endDate).toBeNull())
  })

  it('"Todavía no" lo pospone 2 días', async () => {
    await db.periods.add({ startDate: addDays(T, -8), endDate: null })
    const user = userEvent.setup()
    render(<Home />)
    await user.click(await screen.findByRole('button', { name: 'Todavía no' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: '¿Ha terminado tu periodo?' })).toBeNull())
    expect((await getSettings()).periodEndSnooze).toEqual({ start: addDays(T, -8), until: addDays(T, 2) })
  })

  it('pregunta por un periodo olvidado y "No, fue un ciclo largo" lo confirma', async () => {
    // Ciclos de 28, 29, 56 (periodo olvidado) y 28 días.
    const starts = [-141, -113, -84, -28, 0].map((n) => addDays(T, n))
    await db.periods.bulkAdd(starts.map((s) => ({ startDate: s, endDate: s === T ? null : addDays(s, 4) })))
    const user = userEvent.setup()
    render(<Home />)

    const card = within((await screen.findByRole('heading', { name: '¿Se te olvidó registrar un periodo?' })).closest('section')!)
    expect(card.getByText(/pasaron 56 días sin periodo/)).toBeInTheDocument()
    await user.click(card.getByRole('button', { name: 'No, fue un ciclo largo' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: '¿Se te olvidó registrar un periodo?' })).toBeNull())
    expect((await getSettings()).confirmedLongCycles).toEqual([starts[2]])
  })
})

describe('Inicio: retraso largo', () => {
  it('con más de una semana de retraso sugiere un test y permite pasar a modo embarazo', async () => {
    // Ciclos de 28 días; el último periodo empezó hace 40: 12 días de retraso.
    await db.periods.bulkAdd([
      { startDate: addDays(T, -68), endDate: addDays(T, -64) },
      { startDate: addDays(T, -40), endDate: addDays(T, -36) },
    ])
    const user = userEvent.setup()
    render(<Home />)

    expect(await screen.findByText(/un test puede salir de dudas/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pasar a modo embarazo' }))
    await waitFor(async () => expect((await getSettings()).mode).toBe('pregnancy'))
    expect((await getSettings()).pregnancyStart).toBe(addDays(T, -40))

    await user.click(await screen.findByRole('button', { name: 'Deshacer' }))
    await waitFor(async () => expect((await getSettings()).mode).toBe('cycle'))
  })

  it('con pocos días de retraso no lo sugiere', async () => {
    await db.periods.bulkAdd([
      { startDate: addDays(T, -59), endDate: addDays(T, -55) },
      { startDate: addDays(T, -31), endDate: addDays(T, -27) },
    ])
    render(<Home />)
    expect(await screen.findByText(/Tu periodo se retrasa 3 días/)).toBeInTheDocument()
    expect(screen.queryByText(/un test puede salir de dudas/)).toBeNull()
  })
})

describe('Inicio: acciones desde fuera', () => {
  it('#/pill-taken (botón de la notificación) marca la píldora de hoy y se puede deshacer', async () => {
    await setSettings({ onboardingDone: true })
    location.hash = '#/pill-taken'
    const user = userEvent.setup()
    render(<Home />)

    expect(await screen.findByText('Píldora de hoy marcada como tomada.')).toBeInTheDocument()
    expect(await db.days.get(T)).toMatchObject({ pillTaken: true })
    expect(location.hash).toBe('#/home')
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(async () => expect(await db.days.get(T)).toBeUndefined())
  })

  it('#/log abre el registro de hoy también con la app ya abierta', async () => {
    render(<Home />)
    await screen.findByRole('button', { name: 'Registrar hoy' })
    location.hash = '#/log'
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
