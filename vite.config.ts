import { readFileSync } from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { MANIFEST_EN, MANIFEST_ES, MANIFEST_FILES } from './pwa-manifests.ts'

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
      // Los iconos ya entran por globPatterns; así no se duplican en la precarga.
      includeManifestIcons: false,
      manifest: MANIFEST_ES,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // icon-1024 es para tiendas y redes: no hace falta en el dispositivo.
        globIgnores: ['icons/icon-1024.png', '**/nunito-{cyrillic,cyrillic-ext,vietnamese}-*'],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
    // Manifiesto en inglés junto al español (la app enlaza el del idioma elegido).
    {
      name: 'ciclita-manifest-en',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: MANIFEST_FILES.en, source: JSON.stringify(MANIFEST_EN) })
      },
    },
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
