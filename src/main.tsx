import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { migrateLegacyDb } from './db/migrate'

// Antes de pintar la app, se migra la base de datos del nombre antiguo si existe.
void migrateLegacyDb()
  .catch((e) => console.error('No se pudo migrar la base de datos antigua', e))
  .finally(() =>
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  )
