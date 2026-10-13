import { t } from '../i18n'

interface Props {
  id: string
  label: string
  help?: string
  value: number
  min: number
  max: number
  unit: string
  disabled?: boolean
  onChange: (n: number) => void
}

/** Selector numérico con botones grandes de − / +, accesible con teclado y lector de pantalla. */
export function NumberStepper({ id, label, help, value, min, max, unit, disabled, onChange }: Props) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)))
  return (
    <div className={disabled ? 'opacity-50' : ''}>
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      {help && (
        <p id={`${id}-help`} className="text-sm text-muted">
          {help}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          aria-label={t.stepper.minus(label)}
          disabled={disabled || value <= min}
          onClick={() => set(value - 1)}
          className="size-12 rounded-full border border-line bg-surface text-2xl font-bold disabled:opacity-40"
        >
          −
        </button>
        <div className="flex items-baseline gap-1">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={value}
            disabled={disabled}
            aria-describedby={help ? `${id}-help` : undefined}
            onChange={(e) => set(Number(e.target.value) || min)}
            className="w-16 rounded-xl border border-line bg-surface py-2 text-center text-2xl font-extrabold"
          />
          <span className="text-muted">{unit}</span>
        </div>
        <button
          type="button"
          aria-label={t.stepper.plus(label)}
          disabled={disabled || value >= max}
          onClick={() => set(value + 1)}
          className="size-12 rounded-full border border-line bg-surface text-2xl font-bold disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  )
}
