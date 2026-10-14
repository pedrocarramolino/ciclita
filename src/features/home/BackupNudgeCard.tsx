import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { downloadBackupJSON } from '../../db/data'
import { db } from '../../db/db'
import { getSettings, setSettings } from '../../db/settings'
import { backupNudge } from '../../domain/backupNudge'
import { today as todayISO } from '../../domain/dates'
import { t } from '../../i18n'

/** Sugerencia de copia de seguridad en el inicio (ver domain/backupNudge). */
export function BackupNudgeCard() {
  const [done, setDone] = useState(false)
  const nudge = useLiveQuery(async () => {
    const [settings, firstPeriod, firstDay] = await Promise.all([
      getSettings(),
      db.periods.orderBy('startDate').first(),
      db.days.orderBy('date').first(),
    ])
    const dates = [firstPeriod?.startDate, firstDay?.date].filter((d): d is string => !!d).sort()
    return backupNudge({
      oldestData: dates[0] ?? null,
      lastBackup: settings.lastBackup,
      snoozedOn: settings.backupSnoozedOn,
      today: todayISO(),
    })
  })
  const b = t.backupNudge

  if (done) {
    return (
      <p role="status" className="rounded-2xl bg-surface p-4 text-sm font-bold shadow-sm">
        {b.done}
      </p>
    )
  }
  if (!nudge) return null

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
        <Button variant="secondary" onClick={() => void downloadBackupJSON().then(() => setDone(true))}>
          {b.now}
        </Button>
      </div>
    </section>
  )
}
