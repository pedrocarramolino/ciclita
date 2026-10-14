// IndexedDB en memoria para poder probar Dexie en Node.
import 'fake-indexeddb/auto'

// El idioma por defecto depende del navegador: los tests siempre se ejecutan en español,
// sea cual sea el idioma de la máquina.
Object.defineProperty(globalThis.navigator, 'language', { value: 'es-ES', configurable: true })
