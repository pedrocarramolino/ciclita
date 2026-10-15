import { useEffect, useId, useRef, useState } from 'react'
import {
  AccountError,
  deleteAccount,
  logout,
  refreshUser,
  resendVerification,
  type AccountUser,
} from '../../account/account'
import { wipeDevice } from '../../account/leave'
import { useSyncStatus } from '../../account/useAccount'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { t } from '../../i18n'
import { PrivacyPolicy } from '../auth/PrivacyPolicy'
import { DeleteAllFlow } from './DeleteAllFlow'
import { Section } from './Section'

/** Ajustes → Tu cuenta: datos de la cuenta, confirmar correo, cerrar sesión y eliminarla. */
export function AccountSection({ user }: { user: AccountUser }) {
  const [status, setStatus] = useState('')
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const sync = useSyncStatus()
  const a = t.account

  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn()
      setStatus(ok)
    } catch (e) {
      setStatus(a.errors[e instanceof AccountError ? e.code : 'unknown'])
    }
  }

  if (privacy) {
    return (
      <div className="fixed inset-0 z-40 overflow-y-auto bg-bg">
        <PrivacyPolicy onClose={() => setPrivacy(false)} />
      </div>
    )
  }

  return (
    <Section title={a.section}>
      <div>
        <p className="font-bold">{user.displayName ? a.hello(user.displayName.split(' ')[0]) : user.email}</p>
        <p className="text-sm break-all text-muted">{user.email}</p>
      </div>

      {user.emailVerified ? (
        <p className="text-sm font-bold">✓ {a.verified}</p>
      ) : (
        <div className="rounded-2xl bg-rose-soft p-3 text-sm">
          <p>{a.notVerified}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-11" onClick={() => void run(resendVerification, a.resent)}>
              {a.resend}
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => void run(refreshUser, '')}>
              {a.checkVerified}
            </Button>
          </div>
        </div>
      )}

      <p className={`text-sm ${sync === 'error' ? 'font-bold text-danger' : 'text-muted'}`}>
        {sync === 'error' ? a.syncError : a.syncOk}
      </p>
      <p role="status" className="text-sm font-bold empty:hidden">
        {status}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setConfirmLogout(true)}>
          {a.logout}
        </Button>
        <Button variant="ghost" onClick={() => setPrivacy(true)}>
          {t.privacy.title}
        </Button>
      </div>
      <div className="grid gap-2 border-t border-line pt-4">
        <Button variant="ghost" className="w-full text-danger" onClick={() => setWiping(true)}>
          {t.settings.deleteAll}
        </Button>
        <Button variant="ghost" className="w-full text-danger" onClick={() => setDeleting(true)}>
          {a.deleteAccount}
        </Button>
      </div>

      {confirmLogout && (
        <ConfirmDialog
          title={a.logoutTitle}
          confirmLabel={a.logout}
          onConfirm={() =>
            void logout()
              .then(wipeDevice)
              .catch((e) => {
                setConfirmLogout(false)
                setStatus(a.errors[e instanceof AccountError ? e.code : 'unknown'])
              })
          }
          onCancel={() => setConfirmLogout(false)}
        >
          {a.logoutBody}
        </ConfirmDialog>
      )}
      {deleting && <DeleteAccountDialog onCancel={() => setDeleting(false)} />}
      {wiping && <DeleteAllFlow onCancel={() => setWiping(false)} />}
    </Section>
  )
}

/** Eliminar la cuenta: hay que volver a escribir la contraseña. */
function DeleteAccountDialog({ onCancel }: { onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const inputId = useId()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const a = t.account
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  })

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const cancel = (e: Event) => {
      e.preventDefault()
      onCancelRef.current()
    }
    d.addEventListener('cancel', cancel)
    if (!d.open) d.showModal()
    return () => d.removeEventListener('cancel', cancel)
  }, [])

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      await deleteAccount(password)
      await wipeDevice()
    } catch (e) {
      setError(a.errors[e instanceof AccountError ? e.code : 'unknown'])
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-bg p-6 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <h2 id={titleId} className="text-xl font-extrabold">
        {a.deleteTitle}
      </h2>
      <p className="mt-2 text-sm">{a.deleteBody}</p>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (password) void confirm()
        }}
      >
        <label htmlFor={inputId} className="mb-1 block text-sm font-bold">
          {a.deletePassword}
        </label>
        <input
          id={inputId}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
        />
        <p role="alert" className="mt-2 min-h-5 text-sm font-bold text-danger">
          {error}
        </p>
        <Button type="submit" variant="danger" className="mt-2 w-full" disabled={!password || busy}>
          {busy ? a.deleting : a.deleteConfirm}
        </Button>
        <Button variant="ghost" className="mt-2 w-full" onClick={onCancel} disabled={busy}>
          {t.confirm.cancel}
        </Button>
      </form>
    </dialog>
  )
}
