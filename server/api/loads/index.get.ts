import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper'])
  const query = await getValidatedQuery(event, loadsQuerySchema.parse)

  // Raw qualified names: drizzle strips table qualification from interpolated
  // columns in join-less selects, which breaks correlated subqueries.
  const pendingBidCount = sql<number>`(select count(*)::int from bids b where b.load_id = loads.id and b.status = 'pending')`

  const rows = await db.select({ ...getTableColumns(loads), pendingBidCount })
    .from(loads)
    .where(and(
      eq(loads.shipperId, user.id),
      query.status ? eq(loads.status, query.status) : undefined,
    ))
    .orderBy(desc(loads.createdAt))

  return { loads: rows }
})
