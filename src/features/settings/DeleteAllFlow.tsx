import { useState } from 'react'
import { currentUid } from '../../account/account'
import { wipeDevice } from '../../account/leave'
import { deleteCloudData } from '../../account/sync'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { t } from '../../i18n'

/** Borrado total con doble confirmación: aviso + escribir "BORRAR". */
export function DeleteAllFlow({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [error, setError] = useState('')
  const s = t.settings

  const wipe = async () => {
    // Primero los registros de la cuenta (si no, volverían al sincronizar). Sin conexión
    // no se borra nada, para no dejar la nube y el dispositivo distintos.
    const uid = currentUid()
    if (uid) {
      try {
        await deleteCloudData(uid, { withProfile: false })
      } catch (e) {
        console.error(e)
        setError(s.deleteCloudFailed)
        setStep(1)
        return
      }
    }
    await wipeDevice()
  }

  return step === 1 ? (
    <ConfirmDialog title={s.deleteTitle} danger onConfirm={() => setStep(2)} onCancel={onCancel}>
      {error && (
        <span role="alert" className="mb-2 block font-bold text-danger">
          {error}
        </span>
      )}
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
