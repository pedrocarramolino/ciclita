import { describe, expect, it } from 'vitest'
import {
  AuthError,
  cronFor,
  deliver,
  localDate,
  register,
  scheduleId,
  unregister,
  type Deps,
} from './service.js'
import type { DeliverMessage, DeviceRecord, PushPayload, RegisterInput } from './types.js'
import { validateRegister, ValidationError } from './validate.js'

const ID = '0f8b7c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f'
const SECRET = 'a'.repeat(43)
const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p'.repeat(87), auth: 'x'.repeat(22) } }

function fakeDeps(now = '2026-10-27T08:00:00Z') {
  const records = new Map<string, DeviceRecord>()
  const schedules = new Map<string, { cron: string; message: DeliverMessage }>()
  const sent: PushPayload[] = []
  let gone = false
  const deps: Deps = {
    store: {
      get: async (id) => records.get(id) ?? null,
      set: async (id, r) => void records.set(id, r),
      del: async (id) => void records.delete(id),
    },
    scheduler: {
      upsert: async (id, cron, message) => void schedules.set(id, { cron, message }),
      remove: async (id) => void schedules.delete(id),
    },
    pusher: {
      send: async (_s, p) => {
        sent.push(p)
        return { gone }
      },
    },
    now: () => new Date(now),
  }
  return { deps, records, schedules, sent, setGone: (g: boolean) => (gone = g) }
}

const input = (reminders: RegisterInput['reminders']): RegisterInput => ({
  deviceId: ID,
  secret: SECRET,
  subscription: SUB,
  timezone: 'Europe/Madrid',
  reminders,
})

describe('utilidades', () => {
  it('genera el cron con zona horaria', () => {
    expect(cronFor('21:05', 'Europe/Madrid')).toBe('CRON_TZ=Europe/Madrid 5 21 * * *')
  })

  it('calcula la fecha local en la zona horaria', () => {
    // 23:30 UTC del 27 son las 00:30 del 28 en Madrid (horario de invierno: UTC+1).
    expect(localDate(new Date('2026-10-27T23:30:00Z'), 'Europe/Madrid')).toBe('2026-10-28')
  })
})

describe('register / unregister', () => {
  it('guarda el dispositivo sin el secreto en claro y programa solo los avisos activos', async () => {
    const f = fakeDeps()
    await register(f.deps, input({ daily: { time: '21:00', title: 'T', body: 'B' } }))
    const rec = f.records.get(ID)!
    expect(JSON.stringify(rec)).not.toContain(SECRET)
    expect([...f.schedules.keys()]).toEqual([scheduleId(ID, 'daily')])
    expect(f.schedules.get(scheduleId(ID, 'daily'))).toEqual({
      cron: 'CRON_TZ=Europe/Madrid 0 21 * * *',
      message: { deviceId: ID, kind: 'daily' },
    })
  })

  it('al desactivar un aviso borra su programación', async () => {
    const f = fakeDeps()
    await register(f.deps, input({ daily: { time: '21:00', title: 'T', body: 'B' }, pill: { time: '08:00', title: 'P', body: 'B' } }))
    await register(f.deps, input({ pill: { time: '08:00', title: 'P', body: 'B' } }))
    expect([...f.schedules.keys()]).toEqual([scheduleId(ID, 'pill')])
  })

  it('el aviso de periodo se comprueba a diario a las 9:00', async () => {
    const f = fakeDeps()
    await register(f.deps, input({ period: { title: 'T', from: '2026-10-27', until: '2026-10-29', bodies: ['0', '1', '2'] } }))
    expect(f.schedules.get(scheduleId(ID, 'period'))?.cron).toBe('CRON_TZ=Europe/Madrid 0 9 * * *')
  })

  it('rechaza actualizar un dispositivo con otro secreto', async () => {
    const f = fakeDeps()
    await register(f.deps, input({}))
    await expect(register(f.deps, { ...input({}), secret: 'b'.repeat(43) })).rejects.toThrow(AuthError)
    await expect(unregister(f.deps, ID, 'b'.repeat(43))).rejects.toThrow(AuthError)
  })

  it('unregister borra el dispositivo y todas sus programaciones', async () => {
    const f = fakeDeps()
    await register(f.deps, input({ daily: { time: '21:00', title: 'T', body: 'B' } }))
    await unregister(f.deps, ID, SECRET)
    expect(f.records.size).toBe(0)
    expect(f.schedules.size).toBe(0)
  })
})

describe('deliver', () => {
  it('envía el recordatorio diario con su texto', async () => {
    const f = fakeDeps()
    await register(f.deps, input({ daily: { time: '21:00', title: 'Registro', body: '¿Qué tal hoy?' } }))
    expect(await deliver(f.deps, { deviceId: ID, kind: 'daily' })).toBe('sent')
    expect(f.sent).toEqual([{ title: 'Registro', body: '¿Qué tal hoy?', tag: 'ciclo-daily', url: '/#/home' }])
  })

  it('aviso de periodo: solo dentro del intervalo, con el texto de los días que faltan y una vez', async () => {
    const period = { title: 'Periodo', from: '2026-10-27', until: '2026-10-29', bodies: ['hoy', 'mañana', 'en 2 días'] }
    const early = fakeDeps('2026-10-26T08:00:00Z')
    await register(early.deps, input({ period }))
    expect(await deliver(early.deps, { deviceId: ID, kind: 'period' })).toBe('skipped')

    const f = fakeDeps('2026-10-28T08:00:00Z')
    await register(f.deps, input({ period }))
    expect(await deliver(f.deps, { deviceId: ID, kind: 'period' })).toBe('sent')
    expect(f.sent[0].body).toBe('mañana')
    expect(await deliver(f.deps, { deviceId: ID, kind: 'period' })).toBe('skipped')
  })

  it('si la suscripción ya no existe, borra el dispositivo', async () => {
    const f = fakeDeps()
    await register(f.deps, input({ pill: { time: '08:00', title: 'P', body: 'B' } }))
    f.setGone(true)
    expect(await deliver(f.deps, { deviceId: ID, kind: 'pill' })).toBe('removed')
    expect(f.records.size).toBe(0)
    expect(f.schedules.size).toBe(0)
  })

  it('si el dispositivo no existe, limpia sus programaciones', async () => {
    const f = fakeDeps()
    f.schedules.set(scheduleId(ID, 'daily'), { cron: 'x', message: { deviceId: ID, kind: 'daily' } })
    expect(await deliver(f.deps, { deviceId: ID, kind: 'daily' })).toBe('removed')
    expect(f.schedules.size).toBe(0)
  })
})

describe('validateRegister', () => {
  const valid = { ...input({ daily: { time: '21:00', title: 'T', body: 'B' } }) }

  it('acepta un registro correcto', () => {
    expect(validateRegister(valid)).toEqual(valid)
  })

  it.each([
    ['deviceId', { ...valid, deviceId: '../../x' }],
    ['secret corto', { ...valid, secret: 'abc' }],
    ['endpoint http', { ...valid, subscription: { ...SUB, endpoint: 'http://evil.test/x' } }],
    ['zona horaria', { ...valid, timezone: 'Marte/Olympus' }],
    ['hora', { ...valid, reminders: { daily: { time: '25:00', title: 'T', body: 'B' } } }],
    ['texto largo', { ...valid, reminders: { pill: { time: '08:00', title: 'T', body: 'x'.repeat(500) } } }],
    ['periodo invertido', { ...valid, reminders: { period: { title: 'T', from: '2026-10-29', until: '2026-10-27', bodies: ['a'] } } }],
  ])('rechaza %s', (_name, body) => {
    expect(() => validateRegister(body)).toThrow(ValidationError)
  })
})
