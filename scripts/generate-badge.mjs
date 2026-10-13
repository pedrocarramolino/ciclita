// Genera public/badge-96.png: icono monocromo (blanco sobre transparente) que
// Android muestra en la barra de estado junto a las notificaciones.
import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <path d="M48 10c13 16 26 32 26 48a26 26 0 0 1-52 0c0-16 13-32 26-48z" fill="#fff"/>
</svg>`

await sharp(Buffer.from(svg)).resize(96, 96).png().toFile('public/badge-96.png')
console.log('✔ public/badge-96.png')
