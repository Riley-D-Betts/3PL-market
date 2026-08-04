import { and, desc, eq, getTableColumns } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

/**
 * Loads won by the carrier admin's company (awarded through completed).
 * Deliberately NOT approval-gated: a suspended carrier must keep visibility of
 * its in-flight loads even though it can no longer take new work.
 */
export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const query = await getValidatedQuery(event, loadsQuerySchema.parse)

  const driver = alias(users, 'driver')

  const rows = await db.select({
    ...getTableColumns(loads),
    shipperName: users.name,
    driverName: driver.name,
    vehiclePlate: vehicles.plate,
  })
    .from(loads)
    // Left join: manual loads have no shipper account.
    .leftJoin(users, eq(loads.shipperId, users.id))
    .leftJoin(driver, eq(loads.assignedDriverId, driver.id))
    .leftJoin(vehicles, eq(loads.assignedVehicleId, vehicles.id))
    .where(and(
      eq(loads.assignedCompanyId, company.id),
      query.status ? eq(loads.status, query.status) : undefined,
    ))
    .orderBy(desc(loads.awardedAt))

  return { loads: rows }
})
