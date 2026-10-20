import { db, type AppDB, type DayLog, type Period } from './db'
import { dateRange, periodDateSet, setPeriodDays, togglePeriodDay } from '../domain/periods'
import { findCatalogSymptom, normalize } from '../domain/symptoms'
import { today as todayISO, type ISODate } from '../domain/dates'

export type DayForm = Omit<DayLog, 'date' | 'updatedAt'>

function isEmpty(f: DayForm): boolean {
  return (
    !f.flow &&
    !f.symptoms?.length &&
    !f.moods?.length &&
    !f.mood &&
    f.pain === undefined &&
    !f.medication?.trim() &&
    !f.notes?.trim() &&
    f.temperature === undefined &&
    !f.mucus &&
    !f.sex &&
    f.weight === undefined &&
    !f.pillTaken &&
    !f.ovulationTest &&
    !f.pregnancyTest &&
    f.systolic === undefined &&
    f.diastolic === undefined &&
    f.pulse === undefined
  )
}

/** Guarda el registro de un día y actualiza los periodos si cambia "¿Tengo el periodo?". */
export async function saveDay(
  date: ISODate,
  form: DayForm,
  isPeriod: boolean,
  database: AppDB = db,
  today: ISODate = todayISO(),
): Promise<void> {
  await database.transaction('rw', database.periods, database.days, async () => {
    const periods = await database.periods.toArray()
    const wasPeriod = periodDateSet(periods, today).has(date)
    if (wasPeriod !== isPeriod) {
      const next = togglePeriodDay(periods, date, isPeriod, today)
      await database.periods.clear()
      await database.periods.bulkAdd(next)
    }

    const clean: DayForm = {
      ...form,
      moods: form.moods?.length ? form.moods : undefined,
      mood: undefined, // el formato antiguo se sustituye por `moods`
      flow: isPeriod ? form.flow : undefined,
      medication: form.medication?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    }
    // La tensión va siempre en pareja (alta y baja).
    if (clean.systolic === undefined || clean.diastolic === undefined) {
      clean.systolic = undefined
      clean.diastolic = undefined
    }
    if (isEmpty(clean)) await database.days.delete(date)
    else await database.days.put({ ...clean, date, updatedAt: Date.now() })
  })
}

/** Marca (o desmarca) la píldora de un día sin tocar el resto del registro. */
export async function setPillTaken(date: ISODate, taken: boolean, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.days, async () => {
    const { date: _d, updatedAt: _u, ...form } = (await database.days.get(date)) ?? { date, updatedAt: 0 }
    const next: DayForm = { ...form, pillTaken: taken || undefined }
    if (isEmpty(next)) await database.days.delete(date)
    else await database.days.put({ ...next, date, updatedAt: Date.now() })
  })
}

/**
 * "Ha empezado mi periodo": abre un periodo en curso desde `date`. Devuelve los
 * periodos de antes, para poder deshacerlo con restorePeriods.
 */
export async function startPeriod(
  date: ISODate = todayISO(),
  database: AppDB = db,
): Promise<Period[]> {
  return database.transaction('rw', database.periods, async () => {
    const periods = await database.periods.toArray()
    if (periodDateSet(periods, date).has(date)) return periods
    // Si el periodo anterior terminó ayer, se une a él.
    const next = togglePeriodDay(periods, date, true, date).map((p) =>
      p.endDate === date ? { ...p, endDate: null } : p,
    )
    await database.periods.clear()
    await database.periods.bulkAdd(next)
    return periods
  })
}

/** "Ha terminado mi periodo": cierra el periodo en curso en `date`. Devuelve los de antes. */
export async function endPeriod(date: ISODate = todayISO(), database: AppDB = db): Promise<Period[]> {
  return database.transaction('rw', database.periods, async () => {
    const periods = await database.periods.toArray()
    const ongoing = periods.find((p) => p.endDate === null)
    if (!ongoing?.id) return periods
    const end = date < ongoing.startDate ? ongoing.startDate : date
    await database.periods.update(ongoing.id, { endDate: end })
    return periods
  })
}

/** Estado de antes de editar periodos en el calendario, para deshacer. */
export interface PeriodEditUndo {
  periods: Period[]
  /** Registros de días a los que se quitó el flujo al dejar de ser de periodo. */
  days: DayLog[]
}

/** Marca como periodo todos los días entre `a` y `b` (ambos incluidos). */
export async function markPeriodRange(
  a: ISODate,
  b: ISODate,
  database: AppDB = db,
  today: ISODate = todayISO(),
): Promise<PeriodEditUndo> {
  return database.transaction('rw', database.periods, async () => {
    const periods = await database.periods.toArray()
    const next = setPeriodDays(periods, dateRange(a, b), true, today)
    await database.periods.clear()
    await database.periods.bulkAdd(next)
    return { periods, days: [] }
  })
}

/** Quita un día de su periodo (y el flujo de ese día, que ya no tiene sentido). */
export async function unmarkPeriodDay(
  date: ISODate,
  database: AppDB = db,
  today: ISODate = todayISO(),
): Promise<PeriodEditUndo> {
  return database.transaction('rw', database.periods, database.days, async () => {
    const periods = await database.periods.toArray()
    await database.periods.clear()
    await database.periods.bulkAdd(togglePeriodDay(periods, date, false, today))
    const day = await database.days.get(date)
    if (day?.flow) {
      const { date: _d, updatedAt: _u, flow: _f, ...rest } = day
      if (isEmpty(rest)) await database.days.delete(date)
      else await database.days.put({ ...rest, date, updatedAt: Date.now() })
    }
    return { periods, days: day?.flow ? [day] : [] }
  })
}

/**
 * Borra todo lo de un día: su registro y, si era día de periodo, lo quita del periodo.
 * Devuelve lo de antes para poder deshacerlo con undoPeriodEdit.
 */
export async function clearDay(
  date: ISODate,
  database: AppDB = db,
  today: ISODate = todayISO(),
): Promise<PeriodEditUndo> {
  return database.transaction('rw', database.periods, database.days, async () => {
    const periods = await database.periods.toArray()
    if (periodDateSet(periods, today).has(date)) {
      await database.periods.clear()
      await database.periods.bulkAdd(togglePeriodDay(periods, date, false, today))
    }
    const day = await database.days.get(date)
    if (day) await database.days.delete(date)
    return { periods, days: day ? [day] : [] }
  })
}

export async function undoPeriodEdit(u: PeriodEditUndo, database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.periods, database.days, async () => {
    await restorePeriods(u.periods, database)
    if (u.days.length) await database.days.bulkPut(u.days)
  })
}

/** Vuelve a dejar los periodos como estaban (deshacer "Ha empezado / terminado"). */
export async function restorePeriods(periods: Period[], database: AppDB = db): Promise<void> {
  await database.transaction('rw', database.periods, async () => {
    await database.periods.clear()
    await database.periods.bulkAdd(periods.map(({ startDate, endDate }) => ({ startDate, endDate })))
  })
}

/** Añade un síntoma personalizado (si no existe ya) y devuelve su nombre normalizado. */
export async function addCustomSymptom(name: string, database: AppDB = db): Promise<string | null> {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (!clean) return null
  const label = clean[0].toUpperCase() + clean.slice(1)
  // Si ya está en el catálogo, se usa ese (sin crear un duplicado).
  const inCatalog = findCatalogSymptom(label)
  if (inCatalog) return inCatalog
  const all = await database.symptoms.toArray()
  const existing = all.find((s) => normalize(s.name) === normalize(label))
  if (existing) return existing.name
  await database.symptoms.add({ name: label, builtin: false })
  return label
}
