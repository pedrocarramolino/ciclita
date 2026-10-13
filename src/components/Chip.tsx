import type { ReactNode } from 'react'

/** Chip seleccionable (botón conmutador con aria-pressed). */
export function Chip({
  selected,
  onClick,
  children,
  className = '',
  label,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  className?: string
  label?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 py-2 text-sm font-bold transition ${
        selected
          ? 'border-primary bg-primary-soft text-ink'
          : 'border-line bg-surface text-ink hover:bg-surface-soft'
      } ${className}`}
    >
      {children}
    </button>
  )
}
