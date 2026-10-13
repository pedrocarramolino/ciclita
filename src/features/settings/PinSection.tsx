import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { PinPad } from '../../components/PinPad'
import { setSettings } from '../../db/settings'
import { hashPin, verifyPin } from '../../security/pin'
import { t } from '../../i18n/es'
import { Section } from './Section'

type Flow = 'set' | 'change' | 'remove'
type Step = 'current' | 'new' | 'repeat'

export function PinSection({ pinHash }: { pinHash: string | null }) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const [status, setStatus] = useState('')
  const s = t.settings

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
            <Button variant="ghost" onClick={() => setFlow('remove')}>
              {s.pinRemove}
            </Button>
          </>
        ) : (
          <Button onClick={() => setFlow('set')}>{s.pinSet}</Button>
        )}
      </div>
      <p className="text-xs text-muted">{s.pinNote}</p>
      <p role="status" className="text-sm font-bold">
        {status}
      </p>
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

  const onPin = async (pin: string) => {
    if (step === 'current') {
      if (!pinHash || !(await verifyPin(pin, pinHash))) return next('current', t.lock.wrong)
      if (flow === 'remove') {
        await setSettings({ pinHash: null, pinFailures: 0, pinLockedUntil: 0 })
        return onDone(s.pinRemoved)
      }
      return next('new')
    }
    if (step === 'new') {
      setFirst(pin)
      return next('repeat')
    }
    if (pin !== first) return next('new', s.pinMismatch)
    await setSettings({ pinHash: await hashPin(pin), pinFailures: 0, pinLockedUntil: 0 })
    onDone(s.pinSaved)
  }

  const title = step === 'current' ? s.pinCurrent : step === 'new' ? s.pinNew : s.pinRepeat

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
        <PinPad onComplete={(p) => void onPin(p)} resetKey={attempt} />
      </div>
      <Button variant="ghost" className="mt-6 w-full" onClick={onCancel}>
        {t.confirm.cancel}
      </Button>
    </dialog>
  )
}
