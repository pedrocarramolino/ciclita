import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { migrateLegacyDb } from './db/migrate'
import { isEncrypted } from './db/vault'
import { lang } from './i18n'

document.documentElement.lang = lang
// Nombre y atajos del icono en el idioma elegido (ver pwa-manifests.ts).
if (lang === 'en') document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/manifest-en.webmanifest')

// Antes de pintar la app: se migra la base de datos del nombre antiguo si existe y se
// mira si los datos están cifrados (entonces lo primero es pedir el PIN).
async function boot() {
  await migrateLegacyDb().catch((e) => console.error('No se pudo migrar la base de datos antigua', e))
  const encrypted = await isEncrypted().catch(() => false)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App encrypted={encrypted} />
      </ErrorBoundary>
    </StrictMode>,
  )
}
void boot()
