import { afterEach, describe, expect, it } from 'vitest'
import { AppDB, db } from './db'
import { saveDay } from './repo'
import { unwrapPin, wrapPin } from '../security/biometric'
import { getSettings, setSettings } from './settings'
import {
  closeVaultSession,
  disableEncryption,
  enableEncryption,
  flushVault,
  getVaultRow,
  isEncrypted,
  isVaultUnlocked,
  rekeyVault,
  setVaultBio,
  unlockVault,
  vaultLockStore,
} from './vault'

const ITER = 1000
const disks: AppDB[] = []

async function seededDisk() {
  const d = new AppDB(`disk-${crypto.randomUUID()}`)
  disks.push(d)
  await d.open()
  await d.periods.add({ startDate: '2026-09-01', endDate: '2026-09-05' })
  await d.days.put({ date: '2026-09-02', flow: 'heavy', notes: 'Nota muy privada', symptoms: ['Migraña'], updatedAt: 1 })
  await d.symptoms.add({ name: 'Migraña', builtin: false })
  await setSettings({ onboardingDone: true, theme: 'dark', pinHash: 'h' }, d)
  return d
}

afterEach(async () => {
  await closeVaultSession()
  await Promise.all(disks.splice(0).map((d) => d.delete()))
})

const asText = (buf: ArrayBuffer) => new TextDecoder('latin1').decode(buf)

describe('bóveda cifrada', () => {
  it('al activar el cifrado no queda nada en claro en disco', async () => {
    const disk = await seededDisk()
    await enableEncryption('2580', { disk, iterations: ITER })

    expect(await isEncrypted(disk)).toBe(true)
    expect(await disk.periods.count()).toBe(0)
    expect(await disk.days.count()).toBe(0)
    expect(await disk.symptoms.count()).toBe(0)
    expect(await disk.settings.count()).toBe(0)
    const row = (await getVaultRow(disk))!
    expect(asText(row.data)).not.toMatch(/2026-09|privada|Migraña/)
    expect(row.theme).toBe('dark') // solo el tema, para pintar el desbloqueo con sus colores
  })

  it('con el PIN incorrecto no desbloquea', async () => {
    const disk = await seededDisk()
    await enableEncryption('2580', { disk, iterations: ITER })
    expect(await unlockVault('1111', { disk })).toBe(false)
    expect(isVaultUnlocked()).toBe(false)
  })

  it('con el PIN correcto los datos vuelven a estar disponibles en la base activa', async () => {
    const disk = await seededDisk()
    await enableEncryption('2580', { disk, iterations: ITER })
    expect(await unlockVault('2580', { disk })).toBe(true)

    const { db: active } = await import('./db')
    expect(active).not.toBe(disk)
    expect(await active.days.get('2026-09-02')).toMatchObject({ notes: 'Nota muy privada' })
    expect((await getSettings(active)).theme).toBe('dark')
  })

  it('cada cambio se vuelve a cifrar y sobrevive a cerrar y abrir', async () => {
    const disk = await seededDisk()
    await enableEncryption('2580', { disk, iterations: ITER })
    await unlockVault('2580', { disk })
    const { db: mem } = await import('./db')

    await saveDay('2026-10-01', { notes: 'Nuevo registro secreto' }, true, mem, '2026-10-13')
    await flushVault()
    expect(asText((await getVaultRow(disk))!.data)).not.toContain('secreto')

    await closeVaultSession()
    expect(await unlockVault('2580', { disk })).toBe(true)
    const { db: again } = await import('./db')
    expect(await again.days.get('2026-10-01')).toMatchObject({ notes: 'Nuevo registro secreto' })
    expect(await again.periods.where('startDate').equals('2026-10-01').count()).toBe(1)
  })

  it('cambiar el PIN vuelve a cifrar con la clave nueva', async () => {
    const disk = await seededDisk()
    await enableEncryption('2580', { disk, iterations: ITER })
    await unlockVault('2580', { disk })
    await rekeyVault('9999')
    await closeVaultSession()
    expect(await unlockVault('2580', { disk })).toBe(false)
    expect(await unlockVault('9999', { disk })).toBe(true)
  })

  it('desactivar el cifrado devuelve los datos en claro y borra la bóveda', async () => {
    const disk = await seededDisk()
    await enableEncryption('2580', { disk, iterations: ITER })
    await unlockVault('2580', { disk })
    await disableEncryption()

    expect(await isEncrypted(disk)).toBe(false)
    expect(await disk.days.get('2026-09-02')).toMatchObject({ notes: 'Nota muy privada' })
    expect((await getSettings(disk)).pinHash).toBe('h')
    expect(db === disk || !isVaultUnlocked()).toBe(true)
  })

  it('guarda los intentos fallidos sin necesidad de desbloquear', async () => {
    const disk = await seededDisk()
    await enableEncryption('2580', { disk, iterations: ITER })
    const store = vaultLockStore(disk)
    await store.set({ failures: 3, lockedUntil: 123 })
    expect(await store.get()).toEqual({ failures: 3, lockedUntil: 123 })
  })

  it('Face ID o huella: el PIN cifrado con la llave abre la bóveda y sobrevive a los guardados', async () => {
    const disk = await seededDisk()
    await enableEncryption('2580', { disk, iterations: ITER })
    const prf = crypto.getRandomValues(new Uint8Array(32)).buffer
    await setVaultBio(await wrapPin('2580', prf, 'cred', new Uint8Array(32)), disk)

    // Un cambio tras desbloquear vuelve a guardar la bóveda sin perder el PIN cifrado.
    await unlockVault('2580', { disk })
    await saveDay('2026-09-03', { notes: 'otra' }, false)
    await flushVault()
    await closeVaultSession()

    const bio = (await getVaultRow(disk))?.bio
    expect(bio?.credentialId).toBe('cred')
    const pin = await unwrapPin(bio!, prf)
    expect(pin).toBe('2580')
    expect(await unlockVault(pin!, { disk })).toBe(true)
    await closeVaultSession()

    await setVaultBio(null, disk)
    expect((await getVaultRow(disk))?.bio).toBeUndefined()
    expect(await unlockVault('2580', { disk })).toBe(true)
  })
})
