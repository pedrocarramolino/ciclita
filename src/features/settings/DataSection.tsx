import { useState } from 'react'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { downloadBackupCSV, downloadBackupJSON, encryptedBackupFile, saveBackupFile } from '../../db/data'
import { isVaultUnlocked } from '../../db/vault'
import { formatFullDate } from '../../domain/dates'
import { t } from '../../i18n'
import { DeleteAllFlow } from './DeleteAllFlow'
import { PasswordDialog } from './PasswordDialog'
import { Section } from './Section'
import { StorageProtection } from './StorageProtection'
import { useBackupImport } from './useBackupImport'

export function DataSection({ lastBackup }: { lastBackup: string | null }) {
  const [exportingEncrypted, setExportingEncrypted] = useState(false)
  /** Copia cifrada ya preparada, a la espera de "Guardar copia". */
  const [readyFile, setReadyFile] = useState<File | null>(null)
  const [deleting, setDeleting] = useState(false)
  const importer = useBackupImport({ confirmReplace: true })
  const s = t.settings
  const e = t.encryptedBackup

  return (
    <Section title={s.data} hint={s.dataHint}>
      <div className="grid gap-2">
        <Button variant="secondary" onClick={() => void downloadBackupJSON()}>
          {s.exportJSON}
        </Button>
        <Button variant="secondary" onClick={() => setExportingEncrypted(true)}>
          {s.exportEncrypted}
        </Button>
        <Button variant="secondary" onClick={() => void downloadBackupCSV()}>
          {s.exportCSV}
        </Button>
        <a
          href="#/report"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-surface px-6 py-3 font-bold text-ink hover:bg-surface-soft"
        >
          {t.report.open}
        </a>
        <Button variant="secondary" onClick={importer.open}>
          {s.import}
        </Button>
        {importer.ui}
      </div>
      <p className="text-sm text-muted">{lastBackup ? s.lastBackup(formatFullDate(lastBackup)) : s.noBackup}</p>
      <p role="status" className="text-sm font-bold">
        {importer.status}
      </p>
      <StorageProtection />
      {isVaultUnlocked() && <p className="text-xs text-muted">{t.encryption.exportsNotEncrypted}</p>}

      <Button variant="danger" className="w-full" onClick={() => setDeleting(true)}>
        {s.deleteAll}
      </Button>

      {exportingEncrypted && (
        <PasswordDialog
          title={e.title}
          body={e.body}
          submitLabel={e.export}
          busyLabel={e.encrypting}
          confirm
          onSubmit={async (password) => {
            setReadyFile(await encryptedBackupFile(password))
            setExportingEncrypted(false)
            return null
          }}
          onCancel={() => setExportingEncrypted(false)}
        />
      )}
      {readyFile && (
        <ConfirmDialog
          title={e.ready}
          confirmLabel={e.save}
          onConfirm={() => {
            const file = readyFile
            setReadyFile(null)
            void saveBackupFile(file)
          }}
          onCancel={() => setReadyFile(null)}
        >
          <p className="font-bold text-ink">{readyFile.name}</p>
          <p className="mt-1">{e.readyBody}</p>
        </ConfirmDialog>
      )}
      {deleting && <DeleteAllFlow onCancel={() => setDeleting(false)} />}
    </Section>
  )
}
