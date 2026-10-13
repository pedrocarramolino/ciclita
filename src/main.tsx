import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'

// Service worker: notificaciones push (y modo offline en la fase 6).
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
