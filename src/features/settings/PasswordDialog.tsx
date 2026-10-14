import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { MIN_BACKUP_PASSWORD } from '../../security/backupCrypto'
import { t } from '../../i18n'

/**
 * Diálogo para pedir la contraseña de una copia cifrada. Con `confirm` (al exportar)
 * pide repetirla y exige una longitud mínima. `onSubmit` devuelve un mensaje de error
 * para mostrarlo sin cerrar (contraseña incorrecta) o null si ha ido bien.
 */
export function PasswordDialog({
  title,
  body,
  submitLabel,
  busyLabel,
  confirm = false,
  onSubmit,
  onCancel,
}: {
  title: string
  body: string
  submitLabel: string
  busyLabel: string
  confirm?: boolean
  onSubmit: (password: string) => Promise<string | null>
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const ids = { title: useId(), pass: useId(), repeat: useId(), error: useId() }
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const e = t.encryptedBackup
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  })

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const cancel = (ev: Event) => {
      ev.preventDefault()
      onCancelRef.current()
    }
    d.addEventListener('cancel', cancel)
    if (!d.open) d.showModal()
    return () => d.removeEventListener('cancel', cancel)
  }, [])

  const submit = async () => {
    if (confirm && password.length < MIN_BACKUP_PASSWORD) return setError(e.tooShort(MIN_BACKUP_PASSWORD))
    if (confirm && password !== repeat) return setError(e.mismatch)
    if (!password) return
    setError('')
    setBusy(true)
    const msg = await onSubmit(password)
    setBusy(false)
    if (msg) setError(msg)
  }

  const input = 'mt-1 min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-lg'
  return (
    <dialog
      ref={ref}
      aria-labelledby={ids.title}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-bg p-6 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          void submit()
        }}
      >
        <h2 id={ids.title} className="text-xl font-extrabold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted">{body}</p>

        <label htmlFor={ids.pass} className="mt-4 block font-bold">
          {e.password}
        </label>
        <input
          id={ids.pass}
          type={show ? 'text' : 'password'}
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
          autoComplete={confirm ? 'new-password' : 'current-password'}
          aria-describedby={error ? ids.error : undefined}
          aria-invalid={!!error || undefined}
          disabled={busy}
          className={input}
        />
        {confirm && (
          <>
            <label htmlFor={ids.repeat} className="mt-3 block font-bold">
              {e.repeat}
            </label>
            <input
              id={ids.repeat}
              type={show ? 'text' : 'password'}
              value={repeat}
              onChange={(ev) => setRepeat(ev.target.value)}
              autoComplete="new-password"
              disabled={busy}
              className={input}
            />
          </>
        )}
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={show} onChange={(ev) => setShow(ev.target.checked)} className="size-5" />
          {e.show}
        </label>

        <p id={ids.error} role="alert" className="mt-1 min-h-5 text-sm font-bold text-danger">
          {busy ? '' : error}
        </p>
        <p role="status" className="text-sm text-muted empty:hidden">
          {busy ? busyLabel : ''}
        </p>

        <div className="mt-4 grid gap-2">
          <Button type="submit" disabled={busy || !password}>
            {submitLabel}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t.confirm.cancel}
          </Button>
        </div>
      </form>
    </dialog>
  )
}
