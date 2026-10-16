import type { AppointmentType } from '../../db/db'

export const APPOINTMENT_TYPES: AppointmentType[] = ['gynecology', 'ultrasound', 'tests', 'midwife', 'other']

export const APPOINTMENT_EMOJI: Record<AppointmentType, string> = {
  gynecology: '🩺',
  ultrasound: '🤰',
  tests: '🧪',
  midwife: '🧑‍⚕️',
  other: '📋',
}
