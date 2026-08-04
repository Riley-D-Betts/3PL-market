import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'

/**
 * Create a manual (off-platform) load: freight the carrier hauls outside the
 * marketplace but manages here — calendar, day board, driver flow and reports
 * all treat it like any won load. Starts at `awarded`, never touches the board.
 */
export default defineEventHandler(async (event) => {
  const { user, company } = await requireCarrierCompany(event)
  const body = await readValidatedBody(event, manualLoadSchema.parse)

  const pickupPoint = await geocodeCityState(body.pickupCity, body.pickupState)
  const deliveryPoint = await geocodeCityState(body.deliveryCity, body.deliveryState)

  const load = await db.transaction(async (tx) => {
    let driver = null
    if (body.driverId) {
      driver = await tx.query.users.findFirst({
        where: and(eq(users.id, body.driverId), eq(users.companyId, company.id), eq(users.role, 'driver')),
      })
      if (!driver || !driver.isActive) {
        throw createError({ statusCode: 422, statusMessage: 'Driver must be an active driver of your company' })
      }
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

    const now = new Date()
    const [created] = await tx.insert(loads).values({
      source: 'manual',
      shipperId: null,
      externalShipperName: body.externalShipperName,
      externalShipperPhone: body.externalShipperPhone ?? null,
      pickupAddress: body.pickupAddress,
      pickupCity: body.pickupCity,
      pickupState: body.pickupState,
      pickupLat: pickupPoint?.lat ?? null,
      pickupLng: pickupPoint?.lng ?? null,
      deliveryAddress: body.deliveryAddress,
      deliveryCity: body.deliveryCity,
      deliveryState: body.deliveryState,
      deliveryLat: deliveryPoint?.lat ?? null,
      deliveryLng: deliveryPoint?.lng ?? null,
      materialType: body.materialType,
      materialDescription: body.materialDescription ?? null,
      weightKg: body.weightKg,
      quantity: body.quantity ?? null,
      pickupWindowStart: body.pickupWindowStart,
      pickupWindowEnd: body.pickupWindowEnd,
      pickupContactName: body.pickupContactName ?? null,
      pickupContactPhone: body.pickupContactPhone ?? null,
      deliveryContactName: body.deliveryContactName ?? null,
      deliveryContactPhone: body.deliveryContactPhone ?? null,
      askingPriceCents: body.priceCents,
      finalPriceCents: body.priceCents,
      status: 'awarded',
      assignedCompanyId: company.id,
      assignedDriverId: driver?.id ?? null,
      assignedVehicleId: vehicleId,
      awardedAt: now,
    }).returning()

    await insertLoadEvent(tx, {
      loadId: created!.id,
      actorUserId: user.id,
      eventType: 'created',
      toStatus: 'awarded',
      payload: { manual: true, externalShipperName: body.externalShipperName },
    })
    if (driver) {
      await insertLoadEvent(tx, {
        loadId: created!.id,
        actorUserId: user.id,
        eventType: 'driver_assigned',
        payload: { driverId: driver.id, driverName: driver.name, vehicleId },
      })
    }
    return created!
  })

  setResponseStatus(event, 201)
  return { load }
})
