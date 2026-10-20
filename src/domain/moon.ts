/**
 * Fases principales de la luna (nueva, cuarto creciente, llena y cuarto menguante),
 * calculadas sin conexión con el algoritmo de Jean Meeus ("Astronomical Algorithms",
 * cap. 49). El error es de pocos minutos, así que el día que se muestra es el correcto
 * salvo cuando la fase cae justo en torno a medianoche. Función pura.
 */
import { addDays, type ISODate } from './dates'

export type MoonPhase = 'new' | 'firstQuarter' | 'full' | 'lastQuarter'

const PHASES: [MoonPhase, number][] = [
  ['new', 0],
  ['firstQuarter', 0.25],
  ['full', 0.5],
  ['lastQuarter', 0.75],
]

/** Duración media del mes lunar (sinódico), en días. */
const SYNODIC_MONTH = 29.530588853
const rad = (deg: number) => (deg * Math.PI) / 180
const sin = (deg: number) => Math.sin(rad(deg))
const cos = (deg: number) => Math.cos(rad(deg))

/**
 * Día juliano (efemérides) de la fase `phase` (0, 0.25, 0.5 o 0.75) de la lunación
 * `k`, contada desde la luna nueva de enero de 1900.
 */
export function truePhase(k: number, phase: number): number {
  k += phase
  const t = k / 1236.85
  const t2 = t * t
  const t3 = t2 * t
  let jd =
    2415020.75933 + SYNODIC_MONTH * k + 0.0001178 * t2 - 0.000000155 * t3 + 0.00033 * sin(166.56 + 132.87 * t - 0.009173 * t2)
  const m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3 // anomalía del Sol
  const mp = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3 // anomalía de la Luna
  const f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3 // argumento de latitud

  if (phase === 0 || phase === 0.5) {
    jd +=
      (0.1734 - 0.000393 * t) * sin(m) +
      0.0021 * sin(2 * m) -
      0.4068 * sin(mp) +
      0.0161 * sin(2 * mp) -
      0.0004 * sin(3 * mp) +
      0.0104 * sin(2 * f) -
      0.0051 * sin(m + mp) -
      0.0074 * sin(m - mp) +
      0.0004 * sin(2 * f + m) -
      0.0004 * sin(2 * f - m) -
      0.0006 * sin(2 * f + mp) +
      0.001 * sin(2 * f - mp) +
      0.0005 * sin(m + 2 * mp)
  } else {
    jd +=
      (0.1721 - 0.0004 * t) * sin(m) +
      0.0021 * sin(2 * m) -
      0.628 * sin(mp) +
      0.0089 * sin(2 * mp) -
      0.0004 * sin(3 * mp) +
      0.0079 * sin(2 * f) -
      0.0119 * sin(m + mp) -
      0.0047 * sin(m - mp) +
      0.0003 * sin(2 * f + m) -
      0.0004 * sin(2 * f - m) -
      0.0006 * sin(2 * f + mp) +
      0.0021 * sin(2 * f - mp) +
      0.0003 * sin(m + 2 * mp) +
      0.0004 * sin(m - 2 * mp) -
      0.0003 * sin(2 * m + mp)
    const w = 0.0028 - 0.0004 * cos(m) + 0.0003 * cos(mp)
    jd += phase < 0.5 ? w : -w
  }
  return jd
}

/** Instante (Date) de un día juliano. */
export const julianToDate = (jd: number) => new Date((jd - 2440587.5) * 86_400_000)

/** Fecha local (la de la zona horaria del dispositivo) de un instante. */
const localISO = (d: Date): ISODate =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Fases principales entre `from` y `to` (incluidos), por fecha local. Cada día tiene
 * como mucho una (entre dos fases pasan unos 7 días).
 */
export function moonPhases(from: ISODate, to: ISODate): Map<ISODate, MoonPhase> {
  const [y, mo] = from.split('-').map(Number)
  // Lunación aproximada un poco antes de `from`, para no saltarse ninguna fase.
  const k0 = Math.floor((y + (mo - 1) / 12 - 1900) * 12.3685) - 2
  const end = addDays(to, 1)
  const out = new Map<ISODate, MoonPhase>()
  for (let k = k0; ; k++) {
    if (localISO(julianToDate(truePhase(k, 0))) > end) break
    for (const [name, phase] of PHASES) {
      const date = localISO(julianToDate(truePhase(k, phase)))
      if (date >= from && date <= to) out.set(date, name)
    }
  }
  return out
}
