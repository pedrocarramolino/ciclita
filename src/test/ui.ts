/**
 * Utilidades para las pruebas de pantallas (entorno jsdom). Cada archivo de prueba de
 * UI empieza con `// @vitest-environment jsdom` e importa este módulo.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { db } from '../db/db'

// jsdom no implementa <dialog> modal: lo justo para abrir y cerrar.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false
  }
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList
}

window.scrollTo = () => {}

// Las gráficas miden su contenedor con ResizeObserver (en jsdom el ancho es 0).
if (!('ResizeObserver' in window)) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// jsdom tampoco tiene Blob.text() (lo usa la importación de copias).
if (!Blob.prototype.text) {
  Blob.prototype.text = function (this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this)
    })
  }
}

/** Base de datos vacía (recién creada, con los síntomas de serie) para cada prueba. */
beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
})

afterEach(() => {
  cleanup()
  location.hash = ''
})
