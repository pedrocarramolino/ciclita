/**
 * Manifiestos de la PWA: nombre, descripción y atajos del icono en cada idioma.
 * El español lo genera vite-plugin-pwa (manifest.webmanifest); el inglés se emite como
 * manifest-en.webmanifest y la app enlaza uno u otro según el idioma elegido.
 * Comparten `id`, así que el sistema los trata como la misma app.
 */
import type { ManifestOptions } from 'vite-plugin-pwa'

export const CREAM = '#fbf6f0'

const shortcutIcon = [{ src: 'icons/icon-192.png', sizes: '192x192' }]

export const MANIFEST_ES: Partial<ManifestOptions> = {
  id: '/',
  name: 'Ciclita · Registro menstrual',
  short_name: 'Ciclita',
  description: 'Registro menstrual privado: tus datos se quedan en tu dispositivo.',
  lang: 'es',
  dir: 'ltr',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: CREAM,
  theme_color: CREAM,
  categories: ['health', 'lifestyle', 'medical'],
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
  ],
  shortcuts: [
    // #/log abre directamente el registro de hoy (ver Home.tsx).
    { name: 'Registrar hoy', short_name: 'Registrar', url: '/#/log', icons: shortcutIcon },
    { name: 'Calendario', url: '/#/calendar', icons: shortcutIcon },
  ],
}

export const MANIFEST_EN: Partial<ManifestOptions> = {
  ...MANIFEST_ES,
  name: 'Ciclita · Period tracker',
  description: 'Private period tracker: your data stays on your device.',
  lang: 'en',
  shortcuts: [
    { name: 'Log today', short_name: 'Log', url: '/#/log', icons: shortcutIcon },
    { name: 'Calendar', url: '/#/calendar', icons: shortcutIcon },
  ],
}

/** Nombre del archivo del manifiesto de cada idioma (se sirve desde la raíz). */
export const MANIFEST_FILES = { es: 'manifest.webmanifest', en: 'manifest-en.webmanifest' } as const
