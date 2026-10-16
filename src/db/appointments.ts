import { db, type AppDB, type Appointment } from './db'

export type AppointmentInput = Omit<Appointment, 'id' | 'updatedAt'> & { id?: string }

/** Crea o actualiza una cita. Devuelve su id. */
export async function saveAppointment(input: AppointmentInput, database: AppDB = db): Promise<string> {
  const id = input.id ?? crypto.randomUUID()
  const clean = (s?: string) => s?.trim() || undefined
  await database.appointments.put({
    ...input,
    id,
    title: clean(input.title),
    place: clean(input.place),
    notes: clean(input.notes),
    updatedAt: Date.now(),
  })
  return id
}

export async function deleteAppointment(id: string, database: AppDB = db): Promise<void> {
  await database.appointments.delete(id)
}
