import { desc, getTableColumns, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAuth(event, ['superadmin'])

  const userCount = sql<number>`(select count(*)::int from ${users} where ${users.companyId} = ${companies.id})`
  const vehicleCount = sql<number>`(select count(*)::int from ${vehicles} where ${vehicles.companyId} = ${companies.id})`

  const rows = await db.select({ ...getTableColumns(companies), userCount, vehicleCount })
    .from(companies)
    .orderBy(desc(companies.createdAt))
  return { companies: rows }
})
