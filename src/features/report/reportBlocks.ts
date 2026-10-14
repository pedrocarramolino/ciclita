/**
 * Contenido del informe como una lista de bloques sencillos. Lo usan tanto la vista
 * en pantalla (ReportDocument) como el PDF (reportPdf), así los dos dicen lo mismo.
 */
import { formatDayMonth, formatFullDate } from '../../domain/dates'
import { FLOW_OPTIONS } from '../../domain/options'
import type { Report } from '../../domain/report'
import { symptomLabel, t } from '../../i18n'

export type ReportBlock =
  | { kind: 'title' | 'name' | 'meta' | 'h2' | 'alert' | 'empty' | 'footer'; text: string }
  /** Filas etiqueta / valor. `summary`: etiqueta destacada; `numeric`: valor a la derecha. */
  | { kind: 'kv'; rows: [string, string][]; summary: boolean; numeric: boolean }
  /** Tabla con cabecera; `numeric[i]` alinea a la derecha la columna i. */
  | { kind: 'table'; head: string[]; rows: string[][]; numeric: boolean[] }

export function reportBlocks(r: Report, name?: string): ReportBlock[] {
  const R = t.report
  const s = r.summary
  const days = (n: number | null) => (n === null ? '—' : R.days(n))
  const out: ReportBlock[] = [{ kind: 'title', text: R.docTitle }]
  if (name?.trim()) out.push({ kind: 'name', text: name.trim() })
  out.push(
    { kind: 'meta', text: R.rangeLine(formatFullDate(r.from), formatFullDate(r.to)) },
    { kind: 'meta', text: R.generatedLine(formatFullDate(r.generatedOn)) },
  )

  out.push({ kind: 'h2', text: R.summaryTitle })
  out.push({
    kind: 'kv',
    summary: true,
    numeric: true,
    rows: [
      [R.cyclesCount, String(s.cyclesCount)],
      [R.avgCycle, days(s.avgCycle)],
      [R.avgPeriod, days(s.avgPeriod)],
      [R.shortestLongest, s.shortest === null ? '—' : `${R.days(s.shortest)} / ${R.days(s.longest!)}`],
      [R.variation, days(s.variation)],
      [R.lastStart, s.lastStart ? formatFullDate(s.lastStart) : '—'],
      [
        R.nextPeriod,
        s.nextPeriod
          ? s.nextPeriod.margin > 0
            ? R.nextWithMargin(formatFullDate(s.nextPeriod.start), s.nextPeriod.margin)
            : formatFullDate(s.nextPeriod.start)
          : '—',
      ],
    ],
  })
  if (s.isIrregular) out.push({ kind: 'alert', text: R.irregular(s.variation!) })

  out.push({ kind: 'h2', text: R.cyclesTitle })
  out.push(
    r.cycles.length
      ? {
          kind: 'table',
          head: [R.colStart, R.colCycle, R.colPeriod],
          numeric: [false, true, true],
          rows: r.cycles.map((c) => [
            formatFullDate(c.start),
            R.days(c.length) + (c.suspectedMissed ? ' *' : ''),
            c.periodLength === null ? '—' : R.days(c.periodLength),
          ]),
        }
      : { kind: 'empty', text: R.noCycles },
  )
  if (s.missedCount) out.push({ kind: 'meta', text: R.missedNote(s.missedCount) })

  out.push({ kind: 'h2', text: R.flowTitle })
  out.push({
    kind: 'kv',
    summary: false,
    numeric: true,
    rows: FLOW_OPTIONS.map((f) => [f.label, R.days(r.flowDays[f.value])]),
  })

  out.push({ kind: 'h2', text: R.painTitle })
  out.push(
    r.pain
      ? {
          kind: 'kv',
          summary: true,
          numeric: true,
          rows: [
            [R.painDays, R.days(r.pain.daysWithPain)],
            [R.painAverage, `${R.decimal(r.pain.average)} / 10`],
            [R.painMax, `${r.pain.max} / 10`],
            [R.painSevere, R.days(r.pain.severeDays)],
          ],
        }
      : { kind: 'empty', text: R.noPain },
  )

  if (r.pill) {
    out.push({ kind: 'h2', text: R.pillTitle })
    out.push({
      kind: 'kv',
      summary: true,
      numeric: true,
      rows: [
        [R.pillTaken, R.pillTakenValue(r.pill.taken, r.pill.expected)],
        [R.pillMissed, String(r.pill.missedTotal)],
      ],
    })
    if (r.pill.missed.length) {
      const more = r.pill.missedTotal > r.pill.missed.length ? ', …' : ''
      out.push({ kind: 'meta', text: R.pillMissedDates(r.pill.missed.map(formatDayMonth).join(', ') + more) })
    }
  }

  out.push({ kind: 'h2', text: R.symptomsTitle })
  out.push(
    r.symptoms.length
      ? {
          kind: 'table',
          head: [R.colSymptom, R.colDays, R.colPhase, R.colTiming],
          numeric: [false, true, false, false],
          rows: r.symptoms.map((sym) => [
            symptomLabel(sym.name),
            String(sym.count),
            sym.topPhase ? t.stats.phases[sym.topPhase] : '—',
            sym.timing ? t.stats.timingShort(sym.timing.from, sym.timing.to) : '—',
          ]),
        }
      : { kind: 'empty', text: R.noSymptoms },
  )

  out.push({ kind: 'h2', text: R.medicationTitle })
  out.push(
    r.medication.length
      ? {
          kind: 'table',
          head: [R.colMedication, R.colDays, R.colLast],
          numeric: [false, true, false],
          rows: r.medication.map((m) => [m.name, String(m.count), formatFullDate(m.last)]),
        }
      : { kind: 'empty', text: R.noMedication },
  )

  const f = r.fertility
  if (f) {
    const rows: [string, string][] = []
    if (f.temperature) rows.push([R.temperatureRow(f.temperature.count), R.temperatureRange(f.temperature.min, f.temperature.max)])
    if (f.mucusDays > 0) rows.push([R.mucusRow, R.days(f.mucusDays)])
    if (f.sex.protected + f.sex.unprotected > 0) rows.push([R.sexRow, R.sexValue(f.sex.protected, f.sex.unprotected)])
    if (f.weight) {
      rows.push([
        R.weightRow,
        R.weightValue(f.weight.first, f.weight.last, formatFullDate(f.weight.firstDate), formatFullDate(f.weight.lastDate)),
      ])
    }
    out.push({ kind: 'h2', text: R.fertilityTitle }, { kind: 'kv', summary: true, numeric: true, rows })
  }

  if (r.notes.length) {
    out.push(
      { kind: 'h2', text: R.notesTitle },
      { kind: 'kv', summary: false, numeric: false, rows: r.notes.map((n) => [formatFullDate(n.date), n.text]) },
    )
  }

  out.push({ kind: 'footer', text: R.footer })
  return out
}
