/** Iconos lineales propios (trazo 2px, estilo redondeado). Decorativos por defecto. */
const PATHS = {
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z',
  phone: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  check: 'M5 12l5 5L20 7',
  arrowLeft: 'M15 18l-6-6 6-6',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  home: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z',
  chart: 'M4 20h16M7 16v-5M12 16V7M17 16v-8',
  settings:
    'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  share: 'M12 15V3M8 7l4-4 4 4M6 11H5v10h14V11h-1',
  faceId:
    'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1M15 9v1M12 9v4h-1M9 16c1.7 1.3 4.3 1.3 6 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  bell: 'M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  palette:
    'M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1-.8-1.4-.8-2.4s.8-1.6 1.8-1.6H17a4 4 0 0 0 4-4c0-4.6-4-8.4-9-8.4zM7.5 11h.01M10.5 7.5h.01M15 7.5h.01',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5L20 20',
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
