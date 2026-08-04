import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { createError } from 'h3'
import { driverShifts } from '../../../database/schema'

/**
 * Sign on for the day: truck number, pre-trip inspection, beginning mileage.
 * The partial unique index (one un-ended shift per driver) decides races.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['driver'])
  const body = await readValidatedBody(event, shiftStartSchema.parse)

  const vehicle = await db.query.vehicles.findFirst({
    where: and(eq(vehicles.id, body.vehicleId), eq(vehicles.companyId, user.companyId!)),
  })
  if (!vehicle || vehicle.status !== 'active') {
    throw createError({ statusCode: 422, statusMessage: 'Pick an active truck from your company fleet' })
  }

  try {
    const shift = await db.transaction(async (tx) => {
      const [created] = await tx.insert(driverShifts).values({
        driverId: user.id,
        companyId: user.companyId!,
        vehicleId: vehicle.id,
        startOdometerMi: body.startOdometerMi,
        pretrip: body.checklist,
        pretripDefects: body.defects ?? null,
      }).returning()

      // A begin mileage ahead of the vehicle record advances the odometer.
      // Conditional UPDATE: the row lock decides concurrent advances, so a
      // stale reading can never regress the odometer.
      await tx.update(vehicles)
        .set({ odometerMi: body.startOdometerMi, updatedAt: new Date() })
        .where(and(
          eq(vehicles.id, vehicle.id),
          or(isNull(vehicles.odometerMi), lt(vehicles.odometerMi, body.startOdometerMi)),
        ))
      return created!
    })

    setResponseStatus(event, 201)
    return { shift }
  }
  catch (err) {
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'You already have an active shift — end it before starting a new one' })
    }
    throw err
  }
})
