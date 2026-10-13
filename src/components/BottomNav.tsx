import { Icon, type IconName } from './Icon'
import { t } from '../i18n'
import type { Route } from '../useHashRoute'

const ITEMS: { route: Route; icon: IconName; label: string }[] = [
  { route: 'home', icon: 'home', label: t.nav.home },
  { route: 'calendar', icon: 'calendar', label: t.nav.calendar },
  { route: 'stats', icon: 'chart', label: t.nav.stats },
  { route: 'settings', icon: 'settings', label: t.nav.settings },
]

export function BottomNav({ route, onNavigate }: { route: Route; onNavigate: (r: Route) => void }) {
  return (
    <nav
      aria-label={t.nav.label}
      className="no-print fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-md">
        {ITEMS.map((it) => {
          const active = route === it.route
          return (
            <li key={it.route} className="flex-1">
              <a
                href={`#/${it.route}`}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  onNavigate(it.route)
                }}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${
                  active ? 'text-primary' : 'text-muted'
                }`}
              >
                <span
                  className={`grid h-8 w-14 place-items-center rounded-full transition ${active ? 'bg-primary-soft' : ''}`}
                >
                  <Icon name={it.icon} />
                </span>
                {it.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
