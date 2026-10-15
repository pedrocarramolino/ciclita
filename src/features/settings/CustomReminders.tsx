import { useState, type ReactNode } from "react";
import { Icon } from "../../components/Icon";
import { Button } from "../../components/Button";
import { NumberStepper } from "../../components/NumberStepper";
import type { CustomReminder, Settings } from "../../db/settings";
import { formatDayMonth, today } from "../../domain/dates";
import type { Prediction } from "../../domain/prediction";
import { cycleDayWindows } from "../../domain/reminderEvents";
import { t } from "../../i18n";
import { MEDICATION_NAME_MAX } from "../../push/reminderPayload";
import { Section } from "./Section";

/** Como mucho 3 (el servidor admite 6 hábitos: temperatura, peso, medicación y estos). */
export const MAX_CUSTOM = 3;
const MAX_CYCLE_DAY = 60;
const INPUT = "min-h-12 w-full rounded-2xl border border-line bg-surface px-4";

/**
 * "Tus recordatorios": avisos libres con nombre y hora, todos los días o solo unos días
 * del ciclo (p. ej. una pastilla del día 15 al 26).
 */
export function CustomReminders({
  settings,
  prediction,
  disabled,
  onChange,
  timeField,
}: {
  settings: Settings;
  prediction: Prediction | undefined;
  disabled: boolean;
  onChange: (custom: CustomReminder[]) => void;
  timeField: (
    id: string,
    value: string,
    onChange: (v: string) => void,
  ) => ReactNode;
}) {
  const list = settings.reminders.custom;
  const u = t.settings.reminderUi;
  // Solo uno desplegado a la vez; los demás se ven como una fila con su nombre.
  const [open, setOpen] = useState<string | null>(null);
  const set = (id: string, patch: Partial<CustomReminder>) =>
    onChange(list.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <Section title={u.customGroup} hint={u.customHint}>
      {list.map((c, i) => {
        const windows = c.cycleDays
          ? cycleDayWindows(
              prediction ?? null,
              c.cycleDays.from,
              c.cycleDays.to,
              today(),
            )
          : [];
        const title = c.name.trim() || u.customLabel(i + 1);
        const summary = `${c.time} · ${c.cycleDays ? u.customDaysSummary(c.cycleDays.from, c.cycleDays.to) : u.customEveryDay.toLowerCase()}`;
        const expanded = open === c.id;
        return (
          <div key={c.id} className="rounded-2xl bg-surface-soft">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`${c.id}-panel`}
              onClick={() => setOpen(expanded ? null : c.id)}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{title}</span>
                <span className="block text-sm text-muted">{summary}</span>
              </span>
              <Icon
                name="chevronRight"
                className={`size-5 shrink-0 text-muted transition ${expanded ? "rotate-90" : ""}`}
              />
            </button>
            {expanded && (
              <fieldset id={`${c.id}-panel`} className="space-y-3 px-4 pb-4">
                <legend className="sr-only">{title}</legend>
                <div>
                  <label
                    htmlFor={`${c.id}-name`}
                    className="mb-1 block text-sm font-bold text-muted"
                  >
                    {u.customName}
                  </label>
                  <input
                    id={`${c.id}-name`}
                    type="text"
                    value={c.name}
                    maxLength={MEDICATION_NAME_MAX}
                    placeholder={u.customPlaceholder}
                    onChange={(e) => set(c.id, { name: e.target.value })}
                    className={INPUT}
                  />
                </div>
                {timeField(`${c.id}-time`, c.time, (v) =>
                  set(c.id, { time: v }),
                )}
                <div>
                  <label
                    htmlFor={`${c.id}-when`}
                    className="mb-1 block text-sm font-bold text-muted"
                  >
                    {u.customWhen}
                  </label>
                  <select
                    id={`${c.id}-when`}
                    value={c.cycleDays ? "cycle" : "daily"}
                    onChange={(e) =>
                      set(c.id, {
                        cycleDays:
                          e.target.value === "cycle"
                            ? { from: 15, to: 26 }
                            : null,
                      })
                    }
                    className={INPUT}
                  >
                    <option value="daily">{u.customEveryDay}</option>
                    <option value="cycle">{u.customCycleDays}</option>
                  </select>
                </div>
                {c.cycleDays && (
                  <>
                    <NumberStepper
                      id={`${c.id}-from`}
                      label={u.customFrom}
                      value={c.cycleDays.from}
                      min={1}
                      max={MAX_CYCLE_DAY}
                      unit=""
                      onChange={(n) =>
                        set(c.id, {
                          cycleDays: {
                            from: n,
                            to: Math.max(n, c.cycleDays!.to),
                          },
                        })
                      }
                    />
                    <NumberStepper
                      id={`${c.id}-to`}
                      label={u.customTo}
                      value={c.cycleDays.to}
                      min={c.cycleDays.from}
                      max={MAX_CYCLE_DAY}
                      unit=""
                      onChange={(n) =>
                        set(c.id, {
                          cycleDays: { from: c.cycleDays!.from, to: n },
                        })
                      }
                    />
                    <p className="text-sm text-muted">{u.customCycleHint}</p>
                    <p className="text-sm font-bold">
                      {settings.mode !== "cycle"
                        ? u.customOtherMode
                        : windows[0]
                          ? u.customNext(
                              formatDayMonth(windows[0].from),
                              formatDayMonth(windows[0].until),
                            )
                          : u.customNoPrediction}
                    </p>
                  </>
                )}
                <div className="grid gap-2">
                  <Button variant="secondary" onClick={() => setOpen(null)}>
                    {u.customDone}
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-danger"
                    onClick={() => onChange(list.filter((x) => x.id !== c.id))}
                  >
                    {u.customRemove}
                  </Button>
                </div>
              </fieldset>
            )}
          </div>
        );
      })}
      {list.length < MAX_CUSTOM && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={disabled}
          onClick={() => {
            // El nuevo se abre para rellenarlo.
            const id = `custom-${Date.now().toString(36)}`;
            onChange([
              ...list,
              { id, name: "", time: "21:00", cycleDays: null },
            ]);
            setOpen(id);
          }}
        >
          {u.customAdd}
        </Button>
      )}
    </Section>
  );
}
