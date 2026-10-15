import { useState } from 'react'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { downloadBackupCSV, downloadBackupJSON, encryptedBackupFile, saveBackupFile } from '../../db/data'
import { isVaultUnlocked } from '../../db/vault'
import { formatFullDate } from '../../domain/dates'
import { t } from '../../i18n'
import { PasswordDialog } from './PasswordDialog'
import { Section } from './Section'
import { useBackupImport } from './useBackupImport'

export function DataSection({ lastBackup }: { lastBackup: string | null }) {
  const [exportingEncrypted, setExportingEncrypted] = useState(false)
  /** Copia cifrada ya preparada, a la espera de "Guardar copia". */
  const [readyFile, setReadyFile] = useState<File | null>(null)
  const importer = useBackupImport({ confirmReplace: true })
  const s = t.settings
  const e = t.encryptedBackup

  return (
    <Section title={s.pages.backup} hint={s.dataHint}>
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
        <Button variant="secondary" onClick={importer.open}>
          {s.import}
        </Button>
        {importer.ui}
      </div>
      <p className="text-sm text-muted">{lastBackup ? s.lastBackup(formatFullDate(lastBackup)) : s.noBackup}</p>
      <p role="status" className="text-sm font-bold">
        {importer.status}
      </p>
      {isVaultUnlocked() && <p className="text-xs text-muted">{t.encryption.exportsNotEncrypted}</p>}

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
    </Section>
  )
}
