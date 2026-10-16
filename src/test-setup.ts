// IndexedDB en memoria para poder probar Dexie en Node.
import 'fake-indexeddb/auto'

import { vi } from 'vitest'

// Las cuentas (Firebase) no se usan en las pruebas: hay una sesión iniciada de prueba
// y la sincronización no hace nada. Las pruebas de la pantalla de registro cambian
// estas funciones con vi.mocked(...).
vi.mock('./account/account', async (importOriginal) => {
  const real = await importOriginal<typeof import('./account/account')>()
  const user = { uid: 'test-uid', email: 'prueba@ciclita.test', emailVerified: true, displayName: 'Ana Prueba' }
  return {
    ...real,
    watchAccount: vi.fn((cb: (s: unknown) => void) => {
      cb({ status: 'signedIn', user })
      return () => {}
    }),
    register: vi.fn(async () => {}),
    login: vi.fn(async () => {}),
    sendReset: vi.fn(async () => {}),
    resendVerification: vi.fn(async () => {}),
    refreshUser: vi.fn(async () => {}),
    getProfile: vi.fn(async () => null),
    currentUid: vi.fn(() => 'test-uid'),
    signOutHere: vi.fn(async () => {}),
    idToken: vi.fn(async () => null),
    logout: vi.fn(async () => {}),
    deleteAccount: vi.fn(async () => {}),
  }
})
vi.mock('./account/sync', () => ({
  startAutoSync: vi.fn((_uid: string, _onError: unknown, onFirstSync?: () => void) => {
    onFirstSync?.()
    return () => {}
  }),
  syncNow: vi.fn(async () => {}),
  flushSync: vi.fn(async () => {}),
  pull: vi.fn(async () => {}),
  push: vi.fn(async () => {}),
  deleteCloudData: vi.fn(async () => {}),
  userDoc: vi.fn(),
}))
