import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { PinPad } from '../../components/PinPad'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { setSettings } from '../../db/settings'
import { disableEncryption, enableEncryption, isVaultUnlocked, rekeyVault } from '../../db/vault'
import { hashPin, verifyPin } from '../../security/pin'
import { t } from '../../i18n/es'
import { Section } from './Section'

type Flow = 'set' | 'change' | 'remove' | 'encrypt' | 'decrypt'
type Step = 'current' | 'new' | 'repeat' | 'working'

/** Recarga la app tras activar o desactivar el cifrado (cambia dónde viven los datos). */
const reloadApp = () => setTimeout(() => location.reload(), 600)

export function PinSection({ pinHash }: { pinHash: string | null }) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const [confirmEncrypt, setConfirmEncrypt] = useState(false)
  const [status, setStatus] = useState('')
  const encrypted = isVaultUnlocked()
  const s = t.settings
  const e = t.encryption

  return (
    <Section title={s.security}>
      <div>
        <p className="font-bold">{s.pin}</p>
        <p className="text-sm text-muted">{pinHash ? s.pinOn : s.pinOff}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {pinHash ? (
          <>
            <Button variant="secondary" onClick={() => setFlow('change')}>
              {s.pinChange}
            </Button>
            {!encrypted && (
              <Button variant="ghost" onClick={() => setFlow('remove')}>
                {s.pinRemove}
              </Button>
            )}
          </>
        ) : (
          <Button onClick={() => setFlow('set')}>{s.pinSet}</Button>
        )}
      </div>
      {!encrypted && <p className="text-xs text-muted">{s.pinNote}</p>}

      {/* Cifrado de los datos con el PIN */}
      <div className="rounded-2xl bg-surface-soft p-4">
        <p className="font-bold">{e.title}</p>
        <p className="mt-1 text-sm text-muted">{encrypted ? e.on : pinHash ? e.offWithPin : e.offNoPin}</p>
        {encrypted ? (
          <>
            <p className="mt-2 text-xs text-muted">{e.removePinBlocked}</p>
            <Button variant="secondary" className="mt-3" onClick={() => setFlow('decrypt')}>
              {e.disable}
            </Button>
          </>
        ) : (
          pinHash && (
            <Button className="mt-3" onClick={() => setConfirmEncrypt(true)}>
              {e.enable}
            </Button>
          )
        )}
      </div>

      <p role="status" className="text-sm font-bold">
        {status}
      </p>
      {confirmEncrypt && (
        <ConfirmDialog
          title={e.confirmTitle}
          confirmLabel={e.confirmButton}
          onConfirm={() => {
            setConfirmEncrypt(false)
            setFlow('encrypt')
          }}
          onCancel={() => setConfirmEncrypt(false)}
        >
          <ul className="list-disc space-y-2 pl-5">
            {e.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </ConfirmDialog>
      )}
      {flow && (
        <PinDialog
          flow={flow}
          pinHash={pinHash}
          onDone={(msg) => {
            setFlow(null)
            setStatus(msg)
          }}
          onCancel={() => setFlow(null)}
        />
      )}
    </Section>
  )
}

function PinDialog({
  flow,
  pinHash,
  onDone,
  onCancel,
}: {
  flow: Flow
  pinHash: string | null
  onDone: (msg: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [step, setStep] = useState<Step>(flow === 'set' ? 'new' : 'current')
  const [first, setFirst] = useState('')
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const s = t.settings
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

  const next = (nextStep: Step, err = '') => {
    setError(err)
    setStep(nextStep)
    setAttempt((a) => a + 1)
  }

  const e = t.encryption

  const onPin = async (pin: string) => {
    if (step === 'current') {
      if (!pinHash || !(await verifyPin(pin, pinHash))) return next('current', t.lock.wrong)
      if (flow === 'remove') {
        await setSettings({ pinHash: null, pinFailures: 0, pinLockedUntil: 0 })
        return onDone(s.pinRemoved)
      }
      if (flow === 'encrypt' || flow === 'decrypt') {
        setStep('working')
        try {
          if (flow === 'encrypt') await enableEncryption(pin)
          else await disableEncryption()
        } catch (err) {
          console.error(err)
          return next('current', e.failed)
        }
        reloadApp()
        return
      }
      return next('new')
    }
    if (step === 'new') {
      setFirst(pin)
      return next('repeat')
    }
    if (pin !== first) return next('new', s.pinMismatch)
    await setSettings({ pinHash: await hashPin(pin), pinFailures: 0, pinLockedUntil: 0 })
    // Con el cifrado activado, los datos se vuelven a cifrar con el PIN nuevo.
    if (isVaultUnlocked()) await rekeyVault(pin)
    onDone(s.pinSaved)
  }

  const title =
    step === 'working'
      ? flow === 'encrypt'
        ? e.encrypting
        : e.decrypting
      : step === 'current'
        ? s.pinCurrent
        : step === 'new'
          ? s.pinNew
          : s.pinRepeat

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl bg-bg p-6 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <h2 id={titleId} className="text-center text-xl font-extrabold" aria-live="polite">
        {title}
      </h2>
      <p role="alert" className="mt-2 min-h-5 text-center text-sm font-bold text-danger">
        {error}
      </p>
      <div className="mt-4">
        <PinPad onComplete={(p) => void onPin(p)} resetKey={attempt} disabled={step === 'working'} />
      </div>
      {step !== 'working' && (
        <Button variant="ghost" className="mt-6 w-full" onClick={onCancel}>
          {t.confirm.cancel}
        </Button>
      )}
    </dialog>
  )
}
