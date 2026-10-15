// @vitest-environment jsdom
import './test/ui'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { db } from './db/db'
import { setSettings } from './db/settings'
import { addDays, today } from './domain/dates'
import { hashPin } from './security/pin'
import { axeViolations } from './test/axe'
import { AuthScreen } from './features/auth/AuthScreen'

// Sin service worker en jsdom.
vi.mock('./components/UpdatePrompt', () => ({ UpdatePrompt: () => null }))

const T = today()

/** Datos de ejemplo para que cada pantalla muestre todo lo posible. */
async function seed() {
  const starts = [-120, -92, -63, -35, -7].map((n) => addDays(T, n))
  await db.periods.bulkAdd(starts.map((s) => ({ startDate: s, endDate: addDays(s, 4) })))
  for (const s of starts) {
    await db.days.bulkPut([
      { date: s, flow: 'heavy', pain: 7, symptoms: ['Dolor abdominal'], notes: 'Nota', updatedAt: 1 },
      { date: addDays(s, -1), symptoms: ['Hinchazón'], temperature: 36.8, pillTaken: true, updatedAt: 1 },
      { date: addDays(s, 10), temperature: 36.4, mood: 'calm', updatedAt: 1 },
    ])
  }
  await setSettings({
    onboardingDone: true,
    tracking: { temperature: true, mucus: true, sex: true, weight: true, pill: true },
    pill: { pack: 21, start: addDays(T, -3) },
  })
}

async function expectNoViolations() {
  expect(await axeViolations()).toEqual([])
}

describe('accesibilidad (axe)', () => {
  beforeEach(() => {
    location.hash = ''
  })

  it('control: axe detecta los errores típicos', async () => {
    render(
      <main>
        <button type="button">
          <svg />
        </button>
        <input type="text" />
      </main>,
    )
    const v = await axeViolations()
    expect(v.some((x) => x.startsWith('button-name'))).toBe(true)
    expect(v.some((x) => x.startsWith('label'))).toBe(true)
  })

  it('registro (con errores), inicio de sesión, recuperar contraseña y política de privacidad', async () => {
    const user = userEvent.setup()
    render(<AuthScreen hasLocalData />)
    await expectNoViolations()
    await user.click(screen.getByRole('button', { name: 'Regístrate' }))
    await expectNoViolations()
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))
    await expectNoViolations()
    await user.click(screen.getByRole('button', { name: 'Inicia sesión' }))
    await user.click(screen.getByRole('button', { name: '¿Has olvidado tu contraseña?' }))
    await expectNoViolations()
    await user.click(screen.getByRole('button', { name: 'Volver' }))
    await user.click(screen.getByRole('button', { name: 'Política de privacidad' }))
    await expectNoViolations()
  })

  it('bienvenida: todos los pasos', async () => {
    const user = userEvent.setup()
    render(<App encrypted={false} />)
    await screen.findByRole('button', { name: 'Empezar' })
    await expectNoViolations()
    await user.click(screen.getByRole('button', { name: 'Empezar' }))
    await screen.findByRole('radio', { name: /Embarazo/ })
    await expectNoViolations()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByLabelText('Fecha de inicio')
    await expectNoViolations()
    await user.click(screen.getByRole('button', { name: 'Continuar' }))
    await screen.findByRole('button', { name: 'Listo' })
    await expectNoViolations()
  })

  it('pantalla de bloqueo', async () => {
    await setSettings({ onboardingDone: true, pinHash: await hashPin('1234', 1000) })
    render(<App encrypted={false} />)
    await screen.findByRole('heading', { name: 'Introduce tu PIN' })
    await expectNoViolations()
  })

  it.each([
    ['inicio', '#/home', 'Píldora de hoy'],
    ['calendario', '#/calendar', 'Toca un día para registrar cómo te sientes.'],
    ['estadísticas', '#/stats', 'Temperatura basal'],
    ['informe', '#/report', 'Informe para tu médico'],
    ['ajustes', '#/settings', 'Tus datos'],
    ['ajustes · tu ciclo', '#/settings/cycle', 'Modo de la app'],
    ['ajustes · qué registras', '#/settings/tracking', 'Píldora anticonceptiva'],
    ['ajustes · recordatorios', '#/settings/reminders', 'Recordatorios'],
    ['ajustes · seguridad', '#/settings/security', 'Bloqueo con PIN'],
    ['ajustes · exportar e importar', '#/settings/backup', 'Exportar copia completa (JSON)'],
    ['ajustes · apariencia', '#/settings/appearance', 'Tema'],
    ['ajustes · tu cuenta', '#/settings/account', 'Cerrar sesión'],
    ['buscar', '#/search', 'Buscar'],
  ])('%s', async (_name, hash, text) => {
    await seed()
    location.hash = hash
    render(<App encrypted={false} />)
    expect((await screen.findAllByText(text, {}, { timeout: 3000 })).length).toBeGreaterThan(0)
    await expectNoViolations()
  })

  it('registro del día con todos los campos', async () => {
    await seed()
    const user = userEvent.setup()
    render(<App encrypted={false} />)
    await user.click(await screen.findByRole('button', { name: 'Registrar hoy' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByLabelText('Temperatura basal')
    await expectNoViolations()
  })

  it('resultados de búsqueda', async () => {
    await seed()
    location.hash = '#/search'
    const user = userEvent.setup()
    render(<App encrypted={false} />)
    await user.type(await screen.findByRole('searchbox'), 'dolor')
    await screen.findByText(/días$/)
    await expectNoViolations()
  })

  it('diálogos de ajustes: copia cifrada y borrar datos', async () => {
    await seed()
    location.hash = '#/settings/backup'
    const user = userEvent.setup()
    render(<App encrypted={false} />)
    await user.click(await screen.findByRole('button', { name: 'Exportar copia cifrada con contraseña' }))
    await screen.findByRole('dialog')
    await expectNoViolations()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    location.hash = '#/settings/account'
    await user.click(await screen.findByRole('button', { name: 'Borrar todos mis datos' }))
    await screen.findByRole('dialog')
    await expectNoViolations()
  })
})
