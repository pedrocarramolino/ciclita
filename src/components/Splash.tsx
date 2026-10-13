import { useEffect, useState } from 'react'
import { t } from '../i18n'

/** Duración mínima de la animación de apertura y del fundido de salida (ms). */
const MIN_MS = 1050
const FADE_MS = 350

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Animación de apertura con el logo de Ciclita: se dibuja el anillo del ciclo, cae la
 * gota y aparece la luna. Se muestra al abrir la app (mientras carga IndexedDB) y se
 * desvanece (tocar la pantalla la salta). Con "reducir movimiento" activado en el
 * sistema no se muestra.
 * Es decorativa: aria-hidden, y no bloquea el contenido para lectores de pantalla.
 */
export function Splash({ ready }: { ready: boolean }) {
  const [reduce] = useState(reducedMotion)
  const [minDone, setMinDone] = useState(false)
  const [gone, setGone] = useState(false)
  const leaving = ready && minDone

  useEffect(() => {
    const id = setTimeout(() => setMinDone(true), MIN_MS)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!leaving) return
    const id = setTimeout(() => setGone(true), FADE_MS)
    return () => clearTimeout(id)
  }, [leaving])

  if (reduce || gone) return null

  return (
    // Tocar la pantalla salta la animación (en cuanto los datos estén cargados).
    <div
      aria-hidden="true"
      onClick={() => setMinDone(true)}
      className={`splash fixed inset-0 z-50 grid place-items-center bg-bg ${leaving ? 'splash-out' : ''}`}
    >
      <div className="flex flex-col items-center">
        <svg viewBox="0 0 100 100" className="splash-tile size-32 rounded-[28%] shadow-lg">
          <rect width="100" height="100" fill="#E8B4B8" />
          <g transform="translate(15 15) scale(0.7)">
            <circle
              className="splash-ring"
              cx="50"
              cy="54"
              r="34"
              fill="none"
              stroke="#3D2340"
              strokeWidth="10"
              strokeLinecap="round"
              transform="rotate(-53 50 54)"
            />
            <g className="splash-moon">
              <circle cx="50" cy="54" r="13" fill="#B9A7D6" />
              <circle cx="56" cy="50" r="10" fill="#E8B4B8" />
            </g>
            <path
              className="splash-drop"
              d="M50 4 C46 10 41 15 41 21 A9 9 0 0 0 59 21 C59 15 54 10 50 4 Z"
              fill="#C4574A"
            />
          </g>
        </svg>
        <p className="splash-name mt-5 text-3xl font-extrabold tracking-wide text-ink">{t.appName}</p>
      </div>
    </div>
  )
}
