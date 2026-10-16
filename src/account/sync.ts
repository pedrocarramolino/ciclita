/**
 * Sincronización entre el dispositivo y la cuenta (Firestore).
 *
 * La app sigue trabajando con su base de datos local (funciona sin conexión); este
 * módulo sube los cambios y descarga los de otros dispositivos:
 *  - al abrir la app, al volver a ella y cada pocos minutos: descargar y subir;
 *  - tras cada cambio local (con una pequeña espera): subir.
 * Reglas de qué gana en cada caso: syncCore.ts.
 */
import Dexie from 'dexie'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type DocumentReference,
  type WriteBatch,
} from 'firebase/firestore/lite'
import { db, type Appointment } from '../db/db'
import { getSettings, setSettings } from '../db/settings'
import { today } from '../domain/dates'
import { firestore } from './firebase'
import {
  emptySyncState,
  mergePeriods,
  mergeSymptoms,
  normalizePeriods,
  pickSyncedSettings,
  planDayPush,
  planPush,
  resolveRemoteDay,
  stableHash,
  toLocalDay,
  type RemoteDay,
  type SyncState,
  type SyncedSettings,
} from './syncCore'

/** Firestore no admite `undefined`: se quitan esas claves (en profundidad). */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

const userDoc = (uid: string) => doc(firestore(), 'users', uid)
const daysCol = (uid: string) => collection(firestore(), 'users', uid, 'days')
const appointmentsCol = (uid: string) => collection(firestore(), 'users', uid, 'appointments')
const stateDoc = (uid: string, name: 'periods' | 'settings' | 'symptoms') =>
  doc(firestore(), 'users', uid, 'state', name)

/** Escrituras en lotes de como mucho 400 (Firestore admite 500 por lote). */
async function commitAll(ops: ((b: WriteBatch) => void)[]) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(firestore())
    ops.slice(i, i + 400).forEach((op) => op(batch))
    await batch.commit()
  }
}

const customSymptoms = async () =>
  (await db.symptoms.toArray()).filter((s) => !s.builtin).map((s) => s.name)

async function loadState(uid: string): Promise<{ state: SyncState; fresh: boolean }> {
  const s = (await getSettings()).sync
  return s && s.uid === uid ? { state: s, fresh: false } : { state: emptySyncState(uid), fresh: true }
}

async function saveState(prev: string, state: SyncState) {
  // Solo se escribe si cambia (cada escritura local vuelve a disparar la subida).
  if (stableHash(state) !== prev) await setSettings({ sync: state })
}

/** Descarga lo que ha cambiado en la nube y lo aplica en el dispositivo. */
export async function pull(uid: string): Promise<void> {
  const { state, fresh } = await loadState(uid)
  const before = stableHash(state)

  // Días cambiados desde la última descarga.
  const q = state.lastPull
    ? query(daysCol(uid), where('syncedAt', '>', Timestamp.fromMillis(state.lastPull)))
    : daysCol(uid)
  const snap = await getDocs(q)
  const remotes = snap.docs.map((d) => d.data() as RemoteDay & { syncedAt?: Timestamp })
  await db.transaction('rw', db.days, async () => {
    for (const r of remotes) {
      const local = await db.days.get(r.date)
      const action = resolveRemoteDay(local, r)
      if (action === 'put') await db.days.put(toLocalDay(r))
      if (action === 'delete') await db.days.delete(r.date)
      if (r.deleted) delete state.days[r.date]
      else state.days[r.date] = r.updatedAt
      const at = r.syncedAt?.toMillis?.()
      if (at && at > state.lastPull) state.lastPull = at
    }
  })

  // Citas cambiadas desde la última descarga (gana la versión más reciente de cada una).
  const apptState = (state.appointments ??= {})
  const lastAppt = state.lastPullAppointments ?? 0
  const apptSnap = await getDocs(
    lastAppt ? query(appointmentsCol(uid), where('syncedAt', '>', Timestamp.fromMillis(lastAppt))) : appointmentsCol(uid),
  )
  const apptRemotes = apptSnap.docs.map(
    (d) => d.data() as Appointment & { deleted?: boolean; syncedAt?: Timestamp },
  )
  await db.transaction('rw', db.appointments, async () => {
    for (const r of apptRemotes) {
      const local = await db.appointments.get(r.id)
      if (r.deleted) {
        if (local && local.updatedAt <= r.updatedAt) await db.appointments.delete(r.id)
        delete apptState[r.id]
      } else {
        if (!local || local.updatedAt < r.updatedAt) {
          const { syncedAt: _s, deleted: _d, ...appt } = r
          await db.appointments.put(appt)
        }
        apptState[r.id] = r.updatedAt
      }
      const at = r.syncedAt?.toMillis?.()
      if (at && at > (state.lastPullAppointments ?? 0)) state.lastPullAppointments = at
    }
  })

  const [periodsSnap, settingsSnap, symptomsSnap] = await Promise.all([
    getDoc(stateDoc(uid, 'periods')),
    getDoc(stateDoc(uid, 'settings')),
    getDoc(stateDoc(uid, 'symptoms')),
  ])

  if (periodsSnap.exists()) {
    const remote = periodsSnap.data() as { list: { startDate: string; endDate: string | null }[]; updatedAt: number }
    if (fresh || remote.updatedAt > state.periodsAt) {
      const local = await db.periods.toArray()
      // Primera vez en esta cuenta: se juntan; después, gana la nube (cambio más reciente).
      const next = fresh && local.length ? mergePeriods(local, remote.list, today()) : normalizePeriods(remote.list)
      await db.transaction('rw', db.periods, async () => {
        await db.periods.clear()
        await db.periods.bulkAdd(next)
      })
      state.periods = stableHash(normalizePeriods(remote.list))
      state.periodsAt = remote.updatedAt
    }
  }

  if (settingsSnap.exists()) {
    const remote = settingsSnap.data() as { values: SyncedSettings; updatedAt: number }
    if (fresh || remote.updatedAt > state.settingsAt) {
      await setSettings(remote.values)
      state.settings = stableHash(remote.values)
      state.settingsAt = remote.updatedAt
    }
  }

  if (symptomsSnap.exists()) {
    const remote = symptomsSnap.data() as { custom: string[]; updatedAt: number }
    if (fresh || remote.updatedAt > state.symptomsAt) {
      const local = await customSymptoms()
      const merged = mergeSymptoms(fresh ? local : [], remote.custom)
      await db.transaction('rw', db.symptoms, async () => {
        const existing = new Set(local.map((s) => s.toLowerCase()))
        const wanted = new Set(merged.map((s) => s.toLowerCase()))
        await db.symptoms.filter((s) => !s.builtin && !wanted.has(s.name.toLowerCase())).delete()
        await db.symptoms.bulkAdd(merged.filter((s) => !existing.has(s.toLowerCase())).map((name) => ({ name, builtin: false })))
      })
      state.symptoms = stableHash(mergeSymptoms([], remote.custom))
      state.symptomsAt = remote.updatedAt
    }
  }

  await saveState(fresh ? '' : before, state)
}

/** Sube lo que ha cambiado en el dispositivo desde la última sincronización. */
export async function push(uid: string): Promise<void> {
  const { state, fresh } = await loadState(uid)
  const before = stableHash(state)
  const [days, periods, settings, symptoms, appointments] = await Promise.all([
    db.days.toArray(),
    db.periods.toArray(),
    getSettings(),
    customSymptoms(),
    db.appointments.toArray(),
  ])
  const now = Date.now()
  const ops: ((b: WriteBatch) => void)[] = []
  const set = (ref: DocumentReference, data: object) => ops.push((b) => b.set(ref, { ...clean(data), syncedAt: serverTimestamp() }))

  const plan = planDayPush(days, state.days)
  for (const d of plan.upserts) set(doc(daysCol(uid), d.date), d)
  for (const date of plan.deletes) set(doc(daysCol(uid), date), { date, deleted: true, updatedAt: now })

  const apptState = (state.appointments ??= {})
  const apptPlan = planPush(appointments, (a) => a.id, apptState)
  for (const a of apptPlan.upserts) set(doc(appointmentsCol(uid), a.id), a)
  for (const id of apptPlan.deletes) set(doc(appointmentsCol(uid), id), { id, deleted: true, updatedAt: now })

  const periodList = normalizePeriods(periods)
  const periodsHash = stableHash(periodList)
  if (periodsHash !== state.periods) set(stateDoc(uid, 'periods'), { list: periodList, updatedAt: now })

  const values = clean(pickSyncedSettings(settings))
  const settingsHash = stableHash(values)
  if (settingsHash !== state.settings) set(stateDoc(uid, 'settings'), { values, updatedAt: now })

  const custom = mergeSymptoms([], symptoms)
  const symptomsHash = stableHash(custom)
  if (symptomsHash !== state.symptoms) set(stateDoc(uid, 'symptoms'), { custom, updatedAt: now })

  if (!ops.length) return saveState(fresh ? '' : before, state)
  await commitAll(ops)

  for (const d of plan.upserts) state.days[d.date] = d.updatedAt
  for (const date of plan.deletes) delete state.days[date]
  for (const a of apptPlan.upserts) apptState[a.id] = a.updatedAt
  for (const id of apptPlan.deletes) delete apptState[id]
  if (periodsHash !== state.periods) [state.periods, state.periodsAt] = [periodsHash, now]
  if (settingsHash !== state.settings) [state.settings, state.settingsAt] = [settingsHash, now]
  if (symptomsHash !== state.symptoms) [state.symptoms, state.symptomsAt] = [symptomsHash, now]
  await saveState('', state)
}

// ---------- Motor: cuándo sincronizar ----------

let running: Promise<void> | null = null
let pending: 'push' | 'full' | null = null

/** Sincroniza (sin solaparse: si ya hay una en marcha, se repite al terminar). */
export function syncNow(uid: string, mode: 'push' | 'full' = 'full', onError?: (e: unknown) => void): Promise<void> {
  if (running) {
    pending = pending === 'full' || mode === 'full' ? 'full' : 'push'
    return running
  }
  running = (async () => {
    let next: 'push' | 'full' | null = mode
    while (next) {
      pending = null
      try {
        if (next === 'full') await pull(uid)
        await push(uid)
        onError?.(null)
      } catch (e) {
        console.error('No se pudo sincronizar', e)
        onError?.(e)
      }
      next = pending
    }
  })().finally(() => {
    running = null
  })
  return running
}

/** Espera a que termine la sincronización en curso (p. ej. antes de cerrar sesión). */
export async function flushSync(): Promise<void> {
  while (running) await running
}

const PUSH_DELAY_MS = 1500
const PULL_EVERY_MS = 5 * 60_000

/**
 * Pone en marcha la sincronización automática para la cuenta `uid`. Devuelve la
 * función para pararla.
 */
export function startAutoSync(uid: string, onError: (e: unknown) => void, onFirstSync?: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const onChange = () => {
    clearTimeout(timer)
    timer = setTimeout(() => void syncNow(uid, 'push', onError), PUSH_DELAY_MS)
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow(uid, 'full', onError)
  }
  Dexie.on('storagemutated', onChange)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onVisible)
  const interval = setInterval(onVisible, PULL_EVERY_MS)
  // La primera (al iniciar sesión en un dispositivo nuevo trae los datos de la cuenta).
  void syncNow(uid, 'full', onError).finally(() => onFirstSync?.())
  return () => {
    clearTimeout(timer)
    clearInterval(interval)
    Dexie.on.storagemutated.unsubscribe(onChange)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onVisible)
  }
}

/**
 * Borra de la nube los registros de la cuenta y, si `withProfile`, también el perfil
 * (al eliminar la cuenta). Sin el perfil, la cuenta sigue existiendo pero vacía.
 */
export async function deleteCloudData(uid: string, { withProfile = true }: { withProfile?: boolean } = {}): Promise<void> {
  await flushSync()
  const [days, appts] = await Promise.all([getDocs(daysCol(uid)), getDocs(appointmentsCol(uid))])
  const ops: ((b: WriteBatch) => void)[] = [...days.docs, ...appts.docs].map((d) => (b) => b.delete(d.ref))
  for (const name of ['periods', 'settings', 'symptoms'] as const) ops.push((b) => b.delete(stateDoc(uid, name)))
  if (withProfile) ops.push((b) => b.delete(userDoc(uid)))
  await commitAll(ops)
}

export { userDoc }
