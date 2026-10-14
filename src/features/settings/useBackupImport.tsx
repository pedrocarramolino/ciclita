import { useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { importFile } from '../../db/data'
import { BackupError } from '../../domain/backup'
import { t } from '../../i18n'
import { decryptBackup, isEncryptedBackup, WrongKeyError } from '../../security/backupCrypto'
import { PasswordDialog } from './PasswordDialog'

/** Una copia de años de registros ocupa unos cientos de KB: 10 MB es un margen amplio. */
const MAX_IMPORT_BYTES = 10 * 1024 * 1024

/**
 * Importar una copia (JSON, JSON cifrado o CSV): selector de archivo, confirmación
 * de reemplazo (si `confirmReplace`) y contraseña de las copias cifradas.
 * Devuelve `open()` para abrir el selector, el mensaje de estado y la interfaz
 * (input oculto y diálogos) que hay que pintar.
 */
export function useBackupImport({ confirmReplace }: { confirmReplace: boolean }): {
  open: () => void
  status: string
  ui: ReactNode
} {
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<File | null>(null)
  /** Copia cifrada a la espera de la contraseña. */
  const [encrypted, setEncrypted] = useState<{ name: string; text: string } | null>(null)
  const [status, setStatus] = useState('')
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

  const ui = (
    <>
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
          if (!f) return
          if (confirmReplace) setPending(f)
          else void doImport(f)
        }}
      />
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
    </>
  )

  return { open: () => fileRef.current?.click(), status, ui }
}
