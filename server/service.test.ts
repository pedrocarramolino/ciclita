import { createECDH, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { AuthError, deliver, isPillDay, QuotaError, register, unregister, type Deps } from './service.js'
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
        message: { deviceId: ID, kind: 'daily', version: 'v1', at: Date.parse('2026-10-27T20:00:00Z') },
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

  it('aviso de periodo: sigue con los periodos previstos siguientes sin volver a sincronizar', async () => {
    const period = {
      title: 'Periodo',
      from: '2026-10-27',
      until: '2026-10-28',
      bodies: ['hoy', 'mañana'],
      next: [
        { from: '2026-11-24', until: '2026-11-25' },
        { from: '2026-12-22', until: '2026-12-23' },
      ],
    }
    const f = fakeDeps('2026-10-25T20:00:00Z')
    await register(f.deps, input({ period }))
    const deliverAt = async (iso: string) => {
      f.setNow(iso)
      return deliver(f.deps, { deviceId: ID, kind: 'period', version: 'v1' })
    }

    expect(await deliverAt('2026-10-27T08:00:00Z')).toBe('sent') // primer periodo, faltan 1 día
    expect(await deliverAt('2026-10-28T08:00:00Z')).toBe('skipped') // ya avisado
    expect(await deliverAt('2026-11-10T08:00:00Z')).toBe('skipped') // entre periodos
    expect(await deliverAt('2026-11-25T08:00:00Z')).toBe('sent') // segundo periodo, hoy
    expect(f.sent.map((p) => p.body)).toEqual(['mañana', 'hoy'])
    expect(f.records.get(ID)?.periodSentFor).toBe('2026-11-25')

    // Tras el último previsto, la cadena se detiene.
    expect(await deliverAt('2026-12-23T08:00:00Z')).toBe('sent')
    const before = f.published.length
    expect(await deliverAt('2026-12-24T08:00:00Z')).toBe('skipped')
    expect(f.published.length).toBe(before)
  })

  it('el aviso de periodo lleva el botón "Ha empezado" si se envía su texto', async () => {
    const period = { title: 'Periodo', from: '2026-10-27', until: '2026-10-28', bodies: ['hoy', 'mañana'], startedAction: 'Ha empezado' }
    const f = fakeDeps('2026-10-25T20:00:00Z')
    await register(f.deps, input({ period }))
    f.setNow('2026-10-27T08:00:00Z')
    expect(await deliver(f.deps, { deviceId: ID, kind: 'period', version: 'v1' })).toBe('sent')
    expect(f.sent[0].actions).toEqual([{ action: 'period-started', title: 'Ha empezado' }])
  })

  it('valida los periodos siguientes', () => {
    const base = input({})
    const p = { title: 'T', from: '2026-10-27', until: '2026-10-28', bodies: ['a'] }
    const bad = (next: unknown) => () => validateRegister({ ...base, reminders: { period: { ...p, next } } })
    expect(bad([{ from: '2026-10-28', until: '2026-10-29' }])).toThrow(ValidationError) // se solapa
    expect(bad([{ from: '2026-11-25', until: '2026-11-24' }])).toThrow(ValidationError) // invertido
    expect(bad(Array.from({ length: 6 }, (_, i) => ({ from: `2027-0${i + 1}-01`, until: `2027-0${i + 1}-02` })))).toThrow(
      ValidationError,
    )
    expect(validateRegister({ ...base, reminders: { period: { ...p, next: [{ from: '2026-11-24', until: '2026-11-25' }] } } }).reminders.period?.next).toHaveLength(1)
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

describe('recordatorios con fecha', () => {
  const EVENTS = {
    events: [
      { date: '2026-10-28', time: '09:00', title: 'Ciclita', body: 'Retira el anillo' },
      { date: '2026-11-04', time: '09:00', title: 'Ciclita', body: 'Coloca un anillo nuevo' },
      { date: '2026-11-04', time: '09:00', title: 'Ciclita', body: 'Autoexploración' },
      { date: '2026-10-01', time: '09:00', title: 'Ciclita', body: 'Ya pasado' },
    ],
  }

  it('programa el más próximo que aún no ha pasado', async () => {
    const f = fakeDeps('2026-10-27T08:00:00Z')
    await register(f.deps, input(EVENTS))
    expect(f.published).toHaveLength(1)
    expect(f.published[0]).toMatchObject({ message: { kind: 'events' }, at: '2026-10-28T08:00:00.000Z' })
  })

  it('envía todos los de ese instante y encadena el siguiente', async () => {
    const f = fakeDeps('2026-10-27T08:00:00Z')
    await register(f.deps, input(EVENTS))

    f.setNow('2026-10-28T08:00:02Z')
    expect(await deliver(f.deps, f.published[0].message)).toBe('sent')
    expect(f.sent.map((p) => p.body)).toEqual(['Retira el anillo'])
    expect(f.published.at(-1)).toMatchObject({ at: '2026-11-04T08:00:00.000Z' })

    f.setNow('2026-11-04T08:00:01Z')
    expect(await deliver(f.deps, f.published.at(-1)!.message)).toBe('sent')
    expect(f.sent.map((p) => p.body)).toEqual(['Retira el anillo', 'Coloca un anillo nuevo', 'Autoexploración'])
    // Ya no queda ninguno: no se publica nada más.
    expect(f.records.get(ID)?.jobs.events?.messageId).toBeUndefined()
  })

  it('valida fechas, horas y número máximo', () => {
    const base = input({})
    expect(() => validateRegister({ ...base, reminders: { events: [{ date: '28/10', time: '09:00', title: 'T', body: 'B' }] } })).toThrow(ValidationError)
    expect(() => validateRegister({ ...base, reminders: { events: Array(31).fill(EVENTS.events[0]) } })).toThrow(ValidationError)
    expect(validateRegister({ ...base, reminders: EVENTS }).reminders.events).toHaveLength(4)
  })
})

describe('hábitos (temperatura, peso, medicación)', () => {
  const TEMP = { id: 'temperature', time: '07:00', title: 'Temperatura', body: 'Mide tu temperatura' }
  const WEIGHT = { id: 'weight', time: '07:00', title: 'Peso', body: 'Pésate', weekdays: [1] }
  const MED = { id: 'medication', time: '21:00', title: 'Vitaminas', body: 'Toma las vitaminas' }

  it('una sola cadena: programa el más próximo de todos', async () => {
    const f = fakeDeps('2026-10-27T08:00:00Z') // martes, 09:00 en Madrid
    await register(f.deps, input({ routines: [TEMP, WEIGHT, MED] }))
    expect(f.published).toHaveLength(1)
    expect(f.published[0]).toMatchObject({ message: { kind: 'routines' }, at: '2026-10-27T20:00:00.000Z' })
  })

  it('los semanales solo suenan su día de la semana', async () => {
    const f = fakeDeps('2026-10-27T08:00:00Z')
    await register(f.deps, input({ routines: [WEIGHT] }))
    expect(f.published[0].at).toBe('2026-11-02T06:00:00.000Z') // lunes a las 07:00
  })

  it('envía los que coinciden en ese instante y encadena el siguiente', async () => {
    const f = fakeDeps('2026-11-01T22:00:00Z') // domingo, 23:00 en Madrid
    await register(f.deps, input({ routines: [TEMP, WEIGHT, MED] }))
    expect(f.published[0].at).toBe('2026-11-02T06:00:00.000Z')

    f.setNow('2026-11-02T06:00:01Z')
    expect(await deliver(f.deps, f.published[0].message)).toBe('sent')
    expect(f.sent.map((p) => [p.body, p.tag])).toEqual([
      ['Mide tu temperatura', 'ciclita-routine-temperature'],
      ['Pésate', 'ciclita-routine-weight'],
    ])
    expect(f.published.at(-1)?.at).toBe('2026-11-02T20:00:00.000Z')

    f.setNow('2026-11-02T20:00:00Z')
    await deliver(f.deps, f.published.at(-1)!.message)
    expect(f.sent.at(-1)?.body).toBe('Toma las vitaminas')
    // Martes: solo la temperatura (el peso es de los lunes).
    expect(f.published.at(-1)?.at).toBe('2026-11-03T06:00:00.000Z')
    f.setNow('2026-11-03T06:00:00Z')
    await deliver(f.deps, f.published.at(-1)!.message)
    expect(f.sent.at(-1)?.body).toBe('Mide tu temperatura')
    expect(f.sent).toHaveLength(4)
  })

  it('valida identificadores, días de la semana y número máximo', () => {
    const base = input({})
    const bad = (routines: unknown) => () => validateRegister({ ...base, reminders: { routines } })
    expect(bad([{ ...TEMP, id: 'Con espacios' }])).toThrow(ValidationError)
    expect(bad([TEMP, TEMP])).toThrow(ValidationError)
    expect(bad([{ ...WEIGHT, weekdays: [7] }])).toThrow(ValidationError)
    expect(bad([{ ...WEIGHT, weekdays: [] }])).toThrow(ValidationError)
    expect(bad(Array.from({ length: 7 }, (_, i) => ({ ...TEMP, id: `r${i}` })))).toThrow(ValidationError)
    expect(validateRegister({ ...base, reminders: { routines: [TEMP, WEIGHT] } }).reminders.routines).toEqual([TEMP, WEIGHT])
  })
})

describe('píldora con días de descanso', () => {
  // Envase 21 + 7 que empezó el 1 de octubre: descanso del 22 al 28 de octubre.
  const PILL = { pill: { time: '22:00', title: 'Píldora', body: 'Tómala', pack: { active: 21, start: '2026-10-01' } } }

  it('isPillDay sigue los ciclos de 28 días', () => {
    const pack = { active: 21, start: '2026-10-01' }
    expect(isPillDay('2026-10-21', pack)).toBe(true)
    expect(isPillDay('2026-10-22', pack)).toBe(false)
    expect(isPillDay('2026-10-28', pack)).toBe(false)
    expect(isPillDay('2026-10-29', pack)).toBe(true)
    expect(isPillDay('2026-09-30', pack)).toBe(false) // antes del inicio: día 28 del envase anterior
  })

  it('al programar se salta la semana de descanso', async () => {
    const f = fakeDeps('2026-10-21T21:00:00Z') // 21 oct, 23:00 en Madrid: ya pasó la de hoy
    await register(f.deps, input(PILL))
    // 29 oct a las 22:00 en Madrid (ya en horario de invierno, UTC+1).
    expect(f.published[0]).toMatchObject({ message: { kind: 'pill' }, at: '2026-10-29T21:00:00.000Z' })
  })

  it('el último día activo envía y encadena el primero del envase siguiente', async () => {
    const f = fakeDeps('2026-10-20T21:00:00Z')
    await register(f.deps, input(PILL))
    expect(f.published[0].at).toBe('2026-10-21T20:00:00.000Z')
    f.setNow('2026-10-21T20:00:01Z')
    expect(await deliver(f.deps, f.published[0].message)).toBe('sent')
    expect(f.published.at(-1)?.at).toBe('2026-10-29T21:00:00.000Z')
  })

  it('un mensaje que cae en descanso no avisa', async () => {
    const f = fakeDeps('2026-10-20T21:00:00Z')
    await register(f.deps, input(PILL))
    f.setNow('2026-10-23T20:00:01Z')
    expect(await deliver(f.deps, f.published[0].message)).toBe('skipped')
    expect(f.sent).toEqual([])
  })

  it('si se registran las tomas, el aviso lleva el botón "Ya la he tomado"', async () => {
    const f = fakeDeps('2026-10-20T21:00:00Z')
    await register(f.deps, input({ pill: { ...PILL.pill, takenAction: 'Ya la he tomado' } }))
    f.setNow('2026-10-21T20:00:01Z')
    expect(await deliver(f.deps, f.published[0].message)).toBe('sent')
    expect(f.sent[0].actions).toEqual([{ action: 'pill-taken', title: 'Ya la he tomado' }])
    // Sin texto de botón, sin botones.
    const g = fakeDeps('2026-10-20T21:00:00Z')
    await register(g.deps, input(PILL))
    g.setNow('2026-10-21T20:00:01Z')
    await deliver(g.deps, g.published[0].message)
    expect(g.sent[0].actions).toBeUndefined()
  })

  it('valida el envase', () => {
    const base = input({})
    const bad = (pack: unknown) => () => validateRegister({ ...base, reminders: { pill: { ...PILL.pill, pack } } })
    expect(bad({ active: 0, start: '2026-10-01' })).toThrow(ValidationError)
    expect(bad({ active: 21, start: '1/10/2026' })).toThrow(ValidationError)
    expect(validateRegister({ ...base, reminders: PILL }).reminders.pill?.pack).toEqual(PILL.pill.pack)
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
