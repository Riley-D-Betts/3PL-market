import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper'])
  const query = await getValidatedQuery(event, loadsQuerySchema.parse)

  const pendingBidCount = sql<number>`(select count(*)::int from ${bids} where ${bids.loadId} = ${loads.id} and ${bids.status} = 'pending')`

  const rows = await db.select({ ...getTableColumns(loads), pendingBidCount })
    .from(loads)
    .where(and(
      eq(loads.shipperId, user.id),
      query.status ? eq(loads.status, query.status) : undefined,
    ))
    .orderBy(desc(loads.createdAt))

  return { loads: rows }
})
