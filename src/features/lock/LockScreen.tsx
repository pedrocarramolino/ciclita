import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { PinPad } from '../../components/PinPad'
import { isCancel } from '../../security/biometric'
import { lockoutMs, MAX_ATTEMPTS } from '../../security/pin'
import { settingsPinCheck, type PinCheck } from './pinCheck'
import { t } from '../../i18n'
import { DeleteAllFlow } from '../settings/DeleteAllFlow'

/** Pantalla de bloqueo con teclado numérico, esperas tras fallos y "¿Has olvidado tu PIN?". */
export function LockScreen({
  onUnlock,
  check = settingsPinCheck,
  encrypted = false,
  biometric,
}: {
  onUnlock: () => void
  check?: PinCheck
  /** Con el cifrado activado se avisa de que olvidar el PIN hace perder los datos. */
  encrypted?: boolean
  /** Desbloqueo con Face ID o huella; devuelve true si ha desbloqueado. */
  biometric?: () => Promise<boolean>
}) {
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [forgot, setForgot] = useState(false)
  const [wiping, setWiping] = useState(false)
  const l = t.lock

  useEffect(() => {
    void check.getState().then((s) => setLockedUntil(s.lockedUntil))
  }, [check])

  const waiting = lockedUntil > now
  useEffect(() => {
    if (!waiting) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [waiting])

  const unlocked = async () => {
    await check.setState({ failures: 0, lockedUntil: 0 })
    onUnlock()
  }

  // Al abrir se pide la cara o la huella directamente; si el sistema no deja (iOS
  // puede exigir un toque) o se cancela, queda el botón y el PIN.
  const tryBiometric = async (auto: boolean) => {
    if (!biometric) return
    setChecking(true)
    setMessage(encrypted ? l.unlocking : '')
    try {
      if (await biometric()) return void (await unlocked())
      if (!auto) setMessage(l.bioFailed)
    } catch (e) {
      if (!auto && !isCancel(e)) setMessage(l.bioFailed)
      else setMessage('')
    }
    setChecking(false)
  }
  const autoTried = useRef(false)
  useEffect(() => {
    if (!biometric || autoTried.current) return
    autoTried.current = true
    void tryBiometric(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometric])

  const submit = async (pin: string) => {
    setChecking(true)
    setMessage(encrypted ? l.unlocking : '')
    if (await check.verify(pin)) return void (await unlocked())
    const { failures: prev } = await check.getState()
    const failures = prev + 1
    const until = Date.now() + lockoutMs(failures)
    await check.setState({ failures, lockedUntil: until })
    setLockedUntil(until)
    setNow(Date.now())
    const left = MAX_ATTEMPTS - failures
    setMessage(left > 0 ? `${l.wrong} ${l.attemptsLeft(left)}` : l.wrong)
    setAttempt((a) => a + 1)
    setChecking(false)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 py-8">
      <div className="grid size-16 place-items-center rounded-full bg-rose-soft text-primary">
        <Icon name="lock" className="size-8" />
      </div>
      <h1 className="mt-4 text-2xl font-extrabold">{l.title}</h1>
      {encrypted && <p className="mt-1 text-sm text-muted">{l.encryptedHint}</p>}
      <p role="alert" className={`mt-2 min-h-12 text-center text-sm font-bold ${checking ? 'text-muted' : 'text-danger'}`}>
        {waiting ? l.wait(Math.ceil((lockedUntil - now) / 1000)) : message}
      </p>
      <div className="mt-2 w-full">
        <PinPad onComplete={(p) => void submit(p)} disabled={checking || waiting} resetKey={attempt} />
      </div>
      {biometric && (
        <Button variant="secondary" className="mt-6" disabled={checking} onClick={() => void tryBiometric(false)}>
          <Icon name="faceId" />
          {l.useBiometric}
        </Button>
      )}
      <Button variant="ghost" className="mt-6 text-sm" onClick={() => setForgot(true)}>
        {l.forgot}
      </Button>
      {forgot && !wiping && (
        <section className="mt-2 rounded-3xl bg-surface p-5 text-sm shadow-sm">
          <p>{encrypted ? l.forgotEncrypted : l.forgotBody}</p>
          <Button variant="danger" className="mt-4 w-full" onClick={() => setWiping(true)}>
            {t.settings.deleteAll}
          </Button>
        </section>
      )}
      {wiping && <DeleteAllFlow onCancel={() => setWiping(false)} />}
    </main>
  )
}
