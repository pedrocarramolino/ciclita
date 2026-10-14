import type { Report } from '../../domain/report'
import { lang } from '../../i18n'
import { reportBlocks, type ReportBlock } from './reportBlocks'

/**
 * El informe en sí, sin interfaz alrededor. Usa solo las clases de report.css (no
 * Tailwind): es siempre una "hoja" blanca, apta para imprimir. El mismo contenido se
 * genera en PDF con reportPdf.
 */
export function ReportDocument({ report, name }: { report: Report; name?: string }) {
  return (
    <article className="rpt" lang={lang}>
      {reportBlocks(report, name).map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </article>
  )
}

function Block({ block: b }: { block: ReportBlock }) {
  switch (b.kind) {
    case 'title':
      return <h1>{b.text}</h1>
    case 'name':
      return <p className="rpt-name">{b.text}</p>
    case 'meta':
      return <p className="rpt-meta">{b.text}</p>
    case 'h2':
      return <h2>{b.text}</h2>
    case 'alert':
      return <p className="rpt-alert">{b.text}</p>
    case 'empty':
      return <p className="rpt-empty">{b.text}</p>
    case 'footer':
      return <p className="rpt-footer">{b.text}</p>
    case 'kv':
      return (
        <table className={b.summary ? 'rpt-summary' : undefined}>
          <tbody>
            {b.rows.map(([label, value], i) => (
              <tr key={i}>
                <th scope="row">{label}</th>
                <td className={b.numeric ? 'num' : undefined}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'table':
      return (
        <table>
          <thead>
            <tr>
              {b.head.map((h, i) => (
                <th key={i} scope="col" className={b.numeric[i] ? 'num' : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={b.numeric[j] ? 'num' : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
  }
}
