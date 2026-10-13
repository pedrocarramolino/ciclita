/** Iconos lineales propios (trazo 2px, estilo redondeado). Decorativos por defecto. */
const PATHS = {
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  check: 'M5 12l5 5L20 7',
  arrowLeft: 'M15 18l-6-6 6-6',
} as const

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  className = 'size-6',
  label,
}: {
  name: IconName
  className?: string
  label?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
