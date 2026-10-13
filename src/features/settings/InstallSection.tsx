import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { t } from '../../i18n'
import { Section } from './Section'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** "Instalar la app": botón en Android/escritorio e instrucciones en iPhone/iPad. */
export function InstallSection() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const i = t.install

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  return (
    <Section title={i.title} hint={i.hint}>
      {prompt ? (
        <Button
          className="w-full"
          onClick={async () => {
            await prompt.prompt()
            const { outcome } = await prompt.userChoice
            if (outcome === 'accepted') setInstalled(true)
            setPrompt(null)
          }}
        >
          {i.button}
        </Button>
      ) : isIOS() ? (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          {i.iosSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">{i.manual}</p>
      )}
    </Section>
  )
}
