import { t } from '../i18n/es'

export function LegalNotice({ className = '' }: { className?: string }) {
  return (
    <p
      role="note"
      className={`rounded-2xl bg-lavender-soft px-4 py-3 text-sm text-ink ${className}`}
    >
      <span aria-hidden="true">ⓘ </span>
      {t.legal}
    </p>
  )
}
