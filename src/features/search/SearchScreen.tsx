import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { db } from '../../db/db'
import { formatFullDate, type ISODate } from '../../domain/dates'
import { MIN_QUERY_LENGTH, searchDays, type SearchMatch } from '../../domain/search'
import { symptomLabel, t } from '../../i18n'
import { DaySheet } from '../log/DaySheet'

/** Búsqueda en notas, síntomas y medicación de todos los días registrados. */
export function SearchScreen() {
  const [query, setQuery] = useState('')
  // La lista se recalcula sin bloquear la escritura.
  const deferred = useDeferredValue(query)
  const [selected, setSelected] = useState<ISODate | null>(null)
  const days = useLiveQuery(() => db.days.toArray())
  const out = useMemo(() => (days ? searchDays(days, deferred, symptomLabel) : null), [days, deferred])
  const s = t.search
  const searching = deferred.trim().length >= MIN_QUERY_LENGTH

  return (
    <main className="mx-auto w-full max-w-md space-y-4 px-4 pt-6 pb-4">
      <a href="#/calendar" className="inline-flex min-h-11 items-center gap-1 font-bold text-primary">
        <Icon name="chevronLeft" className="size-5" />
        {t.nav.calendar}
      </a>
      <h1 className="text-2xl font-extrabold">{s.title}</h1>

      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={s.label}
          placeholder={s.placeholder}
          autoComplete="off"
          enterKeyHint="search"
          // En esta pantalla lo único que se hace es escribir.
          autoFocus
          className="min-h-12 w-full rounded-2xl border border-line bg-surface pr-4 pl-11 text-lg"
        />
      </div>

      {!searching && <p className="text-sm text-muted">{s.hint}</p>}

      {searching && out && (
        <>
          <p role="status" className="text-sm font-bold text-muted">
            {out.results.length ? s.count(out.results.length) : s.none}
          </p>

          {out.symptoms.length > 0 && (
            <section aria-labelledby="symptom-history" className="rounded-3xl bg-surface p-5 shadow-sm">
              <h2 id="symptom-history" className="font-extrabold">
                {s.historyTitle}
              </h2>
              <ul className="mt-2 space-y-1">
                {out.symptoms.map((h) => (
                  <li key={h.name}>
                    <span className="font-bold">{symptomLabel(h.name)}</span>
                    <span className="text-muted"> · {s.history(h.days, formatFullDate(h.last))}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <ul className="space-y-2">
            {out.results.map((r) => (
              <li key={r.date}>
                <button
                  type="button"
                  onClick={() => setSelected(r.date)}
                  className="w-full rounded-2xl bg-surface p-4 text-left shadow-sm hover:bg-surface-soft"
                >
                  <span className="block font-bold">{formatFullDate(r.date)}</span>
                  {r.matches.map((m, i) => (
                    <span key={i} className="mt-1 block text-sm">
                      <span className="font-bold text-muted">{s.fields[m.field]}: </span>
                      <Highlighted m={m} />
                    </span>
                  ))}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected && <DaySheet date={selected} onClose={() => setSelected(null)} />}
    </main>
  )
}

function Highlighted({ m }: { m: SearchMatch }) {
  if (!m.length) return <>{m.text}</>
  return (
    <>
      {m.text.slice(0, m.start)}
      <mark className="rounded bg-primary-soft px-0.5 text-ink">{m.text.slice(m.start, m.start + m.length)}</mark>
      {m.text.slice(m.start + m.length)}
    </>
  )
}
