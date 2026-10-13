import { formatFullDate } from '../../domain/dates'
import { FLOW_OPTIONS } from '../../domain/options'
import type { Report } from '../../domain/report'
import { t } from '../../i18n/es'

/**
 * El informe en sí, sin interfaz alrededor. Su HTML también se guarda tal cual como
 * archivo descargable, por eso no usa clases de Tailwind: solo las de report.css,
 * que se incrustan en el archivo.
 */
export function ReportDocument({ report: r, name }: { report: Report; name?: string }) {
  const R = t.report
  const s = r.summary
  const days = (n: number | null) => (n === null ? '—' : R.days(n))

  return (
    <article className="rpt" lang="es">
      <h1>{R.docTitle}</h1>
      {name?.trim() && <p className="rpt-name">{name.trim()}</p>}
      <p className="rpt-meta">{R.rangeLine(formatFullDate(r.from), formatFullDate(r.to))}</p>
      <p className="rpt-meta">{R.generatedLine(formatFullDate(r.generatedOn))}</p>

      <h2>{R.summaryTitle}</h2>
      <table className="rpt-summary">
        <tbody>
          <tr>
            <th scope="row">{R.cyclesCount}</th>
            <td className="num">{s.cyclesCount}</td>
          </tr>
          <tr>
            <th scope="row">{R.avgCycle}</th>
            <td className="num">{days(s.avgCycle)}</td>
          </tr>
          <tr>
            <th scope="row">{R.avgPeriod}</th>
            <td className="num">{days(s.avgPeriod)}</td>
          </tr>
          <tr>
            <th scope="row">{R.shortestLongest}</th>
            <td className="num">{s.shortest === null ? '—' : `${R.days(s.shortest)} / ${R.days(s.longest!)}`}</td>
          </tr>
          <tr>
            <th scope="row">{R.variation}</th>
            <td className="num">{days(s.variation)}</td>
          </tr>
          <tr>
            <th scope="row">{R.lastStart}</th>
            <td className="num">{s.lastStart ? formatFullDate(s.lastStart) : '—'}</td>
          </tr>
          <tr>
            <th scope="row">{R.nextPeriod}</th>
            <td className="num">
              {s.nextPeriod
                ? s.nextPeriod.margin > 0
                  ? R.nextWithMargin(formatFullDate(s.nextPeriod.start), s.nextPeriod.margin)
                  : formatFullDate(s.nextPeriod.start)
                : '—'}
            </td>
          </tr>
        </tbody>
      </table>
      {s.isIrregular && <p className="rpt-alert">{R.irregular(s.variation!)}</p>}

      <h2>{R.cyclesTitle}</h2>
      {r.cycles.length ? (
        <table>
          <thead>
            <tr>
              <th scope="col">{R.colStart}</th>
              <th scope="col" className="num">{R.colCycle}</th>
              <th scope="col" className="num">{R.colPeriod}</th>
            </tr>
          </thead>
          <tbody>
            {r.cycles.map((c) => (
              <tr key={c.start}>
                <td>{formatFullDate(c.start)}</td>
                <td className="num">{R.days(c.length)}</td>
                <td className="num">{c.periodLength === null ? '—' : R.days(c.periodLength)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="rpt-empty">{R.noCycles}</p>
      )}

      <h2>{R.flowTitle}</h2>
      <table>
        <tbody>
          {FLOW_OPTIONS.map((f) => (
            <tr key={f.value}>
              <th scope="row">{f.label}</th>
              <td className="num">{R.days(r.flowDays[f.value])}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>{R.painTitle}</h2>
      {r.pain ? (
        <table className="rpt-summary">
          <tbody>
            <tr>
              <th scope="row">{R.painDays}</th>
              <td className="num">{R.days(r.pain.daysWithPain)}</td>
            </tr>
            <tr>
              <th scope="row">{R.painAverage}</th>
              <td className="num">{r.pain.average.toLocaleString('es')} / 10</td>
            </tr>
            <tr>
              <th scope="row">{R.painMax}</th>
              <td className="num">{r.pain.max} / 10</td>
            </tr>
            <tr>
              <th scope="row">{R.painSevere}</th>
              <td className="num">{R.days(r.pain.severeDays)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p className="rpt-empty">{R.noPain}</p>
      )}

      <h2>{R.symptomsTitle}</h2>
      {r.symptoms.length ? (
        <table>
          <thead>
            <tr>
              <th scope="col">{R.colSymptom}</th>
              <th scope="col" className="num">{R.colDays}</th>
              <th scope="col">{R.colPhase}</th>
            </tr>
          </thead>
          <tbody>
            {r.symptoms.map((sym) => (
              <tr key={sym.name}>
                <td>{sym.name}</td>
                <td className="num">{sym.count}</td>
                <td>{sym.topPhase ? t.stats.phases[sym.topPhase] : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="rpt-empty">{R.noSymptoms}</p>
      )}

      <h2>{R.medicationTitle}</h2>
      {r.medication.length ? (
        <table>
          <thead>
            <tr>
              <th scope="col">{R.colMedication}</th>
              <th scope="col" className="num">{R.colDays}</th>
              <th scope="col">{R.colLast}</th>
            </tr>
          </thead>
          <tbody>
            {r.medication.map((m) => (
              <tr key={m.name}>
                <td>{m.name}</td>
                <td className="num">{m.count}</td>
                <td>{formatFullDate(m.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="rpt-empty">{R.noMedication}</p>
      )}

      {r.notes.length > 0 && (
        <>
          <h2>{R.notesTitle}</h2>
          <table>
            <tbody>
              {r.notes.map((n) => (
                <tr key={n.date}>
                  <th scope="row">{formatFullDate(n.date)}</th>
                  <td>{n.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="rpt-footer">{R.footer}</p>
    </article>
  )
}
