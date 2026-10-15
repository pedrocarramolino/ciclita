import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { AccountError, login, register, sendReset, type AccountErrorCode } from '../../account/account'
import {
  isEmail,
  MAX_NAME,
  passwordStrength,
  validateRegister,
  type RegisterErrorKey,
  type RegisterForm,
} from '../../account/validation'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { today } from '../../domain/dates'
import { LANGS, lang, setLanguage, t } from '../../i18n'
import { PrivacyPolicy } from './PrivacyPolicy'

type View = 'register' | 'login' | 'reset' | 'privacy'

const INPUT =
  'min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base aria-invalid:border-danger aria-invalid:border-2'

/**
 * Registro e inicio de sesión (la cuenta es obligatoria). `hasLocalData`: el
 * dispositivo ya tiene registros, que se subirán a la cuenta nueva o se unirán a la
 * existente.
 */
export function AuthScreen({ hasLocalData = false }: { hasLocalData?: boolean }) {
  const [view, setView] = useState<View>('register')
  const [back, setBack] = useState<View>('register')
  const a = t.account

  if (view === 'privacy') return <PrivacyPolicy onClose={() => setView(back)} />

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <div role="group" aria-label={t.settings.language} className="-ml-1 flex gap-1">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              lang={l}
              aria-pressed={l === lang}
              onClick={() => l !== lang && setLanguage(l)}
              className="min-h-11 rounded-full px-3 text-sm font-bold text-muted aria-pressed:bg-primary-soft aria-pressed:text-ink"
            >
              {t.settings.languages[l]}
            </button>
          ))}
        </div>
        <img src="/icons/icon.svg" alt="" width={40} height={40} className="size-10 rounded-[28%]" />
      </div>

      {view === 'register' && (
        <RegisterView
          hasLocalData={hasLocalData}
          onLogin={() => setView('login')}
          onPrivacy={() => {
            setBack('register')
            setView('privacy')
          }}
        />
      )}
      {view === 'login' && <LoginView onRegister={() => setView('register')} onReset={() => setView('reset')} />}
      {view === 'reset' && <ResetView onBack={() => setView('login')} />}

      <p className="mt-6 text-center text-xs text-muted">
        <button
          type="button"
          className="min-h-11 underline"
          onClick={() => {
            setBack(view)
            setView('privacy')
          }}
        >
          {a.privacyLink[0].toUpperCase() + a.privacyLink.slice(1)}
        </button>
      </p>
    </main>
  )
}

/** Lleva el foco al título al abrir cada vista (para lectores de pantalla). */
function useFocusTitle() {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return ref
}

const errorText = (k: RegisterErrorKey | AccountErrorCode) => t.account.errors[k]

// ---------- Registro ----------

const EMPTY: RegisterForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirm: '',
  birthDate: '',
  country: '',
  acceptPrivacy: false,
  acceptHealth: false,
  marketing: false,
}

function RegisterView({
  hasLocalData,
  onLogin,
  onPrivacy,
}: {
  hasLocalData: boolean
  onLogin: () => void
  onPrivacy: () => void
}) {
  const [f, setF] = useState<RegisterForm>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterForm, string>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const a = t.account
  const titleRef = useFocusTitle()

  const set = <K extends keyof RegisterForm>(k: K, v: RegisterForm[K]) => {
    const next = { ...f, [k]: v }
    setF(next)
    // Tras el primer intento, los errores se actualizan al escribir.
    if (submitted) setErrors(translate(validateRegister(next, today())))
  }

  const translate = (e: ReturnType<typeof validateRegister>) =>
    Object.fromEntries(Object.entries(e).map(([k, v]) => [k, errorText(v)])) as Partial<Record<keyof RegisterForm, string>>

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setSubmitted(true)
    setServerError('')
    const e = translate(validateRegister(f, today()))
    setErrors(e)
    const first = Object.keys(e)[0]
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    setBusy(true)
    try {
      await register({
        firstName: f.firstName,
        lastName: f.lastName,
        email: f.email,
        password: f.password,
        birthDate: f.birthDate as string,
        country: f.country,
        marketing: f.marketing,
      })
    } catch (err) {
      const code = err instanceof AccountError ? err.code : 'unknown'
      if (code === 'emailInUse' || code === 'invalidEmail') {
        setErrors({ email: errorText(code) })
        formRef.current?.querySelector<HTMLElement>('[name="email"]')?.focus()
      } else if (code === 'weakPassword') setErrors({ password: errorText(code) })
      else setServerError(errorText(code))
      setBusy(false)
    }
  }

  const count = Object.keys(errors).length
  const strength = passwordStrength(f.password)

  return (
    <section className="flex flex-1 flex-col pt-6">
      <h1 ref={titleRef} tabIndex={-1} className="text-3xl font-extrabold">
        {a.registerTitle}
      </h1>
      <p className="mt-2 text-muted">{hasLocalData ? a.existingData : a.registerHint}</p>
      <p className="mt-3 text-sm">
        {a.haveAccount}{' '}
        <button type="button" className="min-h-11 font-bold text-primary underline" onClick={onLogin}>
          {a.goLogin}
        </button>
      </p>

      <form ref={formRef} noValidate onSubmit={submit} className="mt-4 space-y-4">
        {submitted && count > 0 && (
          <p role="alert" className="rounded-2xl bg-rose-soft p-3 text-sm font-bold">
            {a.fixErrors(count)}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
          <Field label={a.firstName} error={errors.firstName}>
            {(p) => (
              <input
                {...p}
                name="firstName"
                autoComplete="given-name"
                maxLength={MAX_NAME}
                value={f.firstName}
                onChange={(e) => set('firstName', e.target.value)}
                className={INPUT}
              />
            )}
          </Field>
          <Field label={a.lastName} error={errors.lastName}>
            {(p) => (
              <input
                {...p}
                name="lastName"
                autoComplete="family-name"
                maxLength={MAX_NAME}
                value={f.lastName}
                onChange={(e) => set('lastName', e.target.value)}
                className={INPUT}
              />
            )}
          </Field>
        </div>
        <Field label={a.email} error={errors.email}>
          {(p) => (
            <input
              {...p}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={f.email}
              onChange={(e) => set('email', e.target.value)}
              className={INPUT}
            />
          )}
        </Field>
        <Field label={a.password} error={errors.password} hint={a.passwordRules}>
          {(p) => (
            <PasswordInput
              {...p}
              name="password"
              autoComplete="new-password"
              value={f.password}
              onChange={(v) => set('password', v)}
            />
          )}
        </Field>
        {f.password && <StrengthMeter score={strength} />}
        <Field label={a.confirm} error={errors.confirm}>
          {(p) => (
            <PasswordInput
              {...p}
              name="confirm"
              autoComplete="new-password"
              value={f.confirm}
              onChange={(v) => set('confirm', v)}
            />
          )}
        </Field>
        <Field label={a.birthDate} error={errors.birthDate}>
          {(p) => (
            <input
              {...p}
              name="birthDate"
              type="date"
              autoComplete="bday"
              max={today()}
              min="1900-01-01"
              value={f.birthDate}
              onChange={(e) => set('birthDate', e.target.value)}
              className={INPUT}
            />
          )}
        </Field>
        <Field label={`${a.country} ${a.optional}`}>
          {(p) => (
            <select
              {...p}
              name="country"
              autoComplete="country"
              value={f.country}
              onChange={(e) => set('country', e.target.value)}
              className={INPUT}
            >
              <option value="">{a.countryNone}</option>
              {Object.entries(a.countries).map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="space-y-3 rounded-2xl bg-surface p-4">
          <Check
            name="acceptPrivacy"
            checked={f.acceptPrivacy}
            onChange={(v) => set('acceptPrivacy', v)}
            error={errors.acceptPrivacy}
          >
            {a.acceptPrivacy}{' '}
            <button type="button" className="font-bold text-primary underline" onClick={onPrivacy}>
              {a.privacyLink}
            </button>
          </Check>
          <Check
            name="acceptHealth"
            checked={f.acceptHealth}
            onChange={(v) => set('acceptHealth', v)}
            error={errors.acceptHealth}
          >
            {a.acceptHealth}
          </Check>
          <Check name="marketing" checked={f.marketing} onChange={(v) => set('marketing', v)}>
            {a.marketing} <span className="text-muted">{a.optional}</span>
          </Check>
        </div>

        {serverError && (
          <p role="alert" className="text-sm font-bold text-danger">
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? a.creating : a.createAccount}
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-muted">{t.legal}</p>
    </section>
  )
}

// ---------- Inicio de sesión ----------

function LoginView({ onRegister, onReset }: { onRegister: () => void; onReset: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const a = t.account
  const titleRef = useFocusTitle()

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!isEmail(email) || !password) return setError(errorText('wrongCredentials'))
    setBusy(true)
    setError('')
    try {
      await login(email, password)
    } catch (err) {
      setError(errorText(err instanceof AccountError ? err.code : 'unknown'))
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-1 flex-col pt-6">
      <h1 ref={titleRef} tabIndex={-1} className="text-3xl font-extrabold">
        {a.loginTitle}
      </h1>
      <p className="mt-2 text-muted">{a.loginHint}</p>
      <form noValidate onSubmit={submit} className="mt-6 space-y-4">
        <Field label={a.email}>
          {(p) => (
            <input
              {...p}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
          )}
        </Field>
        <Field label={a.password}>
          {(p) => (
            <PasswordInput {...p} name="password" autoComplete="current-password" value={password} onChange={setPassword} />
          )}
        </Field>
        <button type="button" className="min-h-11 text-sm font-bold text-primary underline" onClick={onReset}>
          {a.forgot}
        </button>
        {error && (
          <p role="alert" className="text-sm font-bold text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? a.loggingIn : a.login}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        {a.noAccount}{' '}
        <button type="button" className="min-h-11 font-bold text-primary underline" onClick={onRegister}>
          {a.goRegister}
        </button>
      </p>
    </section>
  )
}

// ---------- Recuperar contraseña ----------

function ResetView({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'busy' | 'sent'>('idle')
  const [error, setError] = useState('')
  const a = t.account
  const titleRef = useFocusTitle()

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (!isEmail(email)) return setError(errorText('email'))
    setError('')
    setStatus('busy')
    try {
      await sendReset(email)
      setStatus('sent')
    } catch (err) {
      setError(errorText(err instanceof AccountError ? err.code : 'unknown'))
      setStatus('idle')
    }
  }

  return (
    <section className="flex flex-1 flex-col pt-6">
      <Button variant="ghost" className="-ml-3 self-start px-3" onClick={onBack}>
        <Icon name="arrowLeft" />
        {a.back}
      </Button>
      <h1 ref={titleRef} tabIndex={-1} className="mt-2 text-3xl font-extrabold">
        {a.resetTitle}
      </h1>
      <p className="mt-2 text-muted">{a.resetHint}</p>
      <form noValidate onSubmit={submit} className="mt-6 space-y-4">
        <Field label={a.email} error={error}>
          {(p) => (
            <input
              {...p}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
          )}
        </Field>
        <p role="status" className="text-sm font-bold empty:hidden">
          {status === 'sent' ? a.resetSent : ''}
        </p>
        <Button type="submit" className="w-full" disabled={status === 'busy'}>
          {a.resetSend}
        </Button>
      </form>
    </section>
  )
}

// ---------- Piezas del formulario ----------

interface FieldProps {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

/** Etiqueta, ayuda y error asociados al control (para lectores de pantalla). */
function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: (p: FieldProps) => ReactNode
}) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-bold">
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function PasswordInput({
  value,
  onChange,
  name,
  autoComplete,
  ...p
}: FieldProps & { value: string; onChange: (v: string) => void; name: string; autoComplete: string }) {
  const [shown, setShown] = useState(false)
  const a = t.account
  return (
    <div className="relative">
      <input
        {...p}
        name={name}
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT} pr-24`}
      />
      <button
        type="button"
        aria-pressed={shown}
        aria-label={shown ? a.hidePassword : a.showPassword}
        onClick={() => setShown(!shown)}
        className="absolute inset-y-0 right-1 my-auto h-10 rounded-xl px-3 text-sm font-bold text-primary"
      >
        {shown ? a.hide : a.show}
      </button>
    </div>
  )
}

function StrengthMeter({ score }: { score: 0 | 1 | 2 | 3 | 4 }) {
  const label = t.account.strength[score]
  return (
    <div className="-mt-2" role="img" aria-label={t.account.strengthLabel(label)}>
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= score ? 'bg-primary' : 'bg-line'}`} />
        ))}
      </div>
      <p className="mt-1 text-xs font-bold text-muted" aria-hidden="true">
        {label}
      </p>
    </div>
  )
}

function Check({
  name,
  checked,
  onChange,
  error,
  children,
}: {
  name: string
  checked: boolean
  onChange: (v: boolean) => void
  error?: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 size-6 shrink-0 accent-[var(--primary)]"
        />
        <label htmlFor={id} className="text-sm">
          {children}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 ml-9 text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
