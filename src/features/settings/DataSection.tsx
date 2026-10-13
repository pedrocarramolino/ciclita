import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { downloadText, exportCSV, exportJSON, importFile } from '../../db/data'
import { BackupError } from '../../domain/backup'
import { today } from '../../domain/dates'
import { t } from '../../i18n/es'
import { DeleteAllFlow } from './DeleteAllFlow'
import { Section } from './Section'

export function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<File | null>(null)
  const [status, setStatus] = useState('')
  const [deleting, setDeleting] = useState(false)
  const s = t.settings

  const doImport = async (file: File) => {
    setPending(null)
    try {
      const r = await importFile(file.name, await file.text())
      setStatus(s.importDone(r.periods, r.days))
    } catch (e) {
      setStatus(s.importError(e instanceof BackupError ? e.message : ''))
    }
  }

  return (
    <Section title={s.data} hint={s.dataHint}>
      <div className="grid gap-2">
        <Button
          variant="secondary"
          onClick={async () =>
            downloadText(`ciclita-${today()}.json`, await exportJSON(), 'application/json')
          }
        >
          {s.exportJSON}
        </Button>
        <Button
          variant="secondary"
          onClick={async () => downloadText(`ciclita-${today()}.csv`, await exportCSV(), 'text/csv;charset=utf-8')}
        >
          {s.exportCSV}
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          {s.import}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) setPending(f)
          }}
        />
      </div>
      <p role="status" className="text-sm font-bold">
        {status}
      </p>

      <Button variant="danger" className="w-full" onClick={() => setDeleting(true)}>
        {s.deleteAll}
      </Button>

      {pending && (
        <ConfirmDialog
          title={s.importConfirmTitle}
          onConfirm={() => void doImport(pending)}
          onCancel={() => setPending(null)}
        >
          <p className="font-bold text-ink">{pending.name}</p>
          <p className="mt-1">{s.importConfirmBody}</p>
        </ConfirmDialog>
      )}
      {deleting && <DeleteAllFlow onCancel={() => setDeleting(false)} />}
    </Section>
  )
}
