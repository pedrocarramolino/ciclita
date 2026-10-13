import { createECDH, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { AuthError, deliver, QuotaError, register, unregister, type Deps } from './service.js'
import type { DeliverMessage, DeviceRecord, PushPayload, RegisterInput } from './types.js'
import { isPushServiceUrl, validateRegister, ValidationError } from './validate.js'

const ID = '0f8b7c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f'
const SECRET = 'a'.repeat(43)
// Claves válidas generadas para los tests (P-256 + 16 bytes de auth).
const ecdh = createECDH('prime256v1')
ecdh.generateKeys()
const SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') },
}

interface Published {
  id: string
  message: DeliverMessage
  at: string
  dedupId: string
}

function fakeDeps(nowISO = '2026-10-27T08:00:00Z') {
  const records = new Map<string, DeviceRecord>()
  const published: Published[] = []
  const cancelled: string[] = []
  const sent: PushPayload[] = []
  let gone = false
  let now = new Date(nowISO)
  let v = 0
  const deps: Deps = {
    store: {
      get: async (id) => structuredClone(records.get(id) ?? null),
      set: async (id, r) => void records.set(id, structuredClone(r)),
      del: async (id) => void records.delete(id),
    },
    scheduler: {
      publishAt: async (message, at, dedupId) => {
        const id = `msg-${published.length + 1}`
        published.push({ id, message, at: at.toISOString(), dedupId })
        return id
      },
      cancel: async (id) => void cancelled.push(id),
    },
    pusher: {
      send: async (_s, p) => {
        sent.push(p)
        return { gone }
      },
    },
    now: () => now,
    newVersion: () => `v${++v}`,
  }
  return {
    deps,
    records,
    published,
    cancelled,
    sent,
    setGone: (g: boolean) => (gone = g),
    setNow: (iso: string) => (now = new Date(iso)),
  }
}

const input = (reminders: RegisterInput['reminders']): RegisterInput => ({
  deviceId: ID,
  secret: SECRET,
  subscription: SUB,
  timezone: 'Europe/Madrid',
  reminders,
})

const DAILY = { daily: { time: '21:00', title: 'Registro', body: '¿Qué tal hoy?' } }

describe('register / unregister', () => {
  it('guarda el dispositivo sin el secreto en claro y publica un mensaje por recordatorio activo', async () => {
    const f = fakeDeps('2026-10-27T08:00:00Z') // 09:00 en Madrid
    await register(f.deps, input(DAILY))
    expect(JSON.stringify(f.records.get(ID))).not.toContain(SECRET)
    expect(f.published).toEqual([
      {
        id: 'msg-1',
        message: { deviceId: ID, kind: 'daily', version: 'v1' },
        at: '2026-10-27T20:00:00.000Z', // 21:00 en Madrid (UTC+1)
        dedupId: expect.stringContaining('v1'),
      },
    ])
    expect(f.records.get(ID)?.jobs).toEqual({ daily: { version: 'v1', messageId: 'msg-1' } })
  })

  it('el aviso de periodo se comprueba a las 9:00 locales', async () => {
    const f = fakeDeps('2026-10-27T10:00:00Z') // ya pasaron las 9:00 → mañana
    await register(f.deps, input({ period: { title: 'T', from: '2026-10-27', until: '2026-10-29', bodies: ['0', '1', '2'] } }))
    expect(f.published[0].at).toBe('2026-10-28T08:00:00.000Z')
  })

  it('al volver a registrar cambia la versión y cancela los mensajes anteriores', async () => {
    const f = fakeDeps()
    await register(f.deps, input(DAILY))
    await register(f.deps, input({ pill: { time: '08:00', title: 'P', body: 'B' } }))
    expect(f.cancelled).toEqual(['msg-1'])
    expect(f.records.get(ID)?.jobs).toEqual({ pill: { version: 'v2', messageId: 'msg-2' } })
  })

  it('respeta el cupo global de dispositivos nuevos, pero no afecta a los ya registrados', async () => {
    const f = fakeDeps()
    await register(f.deps, input(DAILY))
    f.deps.allowNewDevice = async () => false
    await register(f.deps, input(DAILY)) // existente: se puede actualizar
    await expect(
      register(f.deps, { ...input(DAILY), deviceId: '9f8b7c1e-2d3a-4b5c-8d9e-0a1b2c3d4e5f' }),
    ).rejects.toThrow(QuotaError)
  })

  it('rechaza actualizar o borrar un dispositivo con otro secreto', async () => {
    const f = fakeDeps()
    await register(f.deps, input({}))
    await expect(register(f.deps, { ...input({}), secret: 'b'.repeat(43) })).rejects.toThrow(AuthError)
    await expect(unregister(f.deps, ID, 'b'.repeat(43))).rejects.toThrow(AuthError)
  })

  it('unregister borra el dispositivo y cancela sus mensajes', async () => {
    const f = fakeDeps()
    await register(f.deps, input(DAILY))
    await unregister(f.deps, ID, SECRET)
    expect(f.records.size).toBe(0)
    expect(f.cancelled).toEqual(['msg-1'])
  })
})

describe('deliver', () => {
  it('envía el recordatorio diario y programa el del día siguiente', async () => {
    const f = fakeDeps()
    await register(f.deps, input(DAILY))
    f.setNow('2026-10-27T20:00:05Z')
    expect(await deliver(f.deps, { deviceId: ID, kind: 'daily', version: 'v1' })).toBe('sent')
    expect(f.sent).toEqual([{ title: 'Registro', body: '¿Qué tal hoy?', tag: 'ciclita-daily', url: '/#/home' }])
    expect(f.published.at(-1)).toMatchObject({ message: { version: 'v1' }, at: '2026-10-28T20:00:00.000Z' })
    expect(f.records.get(ID)?.jobs.daily?.messageId).toBe('msg-2')
  })

  it('ignora mensajes de una versión anterior', async () => {
    const f = fakeDeps()
    await register(f.deps, input(DAILY))
    await register(f.deps, input(DAILY)) // v2
    expect(await deliver(f.deps, { deviceId: ID, kind: 'daily', version: 'v1' })).toBe('stale')
    expect(f.sent).toEqual([])
  })

  it('aviso de periodo: solo dentro del intervalo, con el texto de los días que faltan y una vez', async () => {
    const period = { title: 'Periodo', from: '2026-10-27', until: '2026-10-29', bodies: ['hoy', 'mañana', 'en 2 días'] }
    const f = fakeDeps('2026-10-25T20:00:00Z')
    await register(f.deps, input({ period }))

    f.setNow('2026-10-26T08:00:00Z') // antes del intervalo
    expect(await deliver(f.deps, { deviceId: ID, kind: 'period', version: 'v1' })).toBe('skipped')

    f.setNow('2026-10-28T08:00:00Z') // faltan 1 día
    expect(await deliver(f.deps, { deviceId: ID, kind: 'period', version: 'v1' })).toBe('sent')
    expect(f.sent.at(-1)?.body).toBe('mañana')

    f.setNow('2026-10-29T08:00:00Z') // ya avisado: no repite y la cadena termina
    const before = f.published.length
    expect(await deliver(f.deps, { deviceId: ID, kind: 'period', version: 'v1' })).toBe('skipped')
    expect(f.published.length).toBe(before)
  })

  it('si la suscripción ya no existe, borra el dispositivo y cancela lo programado', async () => {
    const f = fakeDeps()
    await register(f.deps, input({ pill: { time: '08:00', title: 'P', body: 'B' } }))
    f.setGone(true)
    expect(await deliver(f.deps, { deviceId: ID, kind: 'pill', version: 'v1' })).toBe('removed')
    expect(f.records.size).toBe(0)
    expect(f.cancelled).toContain('msg-2')
  })

  it('si el dispositivo no existe, no hace nada', async () => {
    const f = fakeDeps()
    expect(await deliver(f.deps, { deviceId: ID, kind: 'daily', version: 'v1' })).toBe('removed')
    expect(f.published).toEqual([])
  })
})

describe('validateRegister', () => {
  const valid = { ...input(DAILY) }

  it('acepta un registro correcto', () => {
    expect(validateRegister(valid)).toEqual(valid)
  })

  it.each([
    ['deviceId', { ...valid, deviceId: '../../x' }],
    ['secret corto', { ...valid, secret: 'abc' }],
    ['endpoint http', { ...valid, subscription: { ...SUB, endpoint: 'http://evil.test/x' } }],
    ['endpoint fuera de los servicios push', { ...valid, subscription: { ...SUB, endpoint: 'https://evil.test/x' } }],
    ['dominio que imita uno push', { ...valid, subscription: { ...SUB, endpoint: 'https://fcm.googleapis.com.evil.test/x' } }],
    ['endpoint con puerto o usuario', { ...valid, subscription: { ...SUB, endpoint: 'https://u@fcm.googleapis.com:444/x' } }],
    ['clave p256dh inventada', { ...valid, subscription: { ...SUB, keys: { ...SUB.keys, p256dh: 'B' + 'x'.repeat(86) } } }],
    ['auth de longitud incorrecta', { ...valid, subscription: { ...SUB, keys: { ...SUB.keys, auth: 'y'.repeat(10) } } }],
    ['zona horaria', { ...valid, timezone: 'Marte/Olympus' }],
    ['hora', { ...valid, reminders: { daily: { time: '25:00', title: 'T', body: 'B' } } }],
    ['texto largo', { ...valid, reminders: { pill: { time: '08:00', title: 'T', body: 'x'.repeat(500) } } }],
    ['periodo invertido', { ...valid, reminders: { period: { title: 'T', from: '2026-10-29', until: '2026-10-27', bodies: ['a'] } } }],
  ])('rechaza %s', (_name, body) => {
    expect(() => validateRegister(body)).toThrow(ValidationError)
  })
})

describe('isPushServiceUrl', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ])('acepta %s', (u) => {
    expect(isPushServiceUrl(new URL(u))).toBe(true)
  })
})
