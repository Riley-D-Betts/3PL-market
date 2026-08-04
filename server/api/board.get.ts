import { and, desc, eq, getTableColumns, ilike, lte, or, sql } from 'drizzle-orm'

/** Escape LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, m => `\\${m}`)
}

/** Open-load board for approved carriers. */
export default defineEventHandler(async (event) => {
  const { company } = await requireApprovedCarrier(event)
  const query = await getValidatedQuery(event, boardQuerySchema.parse)

  const myBid = sql<{ id: string, amountCents: number } | null>`(
    select json_build_object('id', b.id, 'amountCents', b.amount_cents)
    from ${bids} b
    where b.load_id = ${loads.id} and b.company_id = ${company.id} and b.status = 'pending'
    limit 1
  )`

  const rows = await db.select({ ...getTableColumns(loads), shipperName: users.name, myBid })
    .from(loads)
    .innerJoin(users, eq(loads.shipperId, users.id))
    .where(and(
      eq(loads.status, 'posted'),
      query.materialType ? eq(loads.materialType, query.materialType) : undefined,
      query.pickupState ? ilike(loads.pickupState, escapeLike(query.pickupState)) : undefined,
      query.maxWeightKg ? lte(loads.weightKg, query.maxWeightKg) : undefined,
      query.q
        ? or(
            ilike(loads.pickupCity, `%${escapeLike(query.q)}%`),
            ilike(loads.deliveryCity, `%${escapeLike(query.q)}%`),
          )
        : undefined,
    ))
    .orderBy(desc(loads.postedAt))

  return { loads: rows }
})
