import { getSettings, setSettings } from '../../db/settings'
import { verifyPin } from '../../security/pin'

export interface LockState {
  failures: number
  lockedUntil: number
}

/**
 * Cómo comprueba el PIN la pantalla de bloqueo y dónde guarda los intentos fallidos
 * (para que recargar no los reinicie).
 */
export interface PinCheck {
  verify: (pin: string) => Promise<boolean>
  getState: () => Promise<LockState>
  setState: (s: LockState) => Promise<void>
}

/** PIN normal (sin cifrado): se compara con el hash guardado en los ajustes. */
export const settingsPinCheck: PinCheck = {
  async verify(pin) {
    const s = await getSettings()
    return !!s.pinHash && (await verifyPin(pin, s.pinHash))
  },
  async getState() {
    const s = await getSettings()
    return { failures: s.pinFailures, lockedUntil: s.pinLockedUntil }
  },
  async setState({ failures, lockedUntil }) {
    await setSettings({ pinFailures: failures, pinLockedUntil: lockedUntil })
  },
}
