/**
 * Bóveda: cifrado de todos los datos con el PIN.
 *
 * Con el cifrado activado, en el disco (IndexedDB) solo queda una fila `vault` con
 * los datos cifrados (AES-256-GCM, clave derivada del PIN con PBKDF2). Las tablas
 * normales se vacían: ni fechas, ni síntomas, ni notas quedan en claro.
 *
 * Al desbloquear, los datos se descifran a una base de datos EN MEMORIA con la misma
 * estructura (fake-indexeddb), que pasa a ser la `db` de la app; así el resto del
 * código no cambia. Cada escritura en esa base vuelve a cifrar y guardar la bóveda.
 * Al bloquear (o cerrar la app) la copia en memoria desaparece.
 */
import Dexie from 'dexie'
import { AppDB, diskDb, setActiveDb, type DayLog, type Period, type SettingRow, type Symptom, type VaultRow } from './db'
import { decryptJSON, deriveKey, encryptJSON, KDF_ITERATIONS, randomBytes, WrongKeyError } from '../security/crypto'

export interface Snapshot {
  periods: Period[]
  days: DayLog[]
  symptoms: Symptom[]
  settings: SettingRow[]
}

interface Session {
  disk: AppDB
  mem: AppDB
  key: CryptoKey
  salt: Uint8Array<ArrayBuffer>
  iterations: number
}

let session: Session | null = null

export const getVaultRow = (disk: AppDB = diskDb) => disk.vault.get('vault')

export async function isEncrypted(disk: AppDB = diskDb): Promise<boolean> {
  return !!(await getVaultRow(disk))
}

/** ¿La app está funcionando con los datos descifrados en memoria? */
export const isVaultUnlocked = () => session !== null

const TABLES = ['periods', 'days', 'symptoms', 'settings'] as const

export async function readSnapshot(d: AppDB): Promise<Snapshot> {
  const [periods, days, symptoms, settings] = await Promise.all([
    d.periods.toArray(),
    d.days.toArray(),
    d.symptoms.toArray(),
    d.settings.toArray(),
  ])
  return { periods, days, symptoms, settings }
}

async function writeSnapshot(d: AppDB, snap: Snapshot) {
  await d.transaction('rw', [d.periods, d.days, d.symptoms, d.settings], async () => {
    await Promise.all(TABLES.map((t) => d[t].clear()))
    await d.periods.bulkAdd(snap.periods)
    await d.days.bulkAdd(snap.days)
    await d.symptoms.bulkAdd(snap.symptoms)
    await d.settings.bulkAdd(snap.settings)
  })
}

const themeOf = (snap: Snapshot) => snap.settings.find((s) => s.key === 'theme')?.value as string | undefined

/**
 * Activa el cifrado: cifra todo lo que hay en disco con el PIN y vacía las tablas en
 * claro, en una sola transacción. Después hay que recargar la app.
 */
export async function enableEncryption(
  pin: string,
  { disk = diskDb, iterations = KDF_ITERATIONS }: { disk?: AppDB; iterations?: number } = {},
): Promise<void> {
  if (await isEncrypted(disk)) return
  const snap = await readSnapshot(disk)
  const salt = randomBytes(16)
  const key = await deriveKey(pin, salt, iterations)
  const sealed = await encryptJSON(key, snap)
  await disk.transaction('rw', [disk.periods, disk.days, disk.symptoms, disk.settings, disk.vault], async () => {
    await disk.vault.put({
      key: 'vault',
      version: 1,
      salt,
      iterations,
      iv: sealed.iv,
      data: sealed.data,
      failures: 0,
      lockedUntil: 0,
      theme: themeOf(snap),
    })
    await Promise.all(TABLES.map((t) => disk[t].clear()))
  })
}

// ---------- Guardado cifrado tras cada cambio ----------

let running: Promise<void> | null = null
let dirty = false

async function persistNow() {
  const s = session
  if (!s) return
  // El guardado se dispara desde dentro de la transacción que hizo el cambio; hay que
  // salir de ella para leer y escribir en transacciones nuevas.
  await Dexie.ignoreTransaction(async () => {
    const snap = await readSnapshot(s.mem)
    const sealed = await encryptJSON(s.key, snap)
    await s.disk.vault.update('vault', {
      salt: s.salt,
      iterations: s.iterations,
      iv: sealed.iv,
      data: sealed.data,
      theme: themeOf(snap),
    })
  })
}

function schedulePersist() {
  dirty = true
  running ??= (async () => {
    try {
      while (dirty) {
        dirty = false
        // Espera a que termine la transacción que provocó el cambio.
        await new Promise((r) => setTimeout(r, 0))
        await persistNow()
      }
    } catch (e) {
      console.error('No se pudo guardar la bóveda cifrada', e)
    } finally {
      running = null
    }
  })()
}

/** Espera a que se haya guardado (cifrado) el último cambio. */
export async function flushVault(): Promise<void> {
  while (running) await running
}

/**
 * Desbloquea: deriva la clave del PIN y descifra los datos a una base en memoria,
 * que pasa a ser la base activa de la app. Devuelve false si el PIN no es correcto.
 */
export async function unlockVault(pin: string, { disk = diskDb }: { disk?: AppDB } = {}): Promise<boolean> {
  const row = await getVaultRow(disk)
  if (!row) return false
  const key = await deriveKey(pin, row.salt, row.iterations)
  let snap: Snapshot
  try {
    snap = await decryptJSON<Snapshot>(key, { iv: row.iv, data: row.data })
  } catch (e) {
    if (e instanceof WrongKeyError) return false
    throw e
  }

  // Base de datos en memoria con la misma estructura (solo existe mientras la app está abierta).
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb')
  const mem = new AppDB('ciclita-mem', { indexedDB: new IDBFactory(), IDBKeyRange })
  let restoring = true
  mem.use({
    stack: 'dbcore',
    name: 'vault-persist',
    create: (down) => ({
      ...down,
      table: (name) => {
        const table = down.table(name)
        return {
          ...table,
          mutate: async (req) => {
            const res = await table.mutate(req)
            if (!restoring && name !== 'vault') schedulePersist()
            return res
          },
        }
      },
    }),
  })
  await mem.open()
  await writeSnapshot(mem, snap)
  restoring = false

  session = { disk, mem, key, salt: row.salt, iterations: row.iterations }
  setActiveDb(mem)
  return true
}

/** Cambia el PIN de la bóveda: nueva sal y nueva clave, y vuelve a cifrar todo. */
export async function rekeyVault(newPin: string): Promise<void> {
  if (!session) return
  const salt = randomBytes(16)
  session.key = await deriveKey(newPin, salt, session.iterations)
  session.salt = salt
  await flushVault()
  await persistNow()
}

/**
 * Desactiva el cifrado: vuelve a guardar los datos en claro en disco y borra la
 * bóveda, en una sola transacción. Después hay que recargar la app.
 */
export async function disableEncryption(): Promise<void> {
  const s = session
  if (!s) return
  await flushVault()
  const snap = await readSnapshot(s.mem)
  const d = s.disk
  await d.transaction('rw', [d.periods, d.days, d.symptoms, d.settings, d.vault], async () => {
    await writeSnapshot(d, snap)
    await d.vault.delete('vault')
  })
  await closeVaultSession()
}

/** Cierra la sesión: olvida la clave y la copia en memoria. */
export async function closeVaultSession(): Promise<void> {
  const s = session
  if (!s) return
  await flushVault()
  session = null
  setActiveDb(s.disk)
  s.mem.close()
  await Dexie.delete('ciclita-mem').catch(() => {})
}

/** Intentos fallidos y bloqueo temporal, guardados en la bóveda (en claro, sin datos). */
export const vaultLockStore = (disk: AppDB = diskDb) => ({
  async get() {
    const row = await getVaultRow(disk)
    return { failures: row?.failures ?? 0, lockedUntil: row?.lockedUntil ?? 0 }
  },
  async set(v: { failures: number; lockedUntil: number }) {
    await disk.vault.update('vault', v)
  },
})

export type { VaultRow }
