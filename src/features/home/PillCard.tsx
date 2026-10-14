import { useLiveQuery } from 'dexie-react-hooks'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { db } from '../../db/db'
import { setPillTaken } from '../../db/repo'
import { getSettings } from '../../db/settings'
import { addDays, today as todayISO } from '../../domain/dates'
import { pillDay } from '../../domain/pill'
import { t } from '../../i18n'

/** "Píldora de hoy": marcar la toma con un toque (Ajustes → Qué registras). */
export function PillCard() {
  const today = todayISO()
  const data = useLiveQuery(async () => {
    const s = await getSettings()
    if (!s.tracking.pill || !s.pill.start) return null
    const cfg = { pack: s.pill.pack, start: s.pill.start }
    const yesterday = addDays(today, -1)
    const [day, prev] = await Promise.all([db.days.get(today), db.days.get(yesterday)])
    return {
      info: pillDay(today, cfg),
      taken: !!day?.pillTaken,
      missedYesterday: !!pillDay(yesterday, cfg)?.active && !prev?.pillTaken,
    }
  }, [today])
  const p = t.pill

  if (!data?.info) return null
  const { info, taken, missedYesterday } = data

  return (
    <section aria-labelledby="pill-today" className="rounded-3xl bg-surface p-5 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="pill-today" className="text-lg font-extrabold">
          {p.todayTitle}
        </h2>
        <p className="text-sm text-muted">{p.packDay(info.day)}</p>
      </div>
      {!info.active ? (
        <p className="mt-2">{p.restDay}</p>
      ) : taken ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 font-bold" role="status">
            <span className="grid size-8 place-items-center rounded-full bg-primary text-on-primary">
              <Icon name="check" className="size-5" />
            </span>
            {p.taken}
          </p>
          <Button variant="ghost" onClick={() => void setPillTaken(today, false)}>
            {p.undo}
          </Button>
        </div>
      ) : (
        <Button className="mt-3 w-full" onClick={() => void setPillTaken(today, true)}>
          <Icon name="check" />
          {p.markTaken}
        </Button>
      )}
      {missedYesterday && <p className="mt-3 text-sm text-muted">{p.missedYesterday}</p>}
    </section>
  )
}
