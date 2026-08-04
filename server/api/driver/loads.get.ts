import { and, asc, eq, getTableColumns } from 'drizzle-orm'

/** Loads assigned to the logged-in driver. */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['driver'])
  const query = await getValidatedQuery(event, loadsQuerySchema.parse)

  const rows = await db.select({
    ...getTableColumns(loads),
    shipperName: users.name,
    vehiclePlate: vehicles.plate,
  })
    .from(loads)
    // Left join: manual loads have no shipper account.
    .leftJoin(users, eq(loads.shipperId, users.id))
    .leftJoin(vehicles, eq(loads.assignedVehicleId, vehicles.id))
    .where(and(
      eq(loads.assignedDriverId, user.id),
      query.status ? eq(loads.status, query.status) : undefined,
    ))
    .orderBy(asc(loads.pickupWindowStart))

  return { loads: rows }
})
