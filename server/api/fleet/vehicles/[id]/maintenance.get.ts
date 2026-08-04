import { and, desc, eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const id = getUuidParam(event)

  const vehicle = await db.query.vehicles.findFirst({
    where: and(eq(vehicles.id, id), eq(vehicles.companyId, company.id)),
  })
  if (!vehicle) {
    throw createError({ statusCode: 404, statusMessage: 'Vehicle not found' })
  }

  const logs = await db.query.vehicleMaintenanceLogs.findMany({
    where: eq(vehicleMaintenanceLogs.vehicleId, id),
    orderBy: desc(vehicleMaintenanceLogs.performedAt),
  })
  return { logs }
})
