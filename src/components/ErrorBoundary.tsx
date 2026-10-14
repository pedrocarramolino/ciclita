import { Component, useState, type ReactNode } from 'react'
import { downloadBackupJSON } from '../db/data'
import { t } from '../i18n'
import { Button } from './Button'

/**
 * Si una pantalla falla al pintarse, en lugar de dejar la app en blanco se muestra un
 * aviso con la opción de recargar y, sobre todo, de exportar los datos.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Error al pintar la app', error)
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children
  }
}

function CrashScreen() {
  const [exportFailed, setExportFailed] = useState(false)
  const c = t.crash
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8">
      <h1 className="text-2xl font-extrabold">{c.title}</h1>
      <p>{c.body}</p>
      <Button onClick={() => location.reload()}>{c.reload}</Button>
      <Button variant="secondary" onClick={() => void downloadBackupJSON().catch(() => setExportFailed(true))}>
        {c.export}
      </Button>
      <p role="status" className="text-sm font-bold">
        {exportFailed ? c.exportFailed : ''}
      </p>
    </main>
  )
}
