import { describe, expect, it } from 'vitest'
import { es } from '../i18n/es'
import { en } from '../i18n/en'
import { babySize, FIRST_SIZE_WEEK, LAST_SIZE_WEEK } from './babySize'

describe('tamaño del bebé por semana', () => {
  it('no hay comparación antes de la semana 4; después de la 40 se queda en la 40', () => {
    expect(babySize(3)).toBeNull()
    expect(babySize(4)).toMatchObject({ week: 4, emoji: '🌱' })
    expect(babySize(42)).toMatchObject({ week: 40, emoji: '🍉' })
  })

  it('hay datos y nombre (en los dos idiomas) para cada semana, y el bebé no encoge', () => {
    let prev = { lengthCm: 0, weightG: 0 }
    for (let w = FIRST_SIZE_WEEK; w <= LAST_SIZE_WEEK; w++) {
      const s = babySize(w)!
      expect(s.week).toBe(w)
      expect(es.modes.pregnancy.sizes[w]).toBeTruthy()
      expect(en.modes.pregnancy.sizes[w]).toBeTruthy()
      expect(s.lengthCm).toBeGreaterThan(prev.lengthCm)
      if (s.weightG !== null) expect(s.weightG).toBeGreaterThanOrEqual(prev.weightG)
      prev = { lengthCm: s.lengthCm, weightG: s.weightG ?? 0 }
    }
  })
})
