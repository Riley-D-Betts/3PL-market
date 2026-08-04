import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'

/**
 * Create a manual (off-platform) load: freight the carrier hauls outside the
 * marketplace but manages here — calendar, day board, driver flow and reports
 * all treat it like any won load. Starts at `awarded`, never touches the board.
 * Price is optional (internal work), and N trucks create N sibling loads.
 */
export default defineEventHandler(async (event) => {
  const { user, company } = await requireCarrierCompany(event)
  const body = await readValidatedBody(event, manualLoadSchema.parse)

  const pickupPoint = body.pickupLat != null && body.pickupLng != null
    ? { lat: body.pickupLat, lng: body.pickupLng }
    : await geocodeCityState(body.pickupCity, body.pickupState)
  const deliveryPoint = body.deliveryLat != null && body.deliveryLng != null
    ? { lat: body.deliveryLat, lng: body.deliveryLng }
    : await geocodeCityState(body.deliveryCity, body.deliveryState)

  const truckGroupId = body.trucksRequested > 1 ? randomUUID() : null

  const created = await db.transaction(async (tx) => {
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
    const rows = []
    for (let seq = 1; seq <= body.trucksRequested; seq++) {
      // A picked driver/vehicle only makes sense for one truck — dispatch the
      // first; the rest go to the Unassigned lane for later assignment.
      const assignHere = seq === 1
      const [load] = await tx.insert(loads).values({
        source: 'manual',
        shipperId: null,
        externalShipperName: body.externalShipperName,
        externalShipperPhone: body.externalShipperPhone ?? null,
        pickupLocationName: body.pickupLocationName ?? null,
        pickupAddress: body.pickupAddress,
        pickupCity: body.pickupCity,
        pickupState: body.pickupState,
        pickupLat: pickupPoint?.lat ?? null,
        pickupLng: pickupPoint?.lng ?? null,
        jobName: body.jobName ?? null,
        deliveryAddress: body.deliveryAddress,
        deliveryCity: body.deliveryCity,
        deliveryState: body.deliveryState,
        deliveryLat: deliveryPoint?.lat ?? null,
        deliveryLng: deliveryPoint?.lng ?? null,
        materialType: body.materialType,
        materialDescription: body.materialDescription ?? null,
        weightLbs: body.weightLbs,
        quantity: body.quantity ?? null,
        notes: body.notes ?? null,
        travelTimeAllowanceMin: body.travelTimeAllowanceMin ?? null,
        truckGroupId,
        truckSeq: truckGroupId ? seq : null,
        trucksTotal: truckGroupId ? body.trucksRequested : null,
        pickupWindowStart: body.pickupWindowStart,
        pickupWindowEnd: body.pickupWindowEnd,
        pickupContactName: body.pickupContactName ?? null,
        pickupContactPhone: body.pickupContactPhone ?? null,
        deliveryContactName: body.deliveryContactName ?? null,
        deliveryContactPhone: body.deliveryContactPhone ?? null,
        askingPriceCents: body.priceCents ?? null,
        finalPriceCents: body.priceCents ?? null,
        status: 'awarded',
        assignedCompanyId: company.id,
        assignedDriverId: assignHere ? driver?.id ?? null : null,
        assignedVehicleId: assignHere ? vehicleId : null,
        awardedAt: now,
      }).returning()

      await insertLoadEvent(tx, {
        loadId: load!.id,
        actorUserId: user.id,
        eventType: 'created',
        toStatus: 'awarded',
        payload: {
          manual: true,
          externalShipperName: body.externalShipperName,
          ...(truckGroupId ? { truckSeq: seq, trucksTotal: body.trucksRequested } : {}),
        },
      })
      if (driver && assignHere) {
        await insertLoadEvent(tx, {
          loadId: load!.id,
          actorUserId: user.id,
          eventType: 'driver_assigned',
          payload: { driverId: driver.id, driverName: driver.name, vehicleId },
        })
      }
      rows.push(load!)
    }
    return rows
  })

  setResponseStatus(event, 201)
  return { load: created[0]!, loads: created }
})
