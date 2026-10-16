import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { es } from '../i18n/es'
import { FIRST_TIP_WEEK, LAST_TIP_WEEK, pregnancyMonth, tipWeek } from './pregnancyTips'

describe('recomendaciones del embarazo', () => {
  it('meses de embarazo por semanas cumplidas', () => {
    expect([0, 4, 5, 8, 9, 13, 14, 17, 18, 22, 23, 27, 28, 31, 32, 35, 36, 40, 42].map(pregnancyMonth)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9,
    ])
  })

  it('antes de la semana 4 se ve la de la 4 y pasada la 40, la de la 40', () => {
    expect(tipWeek(2)).toBe(4)
    expect(tipWeek(41)).toBe(40)
  })

  it('hay recomendación para cada semana y cada mes, en los dos idiomas', () => {
    for (let w = FIRST_TIP_WEEK; w <= LAST_TIP_WEEK; w++) {
      expect(es.modes.pregnancy.weekTips[w], `semana ${w}`).toBeTruthy()
      expect(en.modes.pregnancy.weekTips[w], `week ${w}`).toBeTruthy()
    }
    for (let m = 1; m <= 9; m++) {
      expect(es.modes.pregnancy.monthTips[m]).toBeTruthy()
      expect(en.modes.pregnancy.monthTips[m]).toBeTruthy()
    }
  })
})
