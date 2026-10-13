import { useId, type ReactNode } from 'react'

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="rounded-3xl bg-surface p-5 shadow-sm">
      <h2 id={id} className="text-lg font-extrabold">
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4 space-y-5">{children}</div>
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
