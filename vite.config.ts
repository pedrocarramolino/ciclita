import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const CREAM = '#fbf6f0'
const vercelConfig = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Service worker propio (src/sw.ts): modo offline + notificaciones push.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      // La nueva versión se activa cuando la usuaria lo confirma (no recarga en mitad de un registro).
      registerType: 'prompt',
      manifest: {
        id: '/',
        name: 'Ciclo · Registro menstrual',
        short_name: 'Ciclo',
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
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Registrar hoy', short_name: 'Registrar', url: '/#/home', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Calendario', url: '/#/calendar', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Para español basta con los subconjuntos latinos de la fuente.
        globIgnores: ['**/nunito-{cyrillic,cyrillic-ext,vietnamese}-*'],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  // `vite preview` usa las mismas cabeceras globales que Vercel (CSP incluida) para probarlas en local.
  preview: {
    headers: Object.fromEntries(
      vercelConfig.headers
        .find((h: { source: string }) => h.source === '/(.*)')!
        .headers.filter((h: { key: string }) => h.key !== 'Strict-Transport-Security')
        .map((h: { key: string; value: string }) => [h.key, h.value]),
    ),
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
})
