/**
 * Guardar y compartir archivos generados en el dispositivo (copias, informe en PDF).
 *
 * En iPhone/iPad con la app instalada en la pantalla de inicio, ni las descargas
 * (<a download>) ni window.print() funcionan. Allí se usa el menú Compartir del
 * sistema (Web Share API), que permite "Guardar en Archivos", imprimir o enviar.
 */

/** App abierta desde la pantalla de inicio de iOS. */
export function isIOSStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** El navegador puede compartir este archivo con otras apps. */
export function canShareFile(file: File): boolean {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'unavailable'

/** Abre el menú Compartir con el archivo. Cerrarlo sin elegir nada no es un error. */
export async function shareFile(file: File, title?: string): Promise<ShareResult> {
  if (!canShareFile(file)) return 'unavailable'
  try {
    await navigator.share({ files: [file], title })
    return 'shared'
  } catch (e) {
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'unavailable'
  }
}

/**
 * Descarga el archivo (en iOS con la app instalada, a través del menú Compartir).
 * Devuelve false si se cerró el menú Compartir sin guardar.
 */
export async function saveFile(file: File): Promise<boolean> {
  if (isIOSStandalone()) {
    const r = await shareFile(file)
    if (r !== 'unavailable') return r === 'shared'
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
