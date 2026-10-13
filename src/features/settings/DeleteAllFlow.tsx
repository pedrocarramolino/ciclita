import { useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { wipeAll } from '../../db/data'
import { getSettings } from '../../db/settings'
import { unregisterPush, unsubscribeBrowserPush } from '../../push/pushClient'
import { t } from '../../i18n'

/** Borrado total con doble confirmación: aviso + escribir "BORRAR". */
export function DeleteAllFlow({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const s = t.settings

  const wipe = async () => {
    // Primero se borra lo que haya en el servidor de avisos (si falla, se borra igual en local).
    // Con los datos cifrados y bloqueados no hay credenciales: al menos se cancela la
    // suscripción del navegador para que dejen de llegar avisos.
    const { pushDevice } = await getSettings().catch(() => ({ pushDevice: null }))
    await unregisterPush(pushDevice).catch(() => {})
    await unsubscribeBrowserPush().catch(() => {})
    await wipeAll()
    history.replaceState(null, '', location.pathname)
    location.reload()
  }

  return step === 1 ? (
    <ConfirmDialog title={s.deleteTitle} danger onConfirm={() => setStep(2)} onCancel={onCancel}>
      {s.deleteBody}
    </ConfirmDialog>
  ) : (
    <ConfirmDialog
      title={s.deleteTitle2}
      danger
      confirmLabel={s.deleteConfirm}
      typeToConfirm={s.deleteWord}
      typeLabel={s.deleteInputLabel}
      onConfirm={() => void wipe()}
      onCancel={onCancel}
    >
      {s.deleteBody2}
    </ConfirmDialog>
  )
}
