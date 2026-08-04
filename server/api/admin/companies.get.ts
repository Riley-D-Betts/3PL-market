import { desc, getTableColumns, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAuth(event, ['superadmin'])

  // Raw qualified names — see loads/index.get.ts for the drizzle quirk.
  const userCount = sql<number>`(select count(*)::int from users u where u.company_id = companies.id)`
  const vehicleCount = sql<number>`(select count(*)::int from vehicles v where v.company_id = companies.id)`

  const rows = await db.select({ ...getTableColumns(companies), userCount, vehicleCount })
    .from(companies)
    .orderBy(desc(companies.createdAt))
  return { companies: rows }
})
