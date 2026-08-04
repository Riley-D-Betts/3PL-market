import { and, asc, eq, gte, isNotNull, lte, ne, sql } from 'drizzle-orm'

/**
 * Activity + earnings report for the carrier's fleet over a date range,
 * grouped by driver and by vehicle. A load belongs to the range when its
 * pickup window opens inside it; revenue (line haul + detention) counts only
 * for loads that reached delivered/completed.
 */
export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const query = await getValidatedQuery(event, reportsQuerySchema.parse)

  const to = query.to ?? new Date()
  const from = query.from ?? new Date(to.getTime() - 30 * 86400_000)

  const delivered = sql`${loads.status} in ('delivered', 'completed')`
  const metrics = {
    totalLoads: sql<number>`count(*)::int`,
    completedLoads: sql<number>`count(case when ${delivered} then 1 end)::int`,
    weightLbs: sql<number>`coalesce(sum(${loads.weightLbs}), 0)::int`,
    revenueCents: sql<number>`coalesce(sum(case when ${delivered} then coalesce(${loads.finalPriceCents}, 0) + coalesce(${loads.pickupDetentionCents}, 0) + coalesce(${loads.deliveryDetentionCents}, 0) end), 0)::bigint`,
    detentionCents: sql<number>`coalesce(sum(case when ${delivered} then coalesce(${loads.pickupDetentionCents}, 0) + coalesce(${loads.deliveryDetentionCents}, 0) end), 0)::bigint`,
  }

  const inRange = and(
    eq(loads.assignedCompanyId, company.id),
    ne(loads.status, 'cancelled'),
    gte(loads.pickupWindowStart, from),
    lte(loads.pickupWindowStart, to),
  )

  const byDriver = await db.select({
    driverId: loads.assignedDriverId,
    driverName: users.name,
    ...metrics,
  })
    .from(loads)
    .innerJoin(users, eq(loads.assignedDriverId, users.id))
    .where(and(inRange, isNotNull(loads.assignedDriverId)))
    .groupBy(loads.assignedDriverId, users.name)
    .orderBy(asc(users.name))

  const byVehicle = await db.select({
    vehicleId: loads.assignedVehicleId,
    plate: vehicles.plate,
    type: vehicles.type,
    ...metrics,
  })
    .from(loads)
    .innerJoin(vehicles, eq(loads.assignedVehicleId, vehicles.id))
    .where(and(inRange, isNotNull(loads.assignedVehicleId)))
    .groupBy(loads.assignedVehicleId, vehicles.plate, vehicles.type)
    .orderBy(asc(vehicles.plate))

  const [totals] = await db.select(metrics).from(loads).where(inRange)

  // bigint sums arrive as strings from postgres — normalize to numbers.
  const normalize = <T extends { revenueCents: unknown, detentionCents: unknown }>(row: T) => ({
    ...row,
    revenueCents: Number(row.revenueCents),
    detentionCents: Number(row.detentionCents),
  })

  return {
    from,
    to,
    totals: normalize(totals!),
    byDriver: byDriver.map(normalize),
    byVehicle: byVehicle.map(normalize),
  }
})
