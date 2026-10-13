import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Switch } from '../../components/Switch'
import { downloadText } from '../../db/data'
import { db } from '../../db/db'
import { today } from '../../domain/dates'
import { buildReport, reportFileName, type ReportMonths } from '../../domain/report'
import { t } from '../../i18n/es'
import { usePrediction } from '../../usePrediction'
import { ReportDocument } from './ReportDocument'
import './report.css'
import reportCss from './report.css?raw'

const RANGES: ReportMonths[] = [3, 6, 12, 'all']

/**
 * Informe para el médico. Se genera en el dispositivo (no sale nada hacia ningún
 * servidor) y se puede imprimir / guardar como PDF o descargar como archivo.
 */
export function ReportScreen() {
  const [months, setMonths] = useState<ReportMonths>(6)
  const [includeNotes, setIncludeNotes] = useState(false)
  const [name, setName] = useState('')
  const prediction = usePrediction()
  const data = useLiveQuery(async () => {
    const [periods, days] = await Promise.all([db.periods.toArray(), db.days.toArray()])
    return { periods, days }
  })
  const R = t.report

  const report = useMemo(
    () => (prediction && data ? buildReport(data.periods, data.days, prediction, { months, includeNotes }, today()) : null),
    [prediction, data, months, includeNotes],
  )

  const docRef = useRef<HTMLDivElement>(null)

  // El archivo descargable reutiliza el HTML del informe que ya está en pantalla.
  const download = () => {
    const body = docRef.current?.innerHTML
    if (!report || !body) return
    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${R.docTitle}</title>
<style>${reportCss}
body { margin: 0; padding: 16px; background: #f4eef0; }
@media print { body { padding: 0; background: #fff; } }</style>
</head>
<body>${body}</body>
</html>`
    downloadText(reportFileName(report), html, 'text/html;charset=utf-8')
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-6 pb-4">
      <div className="no-print space-y-4">
        <a href="#/stats" className="inline-flex min-h-11 items-center gap-1 font-bold text-primary">
          <Icon name="chevronLeft" className="size-5" />
          {t.nav.stats}
        </a>
        <h1 className="text-2xl font-extrabold">{R.title}</h1>
        <p className="text-sm text-muted">{R.intro}</p>

        <section className="space-y-4 rounded-3xl bg-surface p-5 shadow-sm">
          <fieldset>
            <legend className="mb-2 font-bold">{R.rangeLabel}</legend>
            <div className="grid grid-cols-4 gap-2">
              {RANGES.map((m) => (
                <label
                  key={m}
                  className="flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border border-line bg-surface px-1 text-center text-sm font-bold has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-3 has-focus-visible:outline-[var(--focus)]"
                >
                  <input
                    type="radio"
                    name="report-range"
                    className="sr-only"
                    checked={months === m}
                    onChange={() => setMonths(m)}
                  />
                  {R.ranges[String(m) as keyof typeof R.ranges]}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="report-name" className="mb-1 block font-bold">
              {R.nameLabel}
            </label>
            <input
              id="report-name"
              value={name}
              maxLength={80}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              placeholder={R.namePlaceholder}
              className="min-h-11 w-full rounded-2xl border border-line bg-surface px-4"
            />
            <p className="mt-1 text-xs text-muted">{R.nameHint}</p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p id="report-notes" className="font-bold">
                {R.includeNotes}
              </p>
              <p className="text-sm text-muted">{R.includeNotesHint}</p>
            </div>
            <Switch checked={includeNotes} onChange={setIncludeNotes} labelledBy="report-notes" />
          </div>
        </section>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button disabled={!report} onClick={() => window.print()}>
            {R.print}
          </Button>
          <Button variant="secondary" disabled={!report} onClick={download}>
            {R.download}
          </Button>
        </div>
        <p className="text-xs text-muted">{R.printHint}</p>
      </div>

      {report && (
        <div ref={docRef} className="overflow-x-auto rounded-2xl shadow-sm">
          <ReportDocument report={report} name={name} />
        </div>
      )}
    </main>
  )
}
