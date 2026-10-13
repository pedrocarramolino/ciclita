// Genera public/icons/badge-96.png: versión monocroma del logo de Ciclita (blanco
// sobre transparente) que Android muestra en la barra de estado con las notificaciones.
//   npm run icons
import sharp from 'sharp'

// Misma geometría que public/icons/icon.svg: anillo abierto arriba y gota.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g transform="translate(6 4) scale(0.88)">
    <circle cx="50" cy="54" r="34" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="168 45.6" transform="rotate(-53 50 54)"/>
    <path d="M50 4 C46 10 41 15 41 21 A9 9 0 0 0 59 21 C59 15 54 10 50 4 Z" fill="#fff"/>
  </g>
</svg>`

await sharp(Buffer.from(svg)).resize(96, 96).png().toFile('public/icons/badge-96.png')
console.log('✔ public/icons/badge-96.png')
