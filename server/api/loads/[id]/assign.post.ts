import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { user, company } = await requireApprovedCarrier(event)
  const id = getUuidParam(event)
  const body = await readValidatedBody(event, assignSchema.parse)

  const load = await db.transaction(async (tx) => {
    const [load] = await tx.select().from(loads).where(eq(loads.id, id)).for('update')
    if (!load || load.assignedCompanyId !== company.id) {
      throw createError({ statusCode: 404, statusMessage: 'Load not found' })
    }
    if (load.status !== 'awarded' && load.status !== 'picked_up') {
      throw createError({ statusCode: 409, statusMessage: `Cannot assign a driver to a ${load.status} load` })
    }

    const driver = await tx.query.users.findFirst({
      where: and(eq(users.id, body.driverId), eq(users.companyId, company.id), eq(users.role, 'driver')),
    })
    if (!driver || !driver.isActive) {
      throw createError({ statusCode: 422, statusMessage: 'Driver must be an active driver of your company' })
    }

    let vehicleId: string | null = null
    if (body.vehicleId) {
      const vehicle = await tx.query.vehicles.findFirst({
        where: and(eq(vehicles.id, body.vehicleId), eq(vehicles.companyId, company.id)),
      })
      if (!vehicle || vehicle.status !== 'active') {
        throw createError({ statusCode: 422, statusMessage: 'Vehicle must be an active vehicle of your company' })
      }
      vehicleId = vehicle.id
    }

    const [updated] = await tx.update(loads)
      .set({ assignedDriverId: driver.id, assignedVehicleId: vehicleId, updatedAt: new Date() })
      .where(eq(loads.id, load.id))
      .returning()

    await insertLoadEvent(tx, {
      loadId: load.id,
      actorUserId: user.id,
      eventType: 'driver_assigned',
      payload: { driverId: driver.id, driverName: driver.name, vehicleId },
    })
    return updated!
  })

  return { load }
})
