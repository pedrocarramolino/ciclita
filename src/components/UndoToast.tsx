import { useEffect, useRef } from 'react'
import { t } from '../i18n'

/** Tiempo que se ofrece deshacer. */
export const UNDO_MS = 8000

/**
 * Aviso flotante (con "Deshacer" si se indica `onUndo`), encima de la barra de navegación. Desaparece solo;
 * mientras el puntero o el foco están dentro, no se cierra.
 */
export function UndoToast({ message, onUndo, onClose }: { message: string; onUndo?: () => void; onClose: () => void }) {
  const hold = useRef(false)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const id = setInterval(() => {
      if (!hold.current) onCloseRef.current()
    }, UNDO_MS)
    return () => clearInterval(id)
  }, [message])

  const holdOn = () => (hold.current = true)
  const holdOff = () => (hold.current = false)

  return (
    <div
      role="status"
      onPointerEnter={holdOn}
      onPointerLeave={holdOff}
      onFocus={holdOn}
      onBlur={holdOff}
      className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-bg shadow-lg"
    >
      <span className="text-sm font-bold">{message}</span>
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="min-h-11 shrink-0 rounded-full px-3 font-extrabold underline underline-offset-2"
        >
          {t.home.undo}
        </button>
      )}
    </div>
  )
}
