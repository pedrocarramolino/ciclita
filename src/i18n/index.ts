/**
 * Idioma de la app. Se guarda en localStorage (no en la base de datos) porque hay que
 * conocerlo antes de desbloquear unos datos cifrados. Cambiarlo recarga la app.
 */
import { en } from './en'
import { es, type Messages } from './es'

export type Lang = 'es' | 'en'
export const LANGS: Lang[] = ['es', 'en']

const KEY = 'ciclita-lang'

/** El elegido en la bienvenida o en Ajustes; si no hay, siempre español. */
function readLang(): Lang {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

export const lang: Lang = readLang()
export const t: Messages = lang === 'en' ? en : es
/** Locale para fechas y números (Intl). */
export const locale = t.locale

export function setLanguage(l: Lang) {
  try {
    localStorage.setItem(KEY, l)
  } catch {
    // Sin almacenamiento disponible: el idioma solo dura esta sesión.
  }
  location.reload()
}

/** Olvida el idioma elegido (al borrar todos los datos). No recarga. */
export function clearLanguage() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nada que borrar.
  }
}

/** Nombre a mostrar de un síntoma (los del catálogo se guardan en español). */
export function symptomLabel(name: string): string {
  return t.symptomNames[name] ?? name
}

export { es, en }
export type { Messages }
