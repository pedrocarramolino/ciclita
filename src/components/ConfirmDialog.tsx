import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from './Button'
import { t } from '../i18n'

/**
 * Diálogo de confirmación modal (<dialog> nativo). Si se indica `typeToConfirm`,
 * el botón solo se activa al escribir esa palabra.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel = t.confirm.continue,
  danger,
  typeToConfirm,
  typeLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  children: ReactNode
  confirmLabel?: string
  danger?: boolean
  typeToConfirm?: string
  typeLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const inputId = useId()
  const [typed, setTyped] = useState('')
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

  const ok = !typeToConfirm || typed.trim().toUpperCase() === typeToConfirm

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-bg p-6 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <h2 id={titleId} className="text-xl font-extrabold">
        {title}
      </h2>
      <div className="mt-2 text-muted">{children}</div>
      {typeToConfirm && (
        <>
          <label htmlFor={inputId} className="sr-only">
            {typeLabel}
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            className="mt-4 min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-lg font-bold tracking-widest"
          />
        </>
      )}
      <div className="mt-6 grid gap-2">
        <Button variant={danger ? 'danger' : 'primary'} disabled={!ok} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t.confirm.cancel}
        </Button>
      </div>
    </dialog>
  )
}
