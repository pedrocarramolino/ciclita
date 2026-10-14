import { useId } from 'react'
import { Switch } from '../../components/Switch'
import { setSettings, type Settings, type TrackingSettings } from '../../db/settings'
import { today } from '../../domain/dates'
import { PILL_PACKS, type PillPack } from '../../domain/pill'
import { t } from '../../i18n'
import { Row, Section } from './Section'

const KEYS: (keyof TrackingSettings)[] = ['temperature', 'mucus', 'sex', 'weight', 'pill']

/** Qué datos opcionales aparecen en el registro diario. */
export function TrackingSection({ settings }: { settings: Pick<Settings, 'tracking' | 'pill'> }) {
  const { tracking, pill } = settings
  const s = t.tracking
  const p = t.pill
  const baseId = useId()

  const toggle = (k: keyof TrackingSettings, v: boolean) => {
    // Al activar la píldora sin envase configurado, se supone que empieza hoy.
    const pillPatch = k === 'pill' && v && !pill.start ? { pill: { ...pill, start: today() } } : {}
    void setSettings({ tracking: { ...tracking, [k]: v }, ...pillPatch })
  }

  return (
    <Section title={s.title} hint={s.hint}>
      {KEYS.map((k) => (
        <Row key={k} id={`${baseId}-${k}`} label={s.items[k].label} hint={s.items[k].hint}>
          <Switch labelledBy={`${baseId}-${k}`} checked={tracking[k]} onChange={(v) => toggle(k, v)} />
        </Row>
      ))}

      {tracking.pill && (
        <div className="space-y-3 rounded-2xl bg-surface-soft p-4">
          <div>
            <label htmlFor={`${baseId}-pack`} className="mb-1 block font-bold">
              {p.packLabel}
            </label>
            <select
              id={`${baseId}-pack`}
              value={pill.pack}
              onChange={(e) => void setSettings({ pill: { ...pill, pack: Number(e.target.value) as PillPack } })}
              className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
            >
              {PILL_PACKS.map((n) => (
                <option key={n} value={n}>
                  {p.packs[String(n) as keyof typeof p.packs]}
                </option>
              ))}
            </select>
          </div>
          {pill.pack !== 28 && (
            <div>
              <label htmlFor={`${baseId}-pill-start`} className="mb-1 block font-bold">
                {p.startLabel}
              </label>
              <input
                id={`${baseId}-pill-start`}
                type="date"
                value={pill.start ?? ''}
                max={today()}
                onChange={(e) => e.target.value && void setSettings({ pill: { ...pill, start: e.target.value } })}
                className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4"
              />
              <p className="mt-1 text-xs text-muted">{p.startHint}</p>
            </div>
          )}
        </div>
      )}
    </Section>
  )
}
