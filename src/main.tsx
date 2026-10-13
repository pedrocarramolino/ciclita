import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { migrateLegacyDb } from './db/migrate'
import { isEncrypted } from './db/vault'

// Antes de pintar la app: se migra la base de datos del nombre antiguo si existe y se
// mira si los datos están cifrados (entonces lo primero es pedir el PIN).
async function boot() {
  await migrateLegacyDb().catch((e) => console.error('No se pudo migrar la base de datos antigua', e))
  const encrypted = await isEncrypted().catch(() => false)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App encrypted={encrypted} />
    </StrictMode>,
  )
}
void boot()
