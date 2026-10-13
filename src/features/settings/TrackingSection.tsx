import { useId } from 'react'
import { Switch } from '../../components/Switch'
import { setSettings, type TrackingSettings } from '../../db/settings'
import { t } from '../../i18n/es'
import { Row, Section } from './Section'

const KEYS: (keyof TrackingSettings)[] = ['temperature', 'mucus', 'sex', 'weight']

/** Qué datos opcionales aparecen en el registro diario. */
export function TrackingSection({ tracking }: { tracking: TrackingSettings }) {
  const s = t.tracking
  const baseId = useId()
  return (
    <Section title={s.title} hint={s.hint}>
      {KEYS.map((k) => (
        <Row key={k} id={`${baseId}-${k}`} label={s.items[k].label} hint={s.items[k].hint}>
          <Switch
            labelledBy={`${baseId}-${k}`}
            checked={tracking[k]}
            onChange={(v) => void setSettings({ tracking: { ...tracking, [k]: v } })}
          />
        </Row>
      ))}
    </Section>
  )
}
