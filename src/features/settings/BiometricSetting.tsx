import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { PinPad } from '../../components/PinPad'
import { setSettings } from '../../db/settings'
import { setVaultBio } from '../../db/vault'
import { t } from '../../i18n'
import {
  authenticateBiometric,
  biometricAvailable,
  forgetCredential,
  isCancel,
  registerBiometric,
  wrapPin,
} from '../../security/biometric'
import { randomBytes } from '../../security/crypto'
import { verifyPin } from '../../security/pin'

/**
 * "Desbloquear con Face ID o huella". Solo aparece si el dispositivo lo tiene.
 * Para activarlo se pide el PIN; con el cifrado activado, la llave tiene que dar
 * además un secreto (PRF) con el que se guarda el PIN cifrado.
 */
export function BiometricSetting({
  pinHash,
  credentialId,
  encrypted,
}: {
  pinHash: string
  credentialId: string | null
  encrypted: boolean
}) {
  const [available, setAvailable] = useState(false)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const b = t.biometric

  useEffect(() => {
    void biometricAvailable().then(setAvailable)
  }, [])

  // Si ya está activado se muestra siempre, para poder desactivarlo.
  if (!available && !credentialId) return null

  const disable = async () => {
    if (!credentialId) return
    forgetCredential(credentialId)
    await setSettings({ biometric: null })
    if (encrypted) await setVaultBio(null)
    setStatus(b.disabled)
  }

  return (
    <div className="rounded-2xl bg-surface-soft p-4">
      <p className="font-bold">{b.title}</p>
      <p className="mt-1 text-sm text-muted">{credentialId ? b.on : encrypted ? b.offEncrypted : b.off}</p>
      {credentialId ? (
        <Button variant="secondary" className="mt-3" onClick={() => void disable()}>
          {b.disable}
        </Button>
      ) : (
        <Button className="mt-3" onClick={() => setOpen(true)}>
          <Icon name="faceId" />
          {b.enable}
        </Button>
      )}
      <p role="status" className="mt-2 text-sm font-bold empty:hidden">
        {status}
      </p>
      {open && (
        <EnableDialog
          pinHash={pinHash}
          encrypted={encrypted}
          onDone={(msg) => {
            setOpen(false)
            setStatus(msg)
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  )
}

type Step = 'pin' | 'register' | 'confirm' | 'working'

function EnableDialog({
  pinHash,
  encrypted,
  onDone,
  onCancel,
}: {
  pinHash: string
  encrypted: boolean
  onDone: (msg: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [step, setStep] = useState<Step>('pin')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const pin = useRef('')
  const prfSalt = useRef(randomBytes(32))
  const created = useRef<string | null>(null)
  const b = t.biometric
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  })

  useEffect(() => {
    const d = ref.current
    if (!d) return
    const cancel = (e: Event) => {
      e.preventDefault()
      onCancelRef.current()
    }
    d.addEventListener('cancel', cancel)
    if (!d.open) d.showModal()
    return () => d.removeEventListener('cancel', cancel)
  }, [])

  const onPin = async (p: string) => {
    if (!(await verifyPin(p, pinHash))) {
      setError(t.lock.wrong)
      setAttempt((a) => a + 1)
      return
    }
    pin.current = p
    setError('')
    setStep('register')
  }

  /** Guarda el PIN cifrado con el secreto de la llave (solo con el cifrado activado). */
  const finish = async (id: string, prf: ArrayBuffer) => {
    await setVaultBio(await wrapPin(pin.current, prf, id, prfSalt.current))
    await setSettings({ biometric: { credentialId: id } })
    onDone(b.enabled)
  }

  /** El dispositivo no da el secreto: con cifrado no se puede usar. */
  const noPrf = (id: string) => {
    forgetCredential(id)
    onDone(b.noPrf)
  }

  const fail = (e: unknown, back: Step) => {
    console.error(e)
    setError(isCancel(e) ? b.cancelled : b.failed)
    setStep(back)
  }

  // Las llamadas a WebAuthn van directas en el toque del botón (iOS lo exige).
  const register = async () => {
    setError('')
    let reg
    try {
      reg = await registerBiometric(t.appName, encrypted ? prfSalt.current : undefined)
    } catch (e) {
      return fail(e, 'register')
    }
    if (!encrypted) {
      await setSettings({ biometric: { credentialId: reg.credentialId } })
      return onDone(b.enabled)
    }
    setStep('working')
    if (reg.prf) return finish(reg.credentialId, reg.prf)
    // Crear la llave no siempre devuelve el secreto: se pide una vez más la cara o la huella.
    created.current = reg.credentialId
    setStep('confirm')
  }

  const confirm = async () => {
    const id = created.current
    if (!id) return
    setError('')
    try {
      const r = await authenticateBiometric(id, prfSalt.current)
      if (!r.verified) return fail(new Error('no verificado'), 'confirm')
      setStep('working')
      if (!r.prf) return noPrf(id)
      await finish(id, r.prf)
    } catch (e) {
      fail(e, 'confirm')
    }
  }

  const cancel = () => {
    // Si se creó la llave pero no se terminó, no sirve: que el sistema la olvide.
    if (created.current) forgetCredential(created.current)
    onCancel()
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-bg p-6 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <h2 id={titleId} className="text-center text-xl font-extrabold" aria-live="polite">
        {step === 'pin' ? t.settings.pinCurrent : b.title}
      </h2>
      <p role="alert" className="mt-2 min-h-5 text-center text-sm font-bold text-danger">
        {error}
      </p>
      {step === 'pin' && (
        <div className="mt-4">
          <PinPad onComplete={(p) => void onPin(p)} resetKey={attempt} />
        </div>
      )}
      {step === 'register' && (
        <>
          <p className="mt-2 text-center">{b.registerHint}</p>
          <Button className="mt-5 w-full" onClick={() => void register()}>
            <Icon name="faceId" />
            {b.registerButton}
          </Button>
        </>
      )}
      {step === 'confirm' && (
        <>
          <p className="mt-2 text-center">{b.confirmHint}</p>
          <Button className="mt-5 w-full" onClick={() => void confirm()}>
            <Icon name="faceId" />
            {b.confirmButton}
          </Button>
        </>
      )}
      {step === 'working' && <p className="mt-4 text-center text-muted">{b.working}</p>}
      {step !== 'working' && (
        <Button variant="ghost" className="mt-4 w-full" onClick={cancel}>
          {t.confirm.cancel}
        </Button>
      )}
    </dialog>
  )
}
