import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { PinPad } from '../../components/PinPad'
import { getSettings, setSettings } from '../../db/settings'
import { lockoutMs, MAX_ATTEMPTS, verifyPin } from '../../security/pin'
import { t } from '../../i18n/es'
import { DeleteAllFlow } from '../settings/DeleteAllFlow'

/** Pantalla de bloqueo. Los intentos fallidos se guardan para que recargar no los reinicie. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [attempt, setAttempt] = useState(0)
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)
  const [lockedUntil, setLockedUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [forgot, setForgot] = useState(false)
  const [wiping, setWiping] = useState(false)
  const l = t.lock

  useEffect(() => {
    void getSettings().then((s) => setLockedUntil(s.pinLockedUntil))
  }, [])

  const waiting = lockedUntil > now
  useEffect(() => {
    if (!waiting) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [waiting])

  const submit = async (pin: string) => {
    setChecking(true)
    const s = await getSettings()
    if (s.pinHash && (await verifyPin(pin, s.pinHash))) {
      await setSettings({ pinFailures: 0, pinLockedUntil: 0 })
      onUnlock()
      return
    }
    const failures = s.pinFailures + 1
    const until = Date.now() + lockoutMs(failures)
    await setSettings({ pinFailures: failures, pinLockedUntil: until })
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
      <p role="alert" className="mt-2 min-h-12 text-center text-sm font-bold text-danger">
        {waiting ? l.wait(Math.ceil((lockedUntil - now) / 1000)) : message}
      </p>
      <div className="mt-2 w-full">
        <PinPad onComplete={(p) => void submit(p)} disabled={checking || waiting} resetKey={attempt} />
      </div>
      <Button variant="ghost" className="mt-8 text-sm" onClick={() => setForgot(true)}>
        {l.forgot}
      </Button>
      {forgot && !wiping && (
        <section className="mt-2 rounded-3xl bg-surface p-5 text-sm shadow-sm">
          <p>{l.forgotBody}</p>
          <Button variant="danger" className="mt-4 w-full" onClick={() => setWiping(true)}>
            {t.settings.deleteAll}
          </Button>
        </section>
      )}
      {wiping && <DeleteAllFlow onCancel={() => setWiping(false)} />}
    </main>
  )
}
