import { useEffect, useRef } from 'react'
import { PRIVACY_VERSION } from '../../account/account'
import { Button } from '../../components/Button'
import { Icon } from '../../components/Icon'
import { formatLong } from '../../domain/dates'
import { t } from '../../i18n'

/** Política de privacidad (se puede leer antes de registrarse y desde Ajustes). */
export function PrivacyPolicy({ onClose }: { onClose: () => void }) {
  const p = t.privacy
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => titleRef.current?.focus(), [])
  return (
    <main className="mx-auto w-full max-w-md px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Button variant="ghost" className="-ml-3 px-3" onClick={onClose}>
        <Icon name="arrowLeft" />
        {t.account.back}
      </Button>
      <h1 ref={titleRef} tabIndex={-1} className="mt-2 text-3xl font-extrabold">
        {p.title}
      </h1>
      <p className="mt-1 text-sm text-muted">{p.updated(formatLong(PRIVACY_VERSION))}</p>
      {p.sections.map((s) => (
        <section key={s.h} className="mt-6">
          <h2 className="text-lg font-extrabold">{s.h}</h2>
          {s.p.map((para) => (
            <p key={para} className="mt-2">
              {para}
            </p>
          ))}
        </section>
      ))}
      <Button className="mt-8 w-full" onClick={onClose}>
        {p.close}
      </Button>
    </main>
  )
}
