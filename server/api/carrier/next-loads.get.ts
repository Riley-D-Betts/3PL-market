import { and, eq, ne, notExists, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { haversineMiles, materialFitsVehicle } from '../../../shared/utils/geo'

/**
 * Next-leg planner: open board loads ranked by distance from where the
 * driver ends up (the reference load's delivery point), with capacity and
 * material fit hints for the chosen vehicle. Advisory — never a hard filter.
 */
export default defineEventHandler(async (event) => {
  const { company } = await requireApprovedCarrier(event)
  const query = await getValidatedQuery(event, nextLoadsQuerySchema.parse)

  const reference = await db.query.loads.findFirst({ where: eq(loads.id, query.fromLoadId) })
  if (!reference || reference.assignedCompanyId !== company.id) {
    throw createError({ statusCode: 404, statusMessage: 'Load not found' })
  }

  const vehicleId = query.vehicleId ?? reference.assignedVehicleId
  const vehicle = vehicleId
    ? await db.query.vehicles.findFirst({ where: and(eq(vehicles.id, vehicleId), eq(vehicles.companyId, company.id)) })
    : null

  const open = await db.select({
    id: loads.id,
    loadNumber: loads.loadNumber,
    pickupCity: loads.pickupCity,
    pickupState: loads.pickupState,
    deliveryCity: loads.deliveryCity,
    deliveryState: loads.deliveryState,
    pickupLat: loads.pickupLat,
    pickupLng: loads.pickupLng,
    materialType: loads.materialType,
    weightLbs: loads.weightLbs,
    askingPriceCents: loads.askingPriceCents,
    pickupWindowStart: loads.pickupWindowStart,
  })
    .from(loads)
    .where(and(
      eq(loads.status, 'posted'),
      ne(loads.source, 'manual'),
      notExists(
        db.select({ one: sql`1` }).from(shipperCarrierBlocks).where(and(
          eq(shipperCarrierBlocks.shipperId, loads.shipperId),
          eq(shipperCarrierBlocks.companyId, company.id),
        )),
      ),
    ))

  const from = reference.deliveryLat !== null && reference.deliveryLng !== null
    ? { lat: reference.deliveryLat, lng: reference.deliveryLng }
    : null

  const suggestions = open
    .map(candidate => ({
      ...candidate,
      distanceMiles: from && candidate.pickupLat !== null && candidate.pickupLng !== null
        ? Math.round(haversineMiles(from.lat, from.lng, candidate.pickupLat, candidate.pickupLng) * 10) / 10
        : null,
      fitsCapacity: vehicle ? candidate.weightLbs <= vehicle.capacityLbs : null,
      materialFit: vehicle ? materialFitsVehicle(candidate.materialType, vehicle.type) : null,
    }))
    .sort((a, b) => (a.distanceMiles ?? Number.POSITIVE_INFINITY) - (b.distanceMiles ?? Number.POSITIVE_INFINITY))
    .slice(0, 10)

  return {
    from: { city: reference.deliveryCity, state: reference.deliveryState, hasCoordinates: from !== null },
    vehicle: vehicle ? { id: vehicle.id, plate: vehicle.plate, type: vehicle.type, capacityLbs: vehicle.capacityLbs } : null,
    suggestions,
  }
})
