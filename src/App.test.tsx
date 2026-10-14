// @vitest-environment jsdom
import './test/ui'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { db } from './db/db'
import { getSettings } from './db/settings'
import { addDays, today } from './domain/dates'

// El aviso de actualización depende del service worker de la PWA, que no hay en jsdom.
vi.mock('./components/UpdatePrompt', () => ({ UpdatePrompt: () => null }))

describe('App', () => {
  it('bienvenida → inicio → "Ha empezado mi periodo" → calendario', async () => {
    const user = userEvent.setup()
    render(<App encrypted={false} />)

    // Paso 1: bienvenida.
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    // Paso 2: modo (ciclo menstrual, el marcado por defecto).
    expect(await screen.findByRole('radio', { name: /Ciclo menstrual/ })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    // Paso 3: último periodo, hace 10 días.
    fireEvent.change(await screen.findByLabelText('Fecha de inicio'), { target: { value: addDays(today(), -10) } })
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    // Paso 4: duraciones por defecto.
    await user.click(await screen.findByRole('button', { name: 'Listo' }))

    expect(await screen.findByText('Día 11 de tu ciclo')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu periodo empieza en 18 días')
    expect((await getSettings()).onboardingDone).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Ha empezado mi periodo' }))
    expect(await screen.findByRole('heading', { name: 'Día 1 de tu periodo' })).toBeInTheDocument()
    expect(await db.periods.where('startDate').equals(today()).count()).toBe(1)

    // Deshacer devuelve los periodos a como estaban.
    expect(screen.getByRole('status')).toHaveTextContent('Has marcado el inicio de tu periodo.')
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(await screen.findByRole('heading', { name: 'Tu periodo empieza en 18 días' })).toBeInTheDocument()
    expect(await db.periods.where('startDate').equals(today()).count()).toBe(0)

    const nav = within(screen.getByRole('navigation', { name: 'Navegación principal' }))
    await user.click(nav.getByRole('link', { name: 'Calendario' }))
    expect(await screen.findByRole('button', { name: 'Mes anterior' })).toBeInTheDocument()
    expect(nav.getByRole('link', { name: 'Calendario' })).toHaveAttribute('aria-current', 'page')
  })

  it('con PIN pide desbloquear antes de mostrar los datos', async () => {
    const { hashPin } = await import('./security/pin')
    const { setSettings } = await import('./db/settings')
    await setSettings({ onboardingDone: true, pinHash: await hashPin('1357', 1000) })
    const user = userEvent.setup()
    render(<App encrypted={false} />)

    expect(await screen.findByRole('heading', { name: 'Introduce tu PIN' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).toBeNull()
    for (const d of '1357') await user.click(screen.getByRole('button', { name: `Dígito ${d}` }))
    expect(await screen.findByRole('navigation', { name: 'Navegación principal' })).toBeInTheDocument()
  })

  it('al retomar la app otro día, "hoy" se actualiza', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date(2026, 9, 14, 23, 50))
      const { setSettings } = await import('./db/settings')
      await setSettings({ onboardingDone: true })
      await db.periods.add({ startDate: '2026-10-01', endDate: '2026-10-05' })
      render(<App encrypted={false} />)
      expect(await screen.findByText('Día 14 de tu ciclo')).toBeInTheDocument()

      // La app pasa la noche en segundo plano y se vuelve a abrir.
      vi.setSystemTime(new Date(2026, 9, 15, 8, 0))
      document.dispatchEvent(new Event('visibilitychange'))
      expect(await screen.findByText('Día 15 de tu ciclo')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('desde la bienvenida se puede importar una copia y pasar directo al inicio', async () => {
    // Copia hecha en otro móvil.
    const { exportJSON } = await import('./db/data')
    await db.periods.add({ startDate: addDays(today(), -10), endDate: addDays(today(), -6) })
    const json = await exportJSON()
    await db.periods.clear()

    const user = userEvent.setup()
    const { container } = render(<App encrypted={false} />)
    await user.click(await screen.findByRole('button', { name: '¿Ya usabas Ciclita? Importar una copia' }))
    await user.upload(container.querySelector<HTMLInputElement>('input[type="file"]')!, new File([json], 'copia.json'))

    expect(await screen.findByText('Día 11 de tu ciclo', {}, { timeout: 3000 })).toBeInTheDocument()
    expect((await getSettings()).onboardingDone).toBe(true)
  })

  it('bienvenida en modo embarazo: sin duraciones, con las semanas desde la última regla', async () => {
    const user = userEvent.setup()
    render(<App encrypted={false} />)
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    await user.click(await screen.findByRole('radio', { name: /Embarazo/ }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByRole('heading', { name: '¿Cuándo empezó tu última regla?' })).toBeInTheDocument()
    expect(screen.getByText('Paso 3 de 3')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: addDays(today(), -70) } })
    await user.click(screen.getByRole('button', { name: 'Listo' }))

    expect(await screen.findByText(/10 semanas de embarazo/)).toBeInTheDocument()
    expect(await getSettings()).toMatchObject({ mode: 'pregnancy', pregnancyStart: addDays(today(), -70), cycleLength: null })
  })

  it('bienvenida en modo perimenopausia: sin duraciones', async () => {
    const user = userEvent.setup()
    render(<App encrypted={false} />)
    await user.click(await screen.findByRole('button', { name: 'Empezar' }))
    await user.click(await screen.findByRole('radio', { name: /Perimenopausia/ }))
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    fireEvent.change(await screen.findByLabelText('Fecha de inicio'), { target: { value: addDays(today(), -50) } })
    await user.click(screen.getByRole('button', { name: 'Listo' }))

    expect(await screen.findByText(/50 días desde tu último periodo/)).toBeInTheDocument()
    expect((await getSettings()).mode).toBe('perimenopause')
  })
})
