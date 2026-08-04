import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const id = getUuidParam(event)
  const body = await readValidatedBody(event, maintenanceLogSchema.parse)

  const vehicle = await db.query.vehicles.findFirst({
    where: and(eq(vehicles.id, id), eq(vehicles.companyId, company.id)),
  })
  if (!vehicle) {
    throw createError({ statusCode: 404, statusMessage: 'Vehicle not found' })
  }

  const [log] = await db.insert(vehicleMaintenanceLogs).values({
    vehicleId: id,
    performedAt: body.performedAt,
    description: body.description,
    costCents: body.costCents ?? null,
    odometerMi: body.odometerMi ?? null,
  }).returning()

  // A logged service with a reading also advances the vehicle odometer.
  if (body.odometerMi && (!vehicle.odometerMi || body.odometerMi > vehicle.odometerMi)) {
    await db.update(vehicles)
      .set({ odometerMi: body.odometerMi, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
  }

  setResponseStatus(event, 201)
  return { log }
})
