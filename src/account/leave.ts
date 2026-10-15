import { wipeAll } from '../db/data'
import { getSettings } from '../db/settings'
import { getVaultRow } from '../db/vault'
import { unregisterPush, unsubscribeBrowserPush } from '../push/pushClient'
import { forgetCredential } from '../security/biometric'

/**
 * Deja el dispositivo limpio: avisos, llave de Face ID o huella y datos locales (con
 * el PIN). Después recarga la app. Lo usan cerrar sesión, eliminar la cuenta, el PIN
 * olvidado y "Borrar todos mis datos".
 */
export async function wipeDevice(): Promise<void> {
  // Con los datos cifrados y bloqueados no hay credenciales de avisos: al menos se
  // cancela la suscripción del navegador para que dejen de llegar.
  const { pushDevice, biometric } = await getSettings().catch(() => ({ pushDevice: null, biometric: null }))
  const bioId = biometric?.credentialId ?? (await getVaultRow().catch(() => undefined))?.bio?.credentialId
  if (bioId) forgetCredential(bioId)
  await unregisterPush(pushDevice).catch(() => {})
  await unsubscribeBrowserPush().catch(() => {})
  await wipeAll()
  history.replaceState(null, '', location.pathname)
  location.reload()
}
