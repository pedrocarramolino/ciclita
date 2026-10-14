import { describe, expect, it } from 'vitest'
import { MANIFEST_EN, MANIFEST_ES } from './pwa-manifests.ts'

describe('manifiestos de la PWA', () => {
  it('son la misma app en los dos idiomas (mismo id, inicio, iconos y atajos)', () => {
    for (const k of ['id', 'start_url', 'scope', 'display', 'icons', 'theme_color'] as const) {
      expect(MANIFEST_EN[k]).toEqual(MANIFEST_ES[k])
    }
    expect(MANIFEST_EN.shortcuts!.map((s) => s.url)).toEqual(MANIFEST_ES.shortcuts!.map((s) => s.url))
  })

  it('traduce nombre, descripción y atajos', () => {
    expect(MANIFEST_EN.lang).toBe('en')
    expect(MANIFEST_EN.name).not.toBe(MANIFEST_ES.name)
    expect(MANIFEST_EN.description).not.toBe(MANIFEST_ES.description)
    expect(MANIFEST_EN.shortcuts!.map((s) => s.name)).toEqual(['Log today', 'Calendar'])
  })
})
