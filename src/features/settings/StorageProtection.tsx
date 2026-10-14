import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { persistState, requestPersistence, type PersistState } from '../../db/persist'
import { t } from '../../i18n'

/** Estado de la protección frente al borrado automático del navegador. */
export function StorageProtection() {
  const [state, setState] = useState<PersistState | null>(null)
  const [denied, setDenied] = useState(false)
  const s = t.settings

  useEffect(() => {
    void persistState().then(setState)
  }, [])

  if (!state || state === 'unsupported') return null

  const protect = async () => {
    const next = await requestPersistence()
    setState(next)
    setDenied(next !== 'persisted')
  }

  return (
    <div className="rounded-2xl bg-surface-soft p-4">
      <p className="flex items-center gap-2 font-bold">
        <Icon name="shield" className="size-5" />
        {s.storageTitle}
      </p>
      <p className="mt-1 text-sm">{state === 'persisted' ? s.storagePersisted : s.storageNotPersisted}</p>
      {state !== 'persisted' && (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => void protect()}>
          {s.storageProtect}
        </Button>
      )}
      <p role="status" className="mt-2 text-sm font-bold empty:hidden">
        {denied ? s.storageDenied : ''}
      </p>
    </div>
  )
}
