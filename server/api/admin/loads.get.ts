import { desc, eq, getTableColumns } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

export default defineEventHandler(async (event) => {
  await requireAuth(event, ['superadmin'])
  const query = await getValidatedQuery(event, loadsQuerySchema.parse)

  const carrier = alias(companies, 'carrier')

  const rows = await db.select({
    ...getTableColumns(loads),
    shipperName: users.name,
    carrierName: carrier.name,
  })
    .from(loads)
    .innerJoin(users, eq(loads.shipperId, users.id))
    .leftJoin(carrier, eq(loads.assignedCompanyId, carrier.id))
    .where(query.status ? eq(loads.status, query.status) : undefined)
    .orderBy(desc(loads.createdAt))
  return { loads: rows }
})
