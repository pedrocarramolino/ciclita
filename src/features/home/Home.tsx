import { Icon } from '../../components/Icon'
import { t } from '../../i18n/es'

/** Provisional hasta la fase 3. */
export function Home() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-4 text-center">
      <div className="grid size-20 place-items-center rounded-full bg-rose-soft text-primary">
        <Icon name="check" className="size-10" />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold">{t.home.ready}</h1>
      <p className="mt-2 text-muted">{t.home.soon}</p>
    </main>
  )
}
