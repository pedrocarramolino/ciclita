import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { downloadBackupJSON } from '../../db/data'
import { setSettings } from '../../db/settings'
import type { BackupNudge } from '../../domain/backupNudge'
import { today as todayISO } from '../../domain/dates'
import { t } from '../../i18n'

/** Sugerencia de copia de seguridad en el inicio (cuándo sale: domain/backupNudge). */
export function BackupNudgeCard({ nudge, onSaved }: { nudge: NonNullable<BackupNudge>; onSaved: () => void }) {
  const b = t.backupNudge
  return (
    <section aria-labelledby="backup-nudge" className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id="backup-nudge" className="flex items-center gap-2 text-lg font-extrabold">
        <Icon name="shield" className="size-5" />
        {b.title}
      </h2>
      <p className="mt-1 text-sm">{nudge.kind === 'never' ? b.never : b.old(nudge.days)}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => void setSettings({ backupSnoozedOn: todayISO() })}>
          {b.later}
        </Button>
        <Button variant="secondary" onClick={() => void downloadBackupJSON().then((saved) => saved && onSaved())}>
          {b.now}
        </Button>
      </div>
    </section>
  )
}
