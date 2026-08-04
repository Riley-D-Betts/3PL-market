import { eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const id = getUuidParam(event)

  const log = await db.query.vehicleMaintenanceLogs.findFirst({
    where: eq(vehicleMaintenanceLogs.id, id),
  })
  if (!log) {
    throw createError({ statusCode: 404, statusMessage: 'Maintenance entry not found' })
  }
  const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.id, log.vehicleId) })
  if (vehicle?.companyId !== company.id) {
    throw createError({ statusCode: 404, statusMessage: 'Maintenance entry not found' })
  }

  await db.delete(vehicleMaintenanceLogs).where(eq(vehicleMaintenanceLogs.id, id))
  return { ok: true }
})
