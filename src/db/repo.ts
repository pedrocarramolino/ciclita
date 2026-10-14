import { db, type AppDB, type DayLog } from './db'
import { periodDateSet, togglePeriodDay } from '../domain/periods'
import { findCatalogSymptom, normalize } from '../domain/symptoms'
import { today as todayISO, type ISODate } from '../domain/dates'

export type DayForm = Omit<DayLog, 'date' | 'updatedAt'>

function isEmpty(f: DayForm): boolean {
  return (
    !f.flow &&
    !f.symptoms?.length &&
    !f.mood &&
    f.pain === undefined &&
    !f.medication?.trim() &&
    !f.notes?.trim() &&
    f.temperature === undefined &&
    !f.mucus &&
    !f.sex &&
    f.weight === undefined &&
    !f.pillTaken
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
      flow: isPeriod ? form.flow : undefined,
      medication: form.medication?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
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

/** "Ha empezado mi periodo": abre un periodo en curso desde `date`. */
export async function startPeriod(
  date: ISODate = todayISO(),
  database: AppDB = db,
): Promise<void> {
  await database.transaction('rw', database.periods, async () => {
    const periods = await database.periods.toArray()
    if (periodDateSet(periods, date).has(date)) return
    // Si el periodo anterior terminó ayer, se une a él.
    const next = togglePeriodDay(periods, date, true, date).map((p) =>
      p.endDate === date ? { ...p, endDate: null } : p,
    )
    await database.periods.clear()
    await database.periods.bulkAdd(next)
  })
}

/** "Ha terminado mi periodo": cierra el periodo en curso en `date`. */
export async function endPeriod(date: ISODate = todayISO(), database: AppDB = db): Promise<void> {
  const ongoing = await database.periods.filter((p) => p.endDate === null).first()
  if (!ongoing?.id) return
  const end = date < ongoing.startDate ? ongoing.startDate : date
  await database.periods.update(ongoing.id, { endDate: end })
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
