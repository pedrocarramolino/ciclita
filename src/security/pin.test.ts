import { describe, expect, it } from 'vitest'
import { hashPin, isValidPin, lockoutMs, verifyPin } from './pin'

describe('PIN', () => {
  it('solo acepta 4 dígitos', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
    expect(isValidPin('12345')).toBe(false)
  })

  it('no guarda el PIN en claro y verifica correctamente', async () => {
    const stored = await hashPin('2580', 1000)
    expect(stored).not.toContain('2580')
    expect(await verifyPin('2580', stored)).toBe(true)
    expect(await verifyPin('2581', stored)).toBe(false)
  })

  it('usa una sal distinta cada vez', async () => {
    expect(await hashPin('1111', 1000)).not.toBe(await hashPin('1111', 1000))
  })

  it('rechaza formatos desconocidos', async () => {
    expect(await verifyPin('1234', 'texto-cualquiera')).toBe(false)
  })

  it('aplica esperas crecientes tras 5 fallos', () => {
    expect(lockoutMs(4)).toBe(0)
    expect(lockoutMs(5)).toBe(30_000)
    expect(lockoutMs(6)).toBe(60_000)
  })
})
