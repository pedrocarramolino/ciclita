import type { PregnancyChance } from '../../domain/fertility'
import { t } from '../../i18n'

const LOOK: Record<PregnancyChance, { emoji: string; className: string }> = {
  high: { emoji: '🌸', className: 'bg-primary-soft' },
  medium: { emoji: '🌷', className: 'bg-lavender-soft' },
  low: { emoji: '🌱', className: 'bg-surface-soft' },
}

/** "Posibilidad de embarazo hoy: alta" (o del día del registro). */
export function PregnancyChanceBadge({ chance, today }: { chance: PregnancyChance; today: boolean }) {
  const c = t.chance
  const level = c.levels[chance]
  return (
    <p className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold ${LOOK[chance].className}`}>
      <span aria-hidden="true">{LOOK[chance].emoji}</span>
      {today ? c.today(level) : c.day(level)}
    </p>
  )
}
