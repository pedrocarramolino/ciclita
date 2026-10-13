import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Service worker propio (src/sw.ts) para recibir las notificaciones push.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      registerType: 'autoUpdate',
      // El manifest y los iconos se completan en la fase 6.
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
  test: {
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
})
