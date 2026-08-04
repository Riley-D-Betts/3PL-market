import { asc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const rows = await db.select().from(vehicles)
    .where(eq(vehicles.companyId, company.id))
    .orderBy(asc(vehicles.plate))
  return { vehicles: rows }
})
