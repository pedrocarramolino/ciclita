import Dexie from 'dexie'
import { AppDB, db, LEGACY_DB_NAME } from './db'

/**
 * Migración única del nombre de la base de datos ('registro-mensual' → 'ciclita').
 *
 * Si existe la base de datos antigua, copia todo a la nueva y borra la antigua.
 * Si la nueva ya tiene datos, no sobrescribe nada y conserva la antigua.
 * Devuelve true si se migraron datos.
 */
export async function migrateLegacyDb(target: AppDB = db, legacyName = LEGACY_DB_NAME): Promise<boolean> {
  if (!(await Dexie.exists(legacyName))) return false

  const legacy = new AppDB(legacyName)
  let copied = false
  let legacyEmpty = false
  try {
    await legacy.open()
    const [periods, days, symptoms, settings] = await Promise.all([
      legacy.periods.toArray(),
      legacy.days.toArray(),
      legacy.symptoms.toArray(),
      legacy.settings.toArray(),
    ])
    legacyEmpty = !periods.length && !days.length && !settings.length

    if (!legacyEmpty) {
      await target.transaction('rw', [target.periods, target.days, target.symptoms, target.settings], async () => {
        const targetHasData = (await target.settings.count()) > 0 || (await target.periods.count()) > 0
        if (targetHasData) return
        // La base nueva se crea con los síntomas predefinidos: se sustituyen por los de la antigua
        // (que incluyen los predefinidos y los personalizados).
        await target.symptoms.clear()
        await target.symptoms.bulkAdd(symptoms)
        await target.periods.bulkAdd(periods)
        await target.days.bulkAdd(days)
        await target.settings.bulkAdd(settings)
        copied = true
      })
    }
  } finally {
    legacy.close()
  }

  if (copied || legacyEmpty) await Dexie.delete(legacyName)
  return copied
}
