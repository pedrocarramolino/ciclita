import { defineConfig } from '@vite-pwa/assets-generator/config'

/**
 * Genera los iconos de la PWA a partir de public/logo.svg:
 *   npm run icons
 */
const background = '#fbf6f0'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, 'favicon.ico']],
      padding: 0,
    },
    // Android recorta los iconos "maskable" en círculo o squircle: dejamos margen seguro.
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background } },
    apple: { sizes: [180], padding: 0.3, resizeOptions: { background } },
  },
  images: ['public/logo.svg'],
})
