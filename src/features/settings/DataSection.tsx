import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { downloadBackupCSV, downloadBackupJSON, encryptedBackupFile, importFile, saveBackupFile } from '../../db/data'
import { isVaultUnlocked } from '../../db/vault'
import { BackupError } from '../../domain/backup'
import { formatFullDate } from '../../domain/dates'
import { t } from '../../i18n'
import { decryptBackup, isEncryptedBackup, WrongKeyError } from '../../security/backupCrypto'
import { DeleteAllFlow } from './DeleteAllFlow'
import { PasswordDialog } from './PasswordDialog'
import { Section } from './Section'
import { StorageProtection } from './StorageProtection'

/** Una copia de años de registros ocupa unos cientos de KB: 10 MB es un margen amplio. */
const MAX_IMPORT_BYTES = 10 * 1024 * 1024

export function DataSection({ lastBackup }: { lastBackup: string | null }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<File | null>(null)
  /** Copia cifrada a la espera de la contraseña. */
  const [encrypted, setEncrypted] = useState<{ name: string; text: string } | null>(null)
  const [exportingEncrypted, setExportingEncrypted] = useState(false)
  /** Copia cifrada ya preparada, a la espera de "Guardar copia". */
  const [readyFile, setReadyFile] = useState<File | null>(null)
  const [status, setStatus] = useState('')
  const [deleting, setDeleting] = useState(false)
  const s = t.settings
  const e = t.encryptedBackup

  const importText = async (name: string, text: string) => {
    try {
      const r = await importFile(name, text)
      setStatus(s.importDone(r.periods, r.days))
    } catch (err) {
      setStatus(s.importError(err instanceof BackupError ? err.message : ''))
    }
  }

  const doImport = async (file: File) => {
    setPending(null)
    if (file.size > MAX_IMPORT_BYTES) {
      setStatus(s.importError(s.importTooBig))
      return
    }
    const text = await file.text()
    if (isEncryptedBackup(text)) setEncrypted({ name: file.name, text })
    else await importText(file.name, text)
  }

  /** Devuelve el error a mostrar en el diálogo, o null si se ha importado. */
  const decryptAndImport = async (password: string): Promise<string | null> => {
    if (!encrypted) return null
    let plain: string
    try {
      plain = await decryptBackup(encrypted.text, password)
    } catch (err) {
      if (err instanceof WrongKeyError) return e.wrong
      setEncrypted(null)
      setStatus(s.importError(e.bad))
      return null
    }
    setEncrypted(null)
    await importText(encrypted.name, plain)
    return null
  }

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
          onChange={(ev) => {
            const f = ev.target.files?.[0]
            ev.target.value = ''
            if (f) setPending(f)
          }}
        />
      </div>
      <p className="text-sm text-muted">{lastBackup ? s.lastBackup(formatFullDate(lastBackup)) : s.noBackup}</p>
      <p role="status" className="text-sm font-bold">
        {status}
      </p>
      <StorageProtection />
      {isVaultUnlocked() && <p className="text-xs text-muted">{t.encryption.exportsNotEncrypted}</p>}

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
      {encrypted && (
        <PasswordDialog
          title={e.importTitle}
          body={e.importBody}
          submitLabel={e.decrypt}
          busyLabel={e.decrypting}
          onSubmit={decryptAndImport}
          onCancel={() => setEncrypted(null)}
        />
      )}
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
