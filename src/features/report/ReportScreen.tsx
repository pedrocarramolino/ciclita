import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { Switch } from '../../components/Switch'
import { db } from '../../db/db'
import { getSettings } from '../../db/settings'
import { today } from '../../domain/dates'
import { buildReport, reportFileName, type Report, type ReportMonths } from '../../domain/report'
import { lang, t } from '../../i18n'
import { usePrediction } from '../../usePrediction'
import { canShareFile, isIOSStandalone, saveFile, shareFile } from '../../files'
import { ReportDocument } from './ReportDocument'
import { reportBlocks } from './reportBlocks'
import './report.css'

const RANGES: ReportMonths[] = [3, 6, 12, 'all']

/** Se puede pasar un PDF al menú Compartir del sistema (móviles, sobre todo). */
const CAN_SHARE_PDF = canShareFile(new File([new Uint8Array(1)], 'informe.pdf', { type: 'application/pdf' }))
/** En iOS con la app instalada, window.print() no hace nada. */
const CAN_PRINT = !isIOSStandalone()

/**
 * Informe para el médico. Se genera en el dispositivo (no sale nada hacia ningún
 * servidor) como PDF, que se puede compartir, descargar o imprimir.
 */
export function ReportScreen() {
  const [months, setMonths] = useState<ReportMonths>(6)
  const [includeNotes, setIncludeNotes] = useState(false)
  const [name, setName] = useState('')
  const prediction = usePrediction()
  const data = useLiveQuery(async () => {
    const [periods, days, settings] = await Promise.all([db.periods.toArray(), db.days.toArray(), getSettings()])
    const pill = settings.tracking.pill && settings.pill.start ? { pack: settings.pill.pack, start: settings.pill.start } : null
    return {
      periods,
      days,
      pill,
      userCycleLength: settings.cycleLength,
      confirmedLongCycles: settings.confirmedLongCycles,
    }
  })
  const R = t.report

  const report = useMemo(
    () => (prediction && data ? buildReport(
            data.periods,
            data.days,
            prediction,
            {
              months,
              includeNotes,
              pill: data.pill,
              userCycleLength: data.userCycleLength,
              confirmedLongCycles: data.confirmedLongCycles,
            },
            today(),
          ) : null),
    [prediction, data, months, includeNotes],
  )

  // El PDF se prepara por adelantado: iOS solo abre el menú Compartir si se llama
  // justo al pulsar el botón, sin esperas de por medio.
  // Resultado ligado al informe y al nombre con los que se generó: si cambian, el PDF
  // anterior deja de valer sin necesidad de borrarlo.
  const [generated, setGenerated] = useState<{ report: Report; name: string; file: File | null } | null>(null)
  const current = generated && report && generated.report === report && generated.name === name ? generated : null
  const pdf = current?.file ?? null
  const pdfError = !!current && !current.file
  useEffect(() => {
    if (!report) return
    let cancelled = false
    const id = setTimeout(() => {
      import('./reportPdf')
        .then(({ reportPdf }) => reportPdf(reportBlocks(report, name), { title: R.docTitle, lang }))
        .then((bytes) => new File([bytes as BlobPart], reportFileName(report), { type: 'application/pdf' }))
        .catch((e: unknown) => {
          console.error('No se pudo crear el PDF', e)
          return null
        })
        .then((file) => {
          if (!cancelled) setGenerated({ report, name, file })
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [report, name, R.docTitle])

  const share = async () => {
    if (!pdf) return
    if ((await shareFile(pdf, R.docTitle)) === 'unavailable') await saveFile(pdf)
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
          {CAN_SHARE_PDF && (
            <Button disabled={!pdf} onClick={() => void share()}>
              <Icon name="share" />
              {R.share}
            </Button>
          )}
          <Button
            variant={CAN_SHARE_PDF ? 'secondary' : 'primary'}
            disabled={!pdf}
            onClick={() => pdf && void saveFile(pdf)}
          >
            {R.download}
          </Button>
          {CAN_PRINT && (
            <Button variant="secondary" disabled={!report} onClick={() => window.print()}>
              {R.print}
            </Button>
          )}
        </div>
        <p role="status" className="text-sm font-bold empty:hidden">
          {pdfError ? R.pdfError : !pdf && report ? R.preparing : ''}
        </p>
        <p className="text-xs text-muted">{CAN_SHARE_PDF ? R.shareHint : R.printHint}</p>
      </div>

      {report && (
        <div className="overflow-x-auto rounded-2xl shadow-sm">
          <ReportDocument report={report} name={name} />
        </div>
      )}
    </main>
  )
}
