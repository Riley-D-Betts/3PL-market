import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { createError } from 'h3'
import { driverShifts } from '../../../database/schema'

/** Sign off: ending mileage and fuel usage close the shift. */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['driver'])
  const body = await readValidatedBody(event, shiftEndSchema.parse)

  const shift = await activeShift(user.id)
  if (!shift) {
    throw createError({ statusCode: 409, statusMessage: 'No active shift to end' })
  }
  if (body.endOdometerMi < shift.startOdometerMi) {
    throw createError({ statusCode: 422, statusMessage: `Ending mileage can't be below your beginning mileage (${shift.startOdometerMi.toLocaleString('en-US')} mi)` })
  }

  const ended = await db.transaction(async (tx) => {
    const [row] = await tx.update(driverShifts)
      .set({
        endedAt: new Date(),
        endOdometerMi: body.endOdometerMi,
        fuelGallons: body.fuelGallons,
      })
      .where(and(eq(driverShifts.id, shift.id), isNull(driverShifts.endedAt)))
      .returning()
    if (!row) {
      throw createError({ statusCode: 409, statusMessage: 'No active shift to end' })
    }

    // Ending mileage advances the truck's odometer (conditionally — the row
    // lock at write time prevents a stale reading from regressing it).
    await tx.update(vehicles)
      .set({ odometerMi: body.endOdometerMi, updatedAt: new Date() })
      .where(and(
        eq(vehicles.id, shift.vehicleId),
        or(isNull(vehicles.odometerMi), lt(vehicles.odometerMi, body.endOdometerMi)),
      ))
    return row
  })

  return { shift: ended }
})
