import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { Button } from '../../components/Button'
import { Chip } from '../../components/Chip'
import { Icon, type IconName } from '../../components/Icon'
import { Switch } from '../../components/Switch'
import { db, type DayLog } from '../../db/db'
import {
  addCustomSymptom,
  clearDay,
  markPeriodEnd,
  markPeriodStart,
  type DayForm,
  type PeriodEditUndo,
  saveDay,
  undoPeriodEdit,
  unmarkPeriodDay,
} from '../../db/repo'
import { addDays, diffDays, formatLong, today, type ISODate } from '../../domain/dates'
import { MAX_ONGOING_DAYS, periodDateSet, periodEnd } from '../../domain/periods'
import { pillDay } from '../../domain/pill'
import { symptomLabel, t } from '../../i18n'
import {
  FLOW_OPTIONS,
  dayMoods,
  formatBloodPressure,
  parseBloodPressure,
  parseWhole,
  PULSE_RANGE,
  TEST_OPTIONS,
  MOOD_OPTIONS,
  MUCUS_OPTIONS,
  parseDecimal,
  SEX_OPTIONS,
  TEMPERATURE_RANGE,
  WEIGHT_RANGE,
} from '../../domain/options'
import { getSettings, type TrackingSettings } from '../../db/settings'
import {
  DEFAULT_FREQUENT,
  findCatalogSymptom,
  frequentSymptoms,
  PERIMENOPAUSE_FREQUENT,
  PREGNANCY_FREQUENT,
  SYMPTOM_CATALOG,
} from '../../domain/symptoms'
import { pregnancyChance, showsPregnancyChance } from '../../domain/fertility'
import { DEFAULT_PERIOD_LENGTH } from '../../domain/prediction'
import { usePrediction } from '../../usePrediction'
import { PregnancyChanceBadge } from '../home/PregnancyChanceBadge'

/** Lo que el formulario expone a la hoja: guardar antes de pasar a otro día. */
interface FormHandle {
  /** Guarda si hay cambios. false si algún dato no es válido (y lo muestra). */
  flush: () => Promise<boolean>
}

/**
 * Hoja modal con el registro de un día. Arriba, la semana para pasar a otro día;
 * luego notas, el periodo y una cuadrícula con cada tipo de registro, que se abre al
 * tocarlo. Usa <dialog> nativo (foco atrapado, Escape cierra).
 */
export function DaySheet({
  date,
  onClose,
  onCleared,
}: {
  date: ISODate
  onClose: () => void
  /** Tras "Borrar el registro de este día", con lo de antes para poder deshacerlo. */
  onCleared?: (undo: PeriodEditUndo) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const formRef = useRef<FormHandle>(null)
  const titleId = useId()
  const [current, setCurrent] = useState(date)
  const [week, setWeek] = useState(() => weekStart(date))
  const now = today()

  const data = useLiveQuery(async () => {
    const [day, periods, settings, logged] = await Promise.all([
      db.days.get(current),
      db.periods.toArray(),
      getSettings(),
      db.days.where('date').between(week, addDays(week, 6), true, true).primaryKeys(),
    ])
    const periodDays = periodDateSet(periods, now)
    // Periodo empezado en o antes de este día (para "Día N del periodo" y "Fin").
    const last = periods
      .filter((p) => p.startDate <= current)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .at(-1)
    const isPeriod = periodDays.has(current)
    return {
      date: current,
      day,
      isPeriod,
      periodDay: isPeriod && last ? diffDays(last.startDate, current) + 1 : null,
      isPeriodEnd: isPeriod && !!last?.endDate && periodEnd(last, now) === current,
      canEnd: !!last && diffDays(last.startDate, current) + 1 <= MAX_ONGOING_DAYS,
      weekPeriod: new Set([...Array(7)].map((_, i) => addDays(week, i)).filter((d) => periodDays.has(d))),
      weekLogged: new Set(logged as ISODate[]),
      showChance: showsPregnancyChance(settings),
    }
  }, [current, week, now])
  const prediction = usePrediction()
  const chance = data?.showChance ? pregnancyChance(current, prediction, now) : null

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

  // Al cambiar de día se guarda lo que se haya cambiado en el que estaba abierto.
  const pick = async (d: ISODate) => {
    if (d === current || d > now) return
    if (formRef.current && !(await formRef.current.flush())) return
    setCurrent(d)
    setWeek(weekStart(d))
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => e.target === ref.current && close()}
      className="m-0 mt-auto h-[92dvh] max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-3xl bg-bg p-0 text-ink shadow-2xl backdrop:bg-black/40 open:flex sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      <header className="shrink-0 border-b border-line px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-lg font-extrabold" aria-live="polite">
            {formatLong(current)}
          </h2>
          <button
            type="button"
            onClick={close}
            className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-surface-soft"
            aria-label={t.log.close}
          >
            <Icon name="x" />
          </button>
        </div>
        {chance && (
          <div className="mt-1">
            <PregnancyChanceBadge chance={chance} today={false} />
          </div>
        )}
        <WeekStrip
          start={week}
          selected={current}
          today={now}
          periodDays={data?.weekPeriod}
          loggedDays={data?.weekLogged}
          onPick={(d) => void pick(d)}
          onShift={(n) => setWeek((w) => addDays(w, 7 * n))}
        />
      </header>
      {data && data.date === current && (
        <DayFormView
          key={current}
          ref={formRef}
          date={current}
          initial={data.day}
          isPeriod={data.isPeriod}
          periodDay={data.periodDay}
          isPeriodEnd={data.isPeriodEnd}
          canEnd={data.canEnd}
          periodLength={prediction?.periodLength ?? DEFAULT_PERIOD_LENGTH}
          onSaved={close}
          onClear={
            data.day || data.isPeriod
              ? async () => {
                  const undo = await clearDay(current)
                  close()
                  onCleared?.(undo)
                }
              : undefined
          }
        />
      )}
    </dialog>
  )
}

/** Lunes de la semana de `d`. */
function weekStart(d: ISODate): ISODate {
  const wd = (new Date(`${d}T12:00:00`).getDay() + 6) % 7
  return addDays(d, -wd)
}

/** Semana (de lunes a domingo) para pasar de un día a otro sin cerrar la hoja. */
function WeekStrip({
  start,
  selected,
  today,
  periodDays,
  loggedDays,
  onPick,
  onShift,
}: {
  start: ISODate
  selected: ISODate
  today: ISODate
  periodDays?: Set<ISODate>
  loggedDays?: Set<ISODate>
  onPick: (d: ISODate) => void
  onShift: (n: number) => void
}) {
  const c = t.calendar
  const days = [...Array(7)].map((_, i) => addDays(start, i))
  const canNext = addDays(start, 7) <= today
  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        type="button"
        onClick={() => onShift(-1)}
        aria-label={t.log.prevWeek}
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-soft"
      >
        <Icon name="chevronLeft" />
      </button>
      <ol className="grid flex-1 grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const isSel = d === selected
          const isPeriod = !!periodDays?.has(d)
          return (
            <li key={d}>
              <button
                type="button"
                disabled={d > today}
                aria-current={isSel ? 'date' : undefined}
                aria-label={[formatLong(d), isPeriod ? c.period : '', loggedDays?.has(d) ? c.logged : ''].filter(Boolean).join(', ')}
                onClick={() => onPick(d)}
                className="flex w-full flex-col items-center gap-0.5 rounded-2xl py-1 disabled:opacity-40"
              >
                <span className="text-xs font-bold text-muted">{c.weekdays[i]}</span>
                <span
                  className={`grid size-9 place-items-center rounded-full text-base font-extrabold ${
                    isSel ? 'bg-primary text-on-primary' : isPeriod ? 'text-primary' : ''
                  } ${d === today && !isSel ? 'outline-2 outline-ink' : ''}`}
                >
                  {Number(d.slice(8))}
                </span>
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${loggedDays?.has(d) ? 'bg-accent' : 'bg-transparent'}`}
                />
              </button>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        onClick={() => onShift(1)}
        disabled={!canNext}
        aria-label={t.log.nextWeek}
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-soft disabled:opacity-30"
      >
        <Icon name="chevronRight" />
      </button>
    </div>
  )
}

type SectionKey =
  | 'symptoms'
  | 'mood'
  | 'pain'
  | 'medication'
  | 'temperature'
  | 'mucus'
  | 'sex'
  | 'weight'
  | 'tests'
  | 'pressure'

/** Icono (emoji) y color de fondo de cada recuadro. */
const TILES: Record<SectionKey, { emoji: string; tone: string; tracking?: keyof TrackingSettings }> = {
  symptoms: { emoji: '🤕', tone: 'bg-rose-soft' },
  mood: { emoji: '😊', tone: 'bg-lavender-soft' },
  pain: { emoji: '⚡', tone: 'bg-primary-soft' },
  medication: { emoji: '💊', tone: 'bg-lavender-soft' },
  temperature: { emoji: '🌡️', tone: 'bg-rose-soft', tracking: 'temperature' },
  mucus: { emoji: '💧', tone: 'bg-lavender-soft', tracking: 'mucus' },
  sex: { emoji: '❤️', tone: 'bg-primary-soft', tracking: 'sex' },
  weight: { emoji: '⚖️', tone: 'bg-lavender-soft', tracking: 'weight' },
  tests: { emoji: '🧪', tone: 'bg-lavender-soft', tracking: 'tests' },
  pressure: { emoji: '🩺', tone: 'bg-rose-soft', tracking: 'bloodPressure' },
}

const formFrom = (d?: DayLog): DayForm => ({
  flow: d?.flow,
  symptoms: d?.symptoms ?? [],
  moods: dayMoods(d),
  pain: d?.pain,
  medication: d?.medication ?? '',
  notes: d?.notes ?? '',
  temperature: d?.temperature,
  mucus: d?.mucus,
  sex: d?.sex,
  weight: d?.weight,
  pillTaken: d?.pillTaken,
  ovulationTest: d?.ovulationTest,
  pregnancyTest: d?.pregnancyTest,
  systolic: d?.systolic,
  diastolic: d?.diastolic,
  pulse: d?.pulse,
})

function DayFormView({
  ref,
  date,
  initial,
  isPeriod,
  periodDay,
  isPeriodEnd,
  canEnd,
  periodLength,
  onSaved,
  onClear,
}: {
  ref: Ref<FormHandle>
  date: ISODate
  initial: DayLog | undefined
  /** Si el día es de periodo (al momento: los botones de periodo se aplican enseguida). */
  isPeriod: boolean
  periodDay: number | null
  isPeriodEnd: boolean
  canEnd: boolean
  periodLength: number
  onSaved: () => void
  /** Solo si el día tiene algo guardado. */
  onClear?: () => Promise<void>
}) {
  const [saved] = useState(() => formFrom(initial))
  const [form, setForm] = useState<DayForm>(saved)
  const [view, setView] = useState<SectionKey | null>(null)
  // Texto de los campos numéricos (admiten coma decimal); el número se valida al escribir.
  const toText = (n?: number) => (n === undefined ? '' : t.report.decimal(n))
  const [tempText, setTempText] = useState(() => toText(initial?.temperature))
  const [weightText, setWeightText] = useState(() => toText(initial?.weight))
  const [pressureText, setPressureText] = useState(() => (initial ? formatBloodPressure(initial) : ''))
  const [pulseText, setPulseText] = useState(() => (initial?.pulse === undefined ? '' : String(initial.pulse)))
  const [periodMsg, setPeriodMsg] = useState<{ text: string; undo?: PeriodEditUndo } | null>(null)
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
      const defaults =
        settings.mode === 'perimenopause'
          ? PERIMENOPAUSE_FREQUENT
          : settings.mode === 'pregnancy'
            ? PREGNANCY_FREQUENT
            : DEFAULT_FREQUENT
      return frequentSymptoms(days, 8, defaults)
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
  // Se pueden marcar varios estados de ánimo; tocar uno marcado lo quita.
  const toggleMood = (value: string) =>
    setForm((f) => ({
      ...f,
      moods: f.moods?.includes(value) ? f.moods.filter((m) => m !== value) : [...(f.moods ?? []), value],
    }))
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
  const pressureInvalid = pressureText.trim() !== '' && form.systolic === undefined
  const pulseInvalid = pulseText.trim() !== '' && form.pulse === undefined
  const invalidSection: SectionKey | null = tempInvalid
    ? 'temperature'
    : weightInvalid
      ? 'weight'
      : pressureInvalid || pulseInvalid
        ? 'pressure'
        : null

  useImperativeHandle(ref, () => ({
    flush: async () => {
      if (invalidSection) {
        setView(invalidSection)
        return false
      }
      if (JSON.stringify(form) !== JSON.stringify(saved)) await saveDay(date, form, isPeriod)
      return true
    },
  }))

  const save = async () => {
    setSaving(true)
    await saveDay(date, form, isPeriod)
    onSaved()
  }

  const periodAction = async (action: () => Promise<PeriodEditUndo | null>, done: string) => {
    const undo = await action()
    setPeriodMsg(undo ? { text: done, undo } : { text: l.periodEndNone })
  }

  const visible = (Object.keys(TILES) as SectionKey[]).filter((k) => {
    const need = TILES[k].tracking
    return !need || !!tracking?.[need]
  })

  const option = <V extends string>(opts: { value: V; label: string }[], v?: V) => opts.find((o) => o.value === v)?.label
  const summary: Record<SectionKey, string> = {
    symptoms: selectedCount ? l.selectedCount(selectedCount) : '',
    mood: (form.moods ?? [])
      .map((m) => MOOD_OPTIONS.find((o) => o.value === m)?.emoji)
      .slice(0, 4)
      .join(''),
    pain: form.pain === undefined ? '' : `${form.pain}/10`,
    medication: form.medication?.trim() ?? '',
    temperature: form.temperature === undefined ? '' : `${t.report.decimal(form.temperature)} °C`,
    mucus: option(MUCUS_OPTIONS, form.mucus) ?? '',
    sex: option(SEX_OPTIONS, form.sex) ?? '',
    weight: form.weight === undefined ? '' : `${t.report.decimal(form.weight)} kg`,
    tests: [
      form.ovulationTest && `${l.ovulationShort}: ${option(TEST_OPTIONS, form.ovulationTest)?.toLowerCase()}`,
      form.pregnancyTest && `${l.pregnancyShort}: ${option(TEST_OPTIONS, form.pregnancyTest)?.toLowerCase()}`,
    ]
      .filter(Boolean)
      .join(' · '),
    pressure: [formatBloodPressure(form), form.pulse !== undefined && `${form.pulse} ${l.pulseUnit}`].filter(Boolean).join(' · '),
  }

  const sections: Record<SectionKey, () => ReactNode> = {
    symptoms: () => (
      <section aria-labelledby="sec-symptoms">
        <h3 id="sec-symptoms" className="sr-only">
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
    ),
    mood: () => (
      <fieldset>
        <legend className="font-bold">{l.mood}</legend>
        <p className="mb-2 text-sm text-muted">{l.moodHint}</p>
        <div className="grid grid-cols-4 gap-2">
          {MOOD_OPTIONS.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={!!form.moods?.includes(m.value)}
              onClick={() => toggleMood(m.value)}
              className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-xs font-bold transition ${
                form.moods?.includes(m.value) ? 'border-primary bg-primary-soft' : 'border-line bg-surface'
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
    ),
    pain: () => (
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
    ),
    medication: () => (
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
    ),
    temperature: () => (
      <div>
        <label htmlFor="temperature" className="mb-1 block font-bold">
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
    ),
    mucus: () => (
      <fieldset>
        <legend className="mb-2 font-bold">{l.mucus}</legend>
        <div className="flex flex-wrap gap-2">
          {MUCUS_OPTIONS.map((o) => (
            <Chip key={o.value} selected={form.mucus === o.value} onClick={() => set('mucus', form.mucus === o.value ? undefined : o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </fieldset>
    ),
    sex: () => (
      <fieldset>
        <legend className="mb-2 font-bold">{l.sex}</legend>
        <div className="flex flex-wrap gap-2">
          {SEX_OPTIONS.map((o) => (
            <Chip key={o.value} selected={form.sex === o.value} onClick={() => set('sex', form.sex === o.value ? undefined : o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </fieldset>
    ),
    weight: () => (
      <div>
        <label htmlFor="weight" className="mb-1 block font-bold">
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
    ),
    tests: () => (
      <div className="space-y-4">
        {(['ovulationTest', 'pregnancyTest'] as const).map((k) => (
          <fieldset key={k}>
            <legend className="mb-2 font-bold">{l[k]}</legend>
            <div className="flex flex-wrap gap-2">
              {TEST_OPTIONS.map((o) => (
                <Chip key={o.value} selected={form[k] === o.value} onClick={() => set(k, form[k] === o.value ? undefined : o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    ),
    pressure: () => (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-4">
          <div>
            <label htmlFor="pressure" className="mb-1 block font-bold">
              {l.pressure}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="pressure"
                inputMode="numeric"
                autoComplete="off"
                value={pressureText}
                placeholder={l.pressurePlaceholder}
                aria-invalid={pressureInvalid}
                aria-describedby="pressure-hint"
                onChange={(e) => {
                  setPressureText(e.target.value)
                  const bp = parseBloodPressure(e.target.value)
                  setForm((f) => ({ ...f, systolic: bp?.systolic, diastolic: bp?.diastolic }))
                }}
                className="min-h-12 w-32 rounded-2xl border border-line bg-surface px-4 text-lg"
              />
              <span className="text-muted">mmHg</span>
            </div>
          </div>
          <div>
            <label htmlFor="pulse" className="mb-1 block font-bold">
              {l.pulse}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="pulse"
                inputMode="numeric"
                autoComplete="off"
                value={pulseText}
                placeholder={l.pulsePlaceholder}
                aria-invalid={pulseInvalid}
                aria-describedby="pressure-hint"
                onChange={(e) => {
                  setPulseText(e.target.value)
                  set('pulse', parseWhole(e.target.value, PULSE_RANGE) ?? undefined)
                }}
                className="min-h-12 w-24 rounded-2xl border border-line bg-surface px-4 text-lg"
              />
              <span className="text-muted">{l.pulseUnit}</span>
            </div>
          </div>
        </div>
        <p id="pressure-hint" className={`text-xs ${pressureInvalid || pulseInvalid ? 'font-bold text-danger' : 'text-muted'}`}>
          {pressureInvalid ? l.pressureInvalid : pulseInvalid ? l.pulseInvalid : l.pressureHint}
        </p>
      </div>
    ),
  }
  const titles: Record<SectionKey, string> = {
    symptoms: l.symptoms,
    mood: l.mood,
    pain: l.pain,
    medication: l.medication,
    temperature: l.temperatureShort,
    mucus: l.mucus,
    sex: l.sex,
    weight: l.weight,
    tests: l.testsTitle,
    pressure: l.pressureTitle,
  }

  return (
    <>
      {/* Solo esta parte se desplaza (y sin arrastrar la pantalla de debajo). */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {view ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setView(null)}
              className="-ml-2 flex min-h-11 items-center gap-1 rounded-full pr-3 pl-1 font-bold text-primary hover:bg-surface-soft"
            >
              <Icon name="chevronLeft" />
              {l.backToAll}
            </button>
            <h3 className="flex items-center gap-3 text-xl font-extrabold">
              <span aria-hidden="true" className={`grid size-10 place-items-center rounded-full text-xl ${TILES[view].tone}`}>
                {TILES[view].emoji}
              </span>
              {titles[view]}
            </h3>
            {sections[view]()}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-surface p-3 shadow-sm">
              <label htmlFor="notes" className="mb-1 block text-sm font-bold text-muted">
                {l.notes}
              </label>
              <textarea
                id="notes"
                value={form.notes}
                rows={2}
                maxLength={2000}
                placeholder={l.notesPlaceholder}
                onChange={(e) => set('notes', e.target.value)}
                className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2"
              />
            </div>

            {showPill && (
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-4 shadow-sm">
                <h3 id="sec-pill" className="font-bold">
                  {t.pill.logLabel}
                </h3>
                <Switch checked={!!form.pillTaken} onChange={(v) => set('pillTaken', v || undefined)} labelledBy="sec-pill" />
              </div>
            )}

            {/* Periodo: se aplica al momento (como en el calendario) y se puede deshacer. */}
            {isPeriod ? (
              <section aria-labelledby="sec-period" className="rounded-2xl bg-rose-soft p-4">
                <h3 id="sec-period" className="flex items-center gap-2 font-extrabold">
                  <Icon name="drop" />
                  {periodDay ? l.periodDayN(periodDay) : t.calendar.period}
                </h3>
                <fieldset className="mt-3">
                  <legend className="mb-2 text-sm font-bold">{l.flow}</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {FLOW_OPTIONS.map((o) => (
                      <Chip key={o.value} selected={form.flow === o.value} onClick={() => set('flow', form.flow === o.value ? undefined : o.value)}>
                        <span aria-hidden="true" className="mr-1 text-primary">
                          {o.drops === 0 ? '·' : '●'.repeat(o.drops)}
                        </span>
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!isPeriodEnd && (
                    <Button
                      variant="secondary"
                      className="min-h-11 flex-1 px-3 text-sm"
                      onClick={() => void periodAction(() => markPeriodEnd(date), l.periodEndedHere)}
                    >
                      {l.periodEndHere}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    className="min-h-11 flex-1 px-3 text-sm"
                    onClick={() => void periodAction(() => unmarkPeriodDay(date), l.periodDayRemoved)}
                  >
                    {l.periodRemoveDay}
                  </Button>
                </div>
              </section>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <PeriodButton
                  icon="drop"
                  label={l.periodStart}
                  onClick={() => void periodAction(() => markPeriodStart(date, periodLength), l.periodStarted)}
                />
                <PeriodButton
                  icon="check"
                  label={l.periodEnd}
                  disabled={!canEnd}
                  onClick={() => void periodAction(() => markPeriodEnd(date), l.periodEndedHere)}
                />
              </div>
            )}
            {periodMsg && (
              <p role="status" className="flex items-center justify-between gap-3 rounded-2xl bg-surface-soft px-4 py-2 text-sm">
                <span>{periodMsg.text}</span>
                {periodMsg.undo && (
                  <button
                    type="button"
                    className="min-h-11 shrink-0 font-bold text-primary"
                    onClick={() => {
                      const u = periodMsg.undo!
                      setPeriodMsg(null)
                      void undoPeriodEdit(u)
                    }}
                  >
                    {t.home.undo}
                  </button>
                )}
              </p>
            )}

            <ul className="grid grid-cols-3 gap-3">
              {visible.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    onClick={() => setView(k)}
                    className={`flex h-full min-h-28 w-full flex-col items-center gap-1.5 rounded-2xl border bg-surface p-2 pt-3 text-center shadow-sm hover:bg-surface-soft ${
                      summary[k] ? 'border-primary/50' : 'border-transparent'
                    }`}
                  >
                    <span aria-hidden="true" className={`grid size-12 place-items-center rounded-full text-2xl ${TILES[k].tone}`}>
                      {TILES[k].emoji}
                    </span>
                    <span className="text-sm leading-tight font-bold">{titles[k]}</span>
                    {summary[k] && <span className="line-clamp-2 text-xs leading-tight text-muted">{summary[k]}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {tracking && visible.length <= 4 && <p className="text-xs text-muted">{l.moreFieldsHint}</p>}
          </div>
        )}
      </div>
      <footer className="shrink-0 border-t border-line bg-bg px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button className="w-full" disabled={saving || !!invalidSection} onClick={save}>
          {l.save}
        </Button>
        {onClear && !view && (
          <Button variant="ghost" className="mt-1 min-h-11 w-full py-2 text-sm text-danger" disabled={saving} onClick={() => void onClear()}>
            {l.clearDay}
          </Button>
        )}
      </footer>
    </>
  )
}

function PeriodButton({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: IconName
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl bg-surface p-3 text-center font-bold shadow-sm hover:bg-surface-soft disabled:opacity-40"
    >
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-primary text-on-primary">
        <Icon name={icon} />
      </span>
      {label}
    </button>
  )
}

