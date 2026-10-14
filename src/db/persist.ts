/**
 * Almacenamiento persistente. Sin él, el navegador puede borrar IndexedDB cuando se
 * queda sin espacio (y Safari, tras semanas sin abrir una web no instalada). Como los
 * datos solo viven en el dispositivo, se pide en cuanto la app está en uso.
 */
export type PersistState = 'persisted' | 'notPersisted' | 'unsupported'

const storage = (): StorageManager | undefined =>
  typeof navigator !== 'undefined' && typeof navigator.storage?.persist === 'function' ? navigator.storage : undefined

export async function persistState(): Promise<PersistState> {
  const s = storage()
  if (!s) return 'unsupported'
  try {
    return (await s.persisted()) ? 'persisted' : 'notPersisted'
  } catch {
    return 'unsupported'
  }
}

/** Pide la protección si aún no está concedida. Devuelve el estado final. */
export async function requestPersistence(): Promise<PersistState> {
  const s = storage()
  if (!s) return 'unsupported'
  try {
    if (await s.persisted()) return 'persisted'
    return (await s.persist()) ? 'persisted' : 'notPersisted'
  } catch {
    return 'unsupported'
  }
}
