import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { getSettings } from './db/settings'
import { today } from './domain/dates'
import { predict, type Prediction } from './domain/prediction'

/**
 * Predicción reactiva: se recalcula al cambiar periodos o ajustes y, si se indica
 * `day`, al cambiar de día.
 */
export function usePrediction(day?: string): Prediction | undefined {
  return useLiveQuery(async () => {
    const [periods, settings] = await Promise.all([db.periods.toArray(), getSettings()])
    return predict({
      periods,
      today: today(),
      userCycleLength: settings.cycleLength,
      userPeriodLength: settings.periodLength,
      confirmedLongCycles: settings.confirmedLongCycles,
    })
  }, [day])
}
