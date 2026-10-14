import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { Icon } from '../../components/Icon'
import { Switch } from '../../components/Switch'
import { db, type DayLog } from '../../db/db'
import { addCustomSymptom, saveDay, type DayForm } from '../../db/repo'
import { formatLong, today, type ISODate } from '../../domain/dates'
import { periodDateSet } from '../../domain/periods'
import { pillDay } from '../../domain/pill'
import { symptomLabel, t } from '../../i18n'
import {
  FLOW_OPTIONS,
  MOOD_OPTIONS,
  MUCUS_OPTIONS,
  parseDecimal,
  SEX_OPTIONS,
  TEMPERATURE_RANGE,
  WEIGHT_RANGE,
} from '../../domain/options'
import { getSettings } from '../../db/settings'
import {
  DEFAULT_FREQUENT,
  findCatalogSymptom,
  frequentSymptoms,
  PERIMENOPAUSE_FREQUENT,
  SYMPTOM_CATALOG,
} from '../../domain/symptoms'

/** Hoja modal con el registro de un día. Usa <dialog> nativo (foco atrapado, Escape cierra). */
export function DaySheet({ date, onClose }: { date: ISODate; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  const data = useLiveQuery(async () => {
    const [day, periods] = await Promise.all([db.days.get(date), db.periods.toArray()])
    return { day, isPeriod: periodDateSet(periods, today()).has(date) }
  }, [date])

  // Cerramos explícitamente desde cada salida (X, guardar, fondo, Escape) en lugar de
  // depender del evento asíncrono 'close', que no siempre llega a tiempo.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })
  const close = () => {
    ref.current?.close()
    onCloseRef.current()
  }

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const onCancel = (e: Event) => {
      e.preventDefault() // Escape
      dialog.close()
      onCloseRef.current()
    }
    dialog.addEventListener('cancel', onCancel)
    if (!dialog.open) dialog.showModal()
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => e.target === ref.current && close()}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-bg p-0 text-ink shadow-2xl backdrop:bg-black/40 sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 id={titleId} className="text-lg font-extrabold">
          {formatLong(date)}
        </h2>
        <button
          type="button"
          onClick={close}
          className="grid size-11 place-items-center rounded-full hover:bg-surface-soft"
          aria-label={t.log.close}
        >
          <Icon name="x" />
        </button>
      </header>
      {data && (
        <DayFormView
          date={date}
          initial={data.day}
          initialPeriod={data.isPeriod}
          onSaved={close}
        />
      )}
    </dialog>
  )
}

function DayFormView({
  date,
  initial,
  initialPeriod,
  onSaved,
}: {
  date: ISODate
  initial: DayLog | undefined
  initialPeriod: boolean
  onSaved: () => void
}) {
  const [isPeriod, setIsPeriod] = useState(initialPeriod)
  const [form, setForm] = useState<DayForm>(() => ({
    flow: initial?.flow,
    symptoms: initial?.symptoms ?? [],
    mood: initial?.mood,
    pain: initial?.pain,
    medication: initial?.medication ?? '',
    notes: initial?.notes ?? '',
    temperature: initial?.temperature,
    mucus: initial?.mucus,
    sex: initial?.sex,
    weight: initial?.weight,
    pillTaken: initial?.pillTaken,
  }))
  // Texto de los campos numéricos (admiten coma decimal); el número se valida al escribir.
  const toText = (n?: number) => (n === undefined ? '' : t.report.decimal(n))
  const [tempText, setTempText] = useState(() => toText(initial?.temperature))
  const [weightText, setWeightText] = useState(() => toText(initial?.weight))
  const tracking = useLiveQuery(() => getSettings().then((s) => s.tracking))
  // La píldora solo se pregunta los días en que toca (no en los de descanso).
  const showPill = useLiveQuery(async () => {
    const s = await getSettings()
    if (!s.tracking.pill) return false
    return !s.pill.start || !!pillDay(date, { pack: s.pill.pack, start: s.pill.start })?.active
  }, [date])
  const [newSymptom, setNewSymptom] = useState('')
  const [saving, setSaving] = useState(false)
  const customSymptoms = useLiveQuery(async () => {
    const all = await db.symptoms.toArray()
    return all.filter((s) => !s.builtin && !findCatalogSymptom(s.name)).map((s) => s.name)
  }) ?? []
  const frequent =
    useLiveQuery(async () => {
      const [days, settings] = await Promise.all([db.days.toArray(), getSettings()])
      return frequentSymptoms(days, 8, settings.mode === 'perimenopause' ? PERIMENOPAUSE_FREQUENT : DEFAULT_FREQUENT)
    }) ?? DEFAULT_FREQUENT
  const selectedCount = form.symptoms?.length ?? 0
  // Si hay algo marcado que no está entre los más usados, el catálogo se abre solo.
  const openCatalog = (form.symptoms ?? []).some((s) => !frequent.includes(s))
  const mine = [...new Set([...customSymptoms, ...(form.symptoms ?? []).filter((s) => !findCatalogSymptom(s))])]
  const chip = (name: string) => (
    <Chip key={name} selected={!!form.symptoms?.includes(name)} onClick={() => toggleSymptom(name)}>
      {symptomLabel(name)}
    </Chip>
  )
  const l = t.log

  const set = <K extends keyof DayForm>(k: K, v: DayForm[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggleSymptom = (name: string) =>
    set(
      'symptoms',
      form.symptoms?.includes(name)
        ? form.symptoms.filter((s) => s !== name)
        : [...(form.symptoms ?? []), name],
    )

  const addSymptom = async () => {
    const name = await addCustomSymptom(newSymptom)
    if (name && !form.symptoms?.includes(name)) set('symptoms', [...(form.symptoms ?? []), name])
    setNewSymptom('')
  }

  const tempInvalid = tempText.trim() !== '' && form.temperature === undefined
  const weightInvalid = weightText.trim() !== '' && form.weight === undefined

  const save = async () => {
    setSaving(true)
    await saveDay(date, form, isPeriod)
    onSaved()
  }

  return (
    <>
      <div className="max-h-[calc(92dvh-8.5rem)] space-y-6 overflow-y-auto px-4 py-5">
        {showPill && (
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4">
            <h3 id="sec-pill" className="font-bold">
              {t.pill.logLabel}
            </h3>
            <Switch checked={!!form.pillTaken} onChange={(v) => set('pillTaken', v || undefined)} labelledBy="sec-pill" />
          </div>
        )}

        {/* Periodo */}
        <section aria-labelledby="sec-period">
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4">
            <h3 id="sec-period" className="font-bold">
              {l.periodQuestion}
            </h3>
            <Switch checked={isPeriod} onChange={setIsPeriod} labelledBy="sec-period" />
          </div>
          {isPeriod && (
            <fieldset className="mt-3">
              <legend className="mb-2 text-sm font-bold text-muted">{l.flow}</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FLOW_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    selected={form.flow === o.value}
                    onClick={() => set('flow', form.flow === o.value ? undefined : o.value)}
                  >
                    <span aria-hidden="true" className="mr-1 text-primary">
                      {o.drops === 0 ? '·' : '●'.repeat(o.drops)}
                    </span>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
          )}
        </section>

        {/* Síntomas */}
        <section aria-labelledby="sec-symptoms">
          <h3 id="sec-symptoms" className="mb-2 font-bold">
            {l.symptoms}
          </h3>
          <p className="mb-2 text-sm font-bold text-muted">{l.frequentSymptoms}</p>
          <div className="flex flex-wrap gap-2">{frequent.map(chip)}</div>
          <details className="mt-3 rounded-2xl bg-surface p-3" open={openCatalog}>
            <summary className="min-h-9 cursor-pointer py-1 font-bold text-primary">
              {l.allSymptoms}
              {selectedCount > 0 && <span className="font-semibold text-muted"> · {l.selectedCount(selectedCount)}</span>}
            </summary>
            <div className="mt-2 space-y-3">
              {SYMPTOM_CATALOG.map((cat) => (
                <div key={cat.id}>
                  <h4 className="mb-1.5 text-sm font-bold text-muted">{cat.label}</h4>
                  <div className="flex flex-wrap gap-2">{cat.symptoms.map(chip)}</div>
                </div>
              ))}
              {mine.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-sm font-bold text-muted">{l.mySymptoms}</h4>
                  <div className="flex flex-wrap gap-2">{mine.map(chip)}</div>
                </div>
              )}
            </div>
          </details>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void addSymptom()
            }}
          >
            <label htmlFor="new-symptom" className="sr-only">
              {l.addSymptom}
            </label>
            <input
              id="new-symptom"
              value={newSymptom}
              maxLength={40}
              onChange={(e) => setNewSymptom(e.target.value)}
              placeholder={l.addSymptomPlaceholder}
              className="min-h-11 flex-1 rounded-full border border-line bg-surface px-4"
            />
            <button
              type="submit"
              disabled={!newSymptom.trim()}
              aria-label={l.addSymptom}
              className="grid size-11 place-items-center rounded-full bg-lavender-soft disabled:opacity-40"
            >
              <Icon name="plus" />
            </button>
          </form>
        </section>

        {/* Estado de ánimo */}
        <fieldset>
          <legend className="mb-2 font-bold">{l.mood}</legend>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {MOOD_OPTIONS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={form.mood === m.value}
                onClick={() => set('mood', form.mood === m.value ? undefined : m.value)}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-xs font-bold transition ${
                  form.mood === m.value ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
                }`}
              >
                <span aria-hidden="true" className="text-2xl">
                  {m.emoji}
                </span>
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Dolor */}
        <section aria-labelledby="sec-pain">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="sec-pain" className="font-bold">
              {l.pain}
            </h3>
            <span className="text-sm font-bold text-muted" aria-hidden="true">
              {form.pain === undefined ? l.painUnset : `${form.pain}/10`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={form.pain ?? 0}
              aria-labelledby="sec-pain"
              aria-valuetext={form.pain === undefined ? l.painUnset : l.painValue(form.pain)}
              onChange={(e) => set('pain', Number(e.target.value))}
              className={`h-11 flex-1 accent-[var(--primary)] ${form.pain === undefined ? 'opacity-40' : ''}`}
            />
            {form.pain !== undefined && (
              <Button variant="ghost" className="min-h-11 px-3 text-sm" onClick={() => set('pain', undefined)}>
                {l.clear}
              </Button>
            )}
          </div>
          <div className="flex justify-between px-1 text-xs text-muted" aria-hidden="true">
            <span>{l.painNone}</span>
            <span>{l.painMax}</span>
          </div>
        </section>

        {/* Fertilidad (opcional: Ajustes → Qué registras) */}
        {tracking && (tracking.temperature || tracking.mucus || tracking.sex || tracking.weight) && (
          <section aria-labelledby="sec-fertility" className="space-y-4">
            <h3 id="sec-fertility" className="font-bold">
              {l.fertilityTitle}
            </h3>
            {tracking.temperature && (
              <div>
                <label htmlFor="temperature" className="mb-1 block text-sm font-bold text-muted">
                  {l.temperature}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="temperature"
                    inputMode="decimal"
                    autoComplete="off"
                    value={tempText}
                    placeholder={l.temperaturePlaceholder}
                    aria-describedby="temperature-hint"
                    aria-invalid={tempInvalid}
                    onChange={(e) => {
                      setTempText(e.target.value)
                      set('temperature', parseDecimal(e.target.value, TEMPERATURE_RANGE) ?? undefined)
                    }}
                    className="min-h-12 w-32 rounded-2xl border border-line bg-surface px-4 text-lg"
                  />
                  <span className="text-muted">°C</span>
                </div>
                <p id="temperature-hint" className={`mt-1 text-xs ${tempInvalid ? 'font-bold text-danger' : 'text-muted'}`}>
                  {tempInvalid ? l.temperatureInvalid : l.temperatureHint}
                </p>
              </div>
            )}
            {tracking.mucus && (
              <fieldset>
                <legend className="mb-2 text-sm font-bold text-muted">{l.mucus}</legend>
                <div className="flex flex-wrap gap-2">
                  {MUCUS_OPTIONS.map((o) => (
                    <Chip
                      key={o.value}
                      selected={form.mucus === o.value}
                      onClick={() => set('mucus', form.mucus === o.value ? undefined : o.value)}
                    >
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            )}
            {tracking.sex && (
              <fieldset>
                <legend className="mb-2 text-sm font-bold text-muted">{l.sex}</legend>
                <div className="flex flex-wrap gap-2">
                  {SEX_OPTIONS.map((o) => (
                    <Chip
                      key={o.value}
                      selected={form.sex === o.value}
                      onClick={() => set('sex', form.sex === o.value ? undefined : o.value)}
                    >
                      {o.label}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            )}
            {tracking.weight && (
              <div>
                <label htmlFor="weight" className="mb-1 block text-sm font-bold text-muted">
                  {l.weight}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="weight"
                    inputMode="decimal"
                    autoComplete="off"
                    value={weightText}
                    placeholder={l.weightPlaceholder}
                    aria-invalid={weightInvalid}
                    aria-describedby={weightInvalid ? 'weight-error' : undefined}
                    onChange={(e) => {
                      setWeightText(e.target.value)
                      set('weight', parseDecimal(e.target.value, WEIGHT_RANGE) ?? undefined)
                    }}
                    className="min-h-12 w-32 rounded-2xl border border-line bg-surface px-4 text-lg"
                  />
                  <span className="text-muted">kg</span>
                </div>
                {weightInvalid && (
                  <p id="weight-error" className="mt-1 text-xs font-bold text-danger">
                    {l.weightInvalid}
                  </p>
                )}
              </div>
            )}
          </section>
        )}
        {tracking && !tracking.temperature && !tracking.mucus && !tracking.sex && !tracking.weight && (
          <p className="text-xs text-muted">{l.moreFieldsHint}</p>
        )}

        {/* Medicación y notas */}
        <div>
          <label htmlFor="medication" className="mb-2 block font-bold">
            {l.medication}
          </label>
          <input
            id="medication"
            value={form.medication}
            maxLength={200}
            onChange={(e) => set('medication', e.target.value)}
            placeholder={l.medicationPlaceholder}
            className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
          />
        </div>
        <div>
          <label htmlFor="notes" className="mb-2 block font-bold">
            {l.notes}
          </label>
          <textarea
            id="notes"
            value={form.notes}
            rows={3}
            maxLength={2000}
            onChange={(e) => set('notes', e.target.value)}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3"
          />
        </div>
      </div>
      <footer className="border-t border-line px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button className="w-full" disabled={saving || tempInvalid || weightInvalid} onClick={save}>
          {l.save}
        </Button>
      </footer>
    </>
  )
}
