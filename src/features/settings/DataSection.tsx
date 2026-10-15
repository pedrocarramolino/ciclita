import { Button } from '../../components/Button'
import { downloadBackupCSV } from '../../db/data'
import { isVaultUnlocked } from '../../db/vault'
import { formatFullDate } from '../../domain/dates'
import { t } from '../../i18n'
import { Section } from './Section'
import { useBackupImport } from './useBackupImport'

/** Ajustes → Exportar e importar: los registros en CSV (se abre con Excel o Numbers). */
export function DataSection({ lastBackup }: { lastBackup: string | null }) {
  const importer = useBackupImport({ confirmReplace: true, csvOnly: true })
  const s = t.settings

  return (
    <Section title={s.pages.backup} hint={s.dataHint}>
      <div className="grid gap-2">
        <Button variant="secondary" onClick={() => void downloadBackupCSV()}>
          {s.exportCSV}
        </Button>
        <Button variant="secondary" onClick={importer.open}>
          {s.import}
        </Button>
        {importer.ui}
      </div>
      <p className="text-sm text-muted">{lastBackup ? s.lastBackup(formatFullDate(lastBackup)) : s.noBackup}</p>
      <p role="status" className="text-sm font-bold empty:hidden">
        {importer.status}
      </p>
      {isVaultUnlocked() && <p className="text-xs text-muted">{t.encryption.exportsNotEncrypted}</p>}
    </Section>
  )
}
