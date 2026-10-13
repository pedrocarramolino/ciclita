import { useEffect, useState } from 'react'
import { t } from '../i18n'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

/**
 * Teclado numérico de 4 dígitos. Admite también el teclado físico.
 * `resetKey` vacía el PIN cuando cambia (p. ej. tras un error).
 */
export function PinPad({
  onComplete,
  disabled,
  resetKey,
}: {
  onComplete: (pin: string) => void
  disabled?: boolean
  resetKey?: unknown
}) {
  const [pin, setPin] = useState('')
  const [lastReset, setLastReset] = useState(resetKey)
  if (resetKey !== lastReset) {
    setLastReset(resetKey)
    setPin('')
  }

  const press = (k: string) => {
    if (disabled) return
    if (k === 'del') return setPin(pin.slice(0, -1))
    if (pin.length >= 4) return
    const next = pin + k
    setPin(next)
    if (next.length === 4) setTimeout(() => onComplete(next), 120)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div>
      <div className="flex justify-center gap-4" role="status" aria-label={t.lock.entered(pin.length)}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`size-4 rounded-full border-2 border-primary transition ${i < pin.length ? 'bg-primary' : ''}`}
          />
        ))}
      </div>
      <div className="mx-auto mt-8 grid max-w-xs grid-cols-3 gap-4">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => press(k)}
              aria-label={k === 'del' ? t.lock.deleteDigit : t.lock.digit(k)}
              className="mx-auto grid size-18 place-items-center rounded-full bg-surface text-2xl font-extrabold shadow-sm transition active:scale-95 disabled:opacity-40"
            >
              {k === 'del' ? <span aria-hidden="true">⌫</span> : k}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
