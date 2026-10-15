import { useContext, useId, type ReactNode } from 'react'
import { PageTitle } from './pageTitle'

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId()
  const showTitle = useContext(PageTitle) !== title
  return (
    <section
      aria-labelledby={showTitle ? id : undefined}
      aria-label={showTitle ? undefined : title}
      className="rounded-3xl bg-surface p-5 shadow-sm"
    >
      {showTitle && (
        <h2 id={id} className="mb-1 text-lg font-extrabold">
          {title}
        </h2>
      )}
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className={`${showTitle || hint ? 'mt-4' : ''} space-y-5`}>{children}</div>
    </section>
  )
}

/** Fila con etiqueta (y ayuda opcional) a la izquierda y un control a la derecha. */
export function Row({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p id={id} className="font-bold">
          {label}
        </p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  )
}
