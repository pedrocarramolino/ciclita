/**
 * Genera el informe en PDF (A4) en el propio dispositivo con pdf-lib. Se carga solo
 * en la pantalla del informe. Dibuja los mismos bloques que la vista en pantalla.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib'
import type { ReportBlock } from './reportBlocks'

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 48
const WIDTH = A4[0] - MARGIN * 2
const INK = rgb(0.12, 0.1, 0.11)
const MUTED = rgb(0.36, 0.29, 0.33)
const ACCENT = rgb(0.71, 0.31, 0.25)
const LINE = rgb(0.9, 0.86, 0.87)
const ALERT_BG = rgb(0.98, 0.93, 0.93)
const ALERT_BAR = rgb(0.62, 0.18, 0.18)
const CELL_PAD = 5

interface Fonts {
  regular: PDFFont
  bold: PDFFont
  italic: PDFFont
}

export async function reportPdf(blocks: ReportBlock[], meta: { title: string; lang: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(meta.title)
  doc.setLanguage(meta.lang)
  doc.setCreator('Ciclita')
  doc.setProducer('Ciclita')
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  }

  let page: PDFPage = doc.addPage(A4)
  let y = A4[1] - MARGIN
  const ensure = (h: number) => {
    if (y - h < MARGIN + 16) {
      page = doc.addPage(A4)
      y = A4[1] - MARGIN
    }
  }

  /** Escribe líneas de texto ya partidas; `x` y `align` respecto a una caja de ancho `w`. */
  const lines = (ls: string[], o: { x: number; w: number; font: PDFFont; size: number; color?: typeof INK; align?: 'left' | 'right'; top: number }) => {
    const lh = o.size * 1.3
    ls.forEach((l, i) => {
      const tw = o.font.widthOfTextAtSize(l, o.size)
      const x = o.align === 'right' ? o.x + o.w - tw : o.x
      page.drawText(l, { x, y: o.top - o.size - i * lh, size: o.size, font: o.font, color: o.color ?? INK })
    })
    return ls.length * lh
  }

  const paragraph = (text: string, font: PDFFont, size: number, color = INK, gapAfter = 4) => {
    const ls = wrap(clean(text, font), font, size, WIDTH)
    const lh = size * 1.3
    for (const l of ls) {
      ensure(lh)
      lines([l], { x: MARGIN, w: WIDTH, font, size, color, top: y })
      y -= lh
    }
    y -= gapAfter
  }

  /** Una fila de celdas con texto ajustado; devuelve la altura usada. */
  const row = (cells: string[], widths: number[], o: { fonts: PDFFont[]; size: number; colors: (typeof INK)[]; right: boolean[] }) => {
    const wrapped = cells.map((c, i) => wrap(clean(c, o.fonts[i]), o.fonts[i], o.size, widths[i] - CELL_PAD * 2))
    const h = Math.max(...wrapped.map((w) => w.length)) * o.size * 1.3 + CELL_PAD * 2
    ensure(h)
    let x = MARGIN
    wrapped.forEach((w, i) => {
      lines(w, { x: x + CELL_PAD, w: widths[i] - CELL_PAD * 2, font: o.fonts[i], size: o.size, color: o.colors[i], align: o.right[i] ? 'right' : 'left', top: y - CELL_PAD })
      x += widths[i]
    })
    y -= h
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + WIDTH, y }, thickness: 0.6, color: LINE })
  }

  for (const b of blocks) {
    switch (b.kind) {
      case 'title':
        paragraph(b.text, fonts.bold, 18, INK, 2)
        break
      case 'name':
        y -= 4
        paragraph(b.text, fonts.bold, 13, INK, 0)
        break
      case 'meta':
        paragraph(b.text, fonts.regular, 10, MUTED, 0)
        break
      case 'empty':
        paragraph(b.text, fonts.italic, 10, MUTED, 2)
        break
      case 'h2': {
        // Un título no se queda solo al final de una página.
        ensure(60)
        y -= 16
        paragraph(b.text, fonts.bold, 13, INK, 3)
        page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + WIDTH, y }, thickness: 1.5, color: ACCENT })
        y -= 2
        break
      }
      case 'alert': {
        const ls = wrap(clean(b.text, fonts.regular), fonts.regular, 10, WIDTH - 20)
        const h = ls.length * 13 + 12
        y -= 6
        ensure(h)
        page.drawRectangle({ x: MARGIN, y: y - h, width: WIDTH, height: h, color: ALERT_BG })
        page.drawRectangle({ x: MARGIN, y: y - h, width: 3, height: h, color: ALERT_BAR })
        lines(ls, { x: MARGIN + 12, w: WIDTH - 20, font: fonts.regular, size: 10, top: y - 6 })
        y -= h
        break
      }
      case 'footer': {
        y -= 14
        ensure(30)
        page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + WIDTH, y }, thickness: 0.6, color: LINE })
        y -= 6
        paragraph(b.text, fonts.regular, 8.5, MUTED, 0)
        break
      }
      case 'kv': {
        const labelW = b.summary ? WIDTH * 0.55 : b.numeric ? WIDTH * 0.6 : WIDTH * 0.3
        for (const [label, value] of b.rows) {
          row([label, value], [labelW, WIDTH - labelW], {
            fonts: [b.summary ? fonts.regular : fonts.bold, fonts.regular],
            size: b.summary ? 10.5 : 10,
            colors: [b.summary ? INK : MUTED, INK],
            right: [false, b.numeric],
          })
        }
        break
      }
      case 'table': {
        const n = b.head.length
        const first = n > 1 ? WIDTH * 0.45 : WIDTH
        const widths = [first, ...Array.from({ length: n - 1 }, () => (WIDTH - first) / (n - 1))]
        // La cabecera no se queda sola al final de una página.
        ensure(40)
        row(b.head, widths, { fonts: b.head.map(() => fonts.bold), size: 9, colors: b.head.map(() => MUTED), right: b.numeric })
        for (const r of b.rows) {
          row(r, widths, { fonts: r.map(() => fonts.regular), size: 10, colors: r.map(() => INK), right: b.numeric })
        }
        break
      }
    }
  }

  // Número de página al pie.
  const pages = doc.getPages()
  pages.forEach((p, i) => {
    const text = `${i + 1} / ${pages.length}`
    const w = fonts.regular.widthOfTextAtSize(text, 8)
    p.drawText(text, { x: A4[0] - MARGIN - w, y: MARGIN / 2, size: 8, font: fonts.regular, color: MUTED })
  })

  return doc.save()
}

/** Quita los caracteres que las fuentes estándar del PDF no pueden dibujar (p. ej. emojis). */
function clean(text: string, font: PDFFont): string {
  let out = ''
  for (const ch of text.replace(/→/g, '->').replace(/\s+/g, ' ')) {
    try {
      font.widthOfTextAtSize(ch, 10)
      out += ch
    } catch {
      // Sin equivalente en la fuente: se omite.
    }
  }
  return out.replace(/ {2,}/g, ' ').trim()
}

/** Parte el texto en líneas que caben en `max` puntos (corta palabras muy largas). */
export function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const width = (s: string) => font.widthOfTextAtSize(s, size)
  const out: string[] = []
  let line = ''
  for (let word of text.split(' ')) {
    while (width(word) > max) {
      let cut = word.length - 1
      while (cut > 1 && width(word.slice(0, cut)) > max) cut--
      if (line) out.push(line)
      out.push(word.slice(0, cut))
      line = ''
      word = word.slice(cut)
    }
    const next = line ? `${line} ${word}` : word
    if (width(next) <= max) line = next
    else {
      out.push(line)
      line = word
    }
  }
  if (line || !out.length) out.push(line)
  return out
}
