import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import type { DayLog, Period } from '../../db/db'
import { addDays } from '../../domain/dates'
import { predict } from '../../domain/prediction'
import { buildReport } from '../../domain/report'
import { reportBlocks } from './reportBlocks'
import { reportPdf, wrap } from './reportPdf'

const TODAY = '2026-10-14'
const periods: Period[] = ['2026-06-01', '2026-06-30', '2026-07-27', '2026-08-26', '2026-09-24'].map((s) => ({
  startDate: s,
  endDate: addDays(s, 4),
}))
const days: DayLog[] = [
  { date: '2026-09-24', flow: 'heavy', pain: 8, symptoms: ['Migraña', 'Dolor abdominal'], medication: 'Ibuprofeno 400 mg', notes: 'Mucho dolor 😣 al despertar → mejor por la tarde', updatedAt: 0 },
  { date: '2026-09-25', flow: 'medium', pain: 5, symptoms: ['Cansancio'], pillTaken: true, updatedAt: 0 },
  { date: '2026-10-01', temperature: 36.55, mucus: 'eggwhite', sex: 'protected', weight: 62.5, updatedAt: 0 },
]

describe('reportPdf', () => {
  it('genera un PDF válido con todas las secciones (y caracteres que la fuente no tiene)', async () => {
    const prediction = predict({ periods, today: TODAY })
    const report = buildReport(periods, days, prediction, { months: 6, includeNotes: true, pill: { pack: 21, start: '2026-09-20' } }, TODAY)
    const bytes = await reportPdf(reportBlocks(report, 'Ana García'), { title: 'Informe', lang: 'es' })
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1)
    expect(doc.getTitle()).toBe('Informe')
  })

  it('wrap parte por palabras y corta las palabras más largas que la línea', async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica)
    const lines = wrap('uno dos tres cuatro cinco seis', font, 10, 60)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ')).toBe('uno dos tres cuatro cinco seis')
    for (const l of wrap('a'.repeat(200), font, 10, 60)) expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(60)
  })
})
