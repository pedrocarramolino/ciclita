import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { getSettings } from '../../db/settings'
import { t } from '../../i18n'
import { isIOS, isStandalone } from '../../platform'
import { permission, requestPermission, syncPush } from '../../push/pushClient'
import { problemKey, reminderProblem } from '../../push/reminderStatus'
import type { Prediction } from '../../domain/prediction'

/** Aviso ocultado en este dispositivo (se guarda la huella del problema). */
const DISMISS_KEY = 'ciclita-reminders-warning'

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY)
  } catch {
    return null
  }
}

/** Permiso actual, actualizado al volver a la app (puede haberse cambiado en el sistema). */
function usePermission() {
  const [perm, setPerm] = useState(permission)
  useEffect(() => {
    const update = () => document.visibilityState === 'visible' && setPerm(permission())
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return [perm, setPerm] as const
}

/**
 * "Tus recordatorios no llegan a este dispositivo": en el inicio, si hay alguno
 * activado pero falta el permiso, el navegador no admite notificaciones o el servidor
 * no los ha aceptado. Con el arreglo a mano (permitir, reintentar o ir a Ajustes).
 */
export function RemindersWarning({ prediction }: { prediction: Prediction | null }) {
  const settings = useLiveQuery(() => getSettings())
  const [perm, setPerm] = usePermission()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [busy, setBusy] = useState(false)
  if (!settings) return null
  const problem = reminderProblem(settings.reminders, perm, settings.pushError)
  if (!problem || dismissed === problemKey(problem)) return null
  const w = t.remindersWarning

  const fix = async () => {
    setBusy(true)
    if (problem.kind === 'askPermission') setPerm(await requestPermission())
    await syncPush(prediction, { force: true })
    setBusy(false)
  }
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, problemKey(problem))
    } catch {
      // Sin almacenamiento: se oculta solo hasta recargar.
    }
    setDismissed(problemKey(problem))
  }

  const body =
    problem.kind === 'denied'
      ? w.denied
      : problem.kind === 'askPermission'
        ? w.askPermission
        : problem.kind === 'unsupported'
          ? isIOS() && !isStandalone()
            ? w.unsupportedIOS
            : w.unsupported
          : w.error(problem.message)

  return (
    <section aria-labelledby="reminders-warning" role="alert" className="rounded-3xl border-2 border-danger/50 bg-surface p-5 shadow-sm">
      <h2 id="reminders-warning" className="text-lg font-extrabold">
        🔕 {w.title}
      </h2>
      <p className="mt-1 text-sm">{body}</p>
      <div className="mt-3 grid gap-2">
        {problem.kind === 'askPermission' || problem.kind === 'error' ? (
          <Button disabled={busy} onClick={() => void fix()}>
            {busy ? t.settings.pushSyncing : problem.kind === 'askPermission' ? w.allow : w.retry}
          </Button>
        ) : (
          <a
            href="#/settings/reminders"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-surface px-6 py-3 font-bold text-ink hover:bg-surface-soft"
          >
            {w.open}
          </a>
        )}
        <Button variant="ghost" onClick={dismiss}>
          {w.dismiss}
        </Button>
      </div>
    </section>
  )
}
