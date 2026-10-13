import { afterEach, describe, expect, it } from 'vitest'
import { getEnv } from './env.js'

const BASE = {
  QSTASH_TOKEN: 't',
  QSTASH_CURRENT_SIGNING_KEY: 'c',
  QSTASH_NEXT_SIGNING_KEY: 'n',
  VAPID_PUBLIC_KEY: 'pub',
  VAPID_PRIVATE_KEY: 'priv',
  VAPID_SUBJECT: 'https://ciclita.vercel.app',
  APP_URL: 'https://ciclita.vercel.app/',
}
const KEYS = [...Object.keys(BASE), 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN']
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]))

function setEnv(vars: Record<string, string>) {
  for (const k of KEYS) delete process.env[k]
  Object.assign(process.env, vars)
}
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('getEnv', () => {
  it('acepta los nombres de Redis de la consola de Upstash', () => {
    setEnv({ ...BASE, UPSTASH_REDIS_REST_URL: 'https://a.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'x' })
    expect(getEnv()).toMatchObject({ UPSTASH_REDIS_REST_URL: 'https://a.upstash.io', APP_URL: 'https://ciclita.vercel.app' })
  })

  it('acepta los nombres KV_* de la integración de Vercel', () => {
    setEnv({ ...BASE, KV_REST_API_URL: 'https://b.upstash.io', KV_REST_API_TOKEN: 'y' })
    expect(getEnv()).toMatchObject({ UPSTASH_REDIS_REST_URL: 'https://b.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'y' })
  })

  it('indica qué variables faltan', () => {
    setEnv({ VAPID_PUBLIC_KEY: 'pub' })
    expect(() => getEnv()).toThrow(/QSTASH_TOKEN.*UPSTASH_REDIS_REST_URL \(o KV_REST_API_URL\)/)
  })
})
