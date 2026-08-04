import { and, desc, eq, getTableColumns, ilike, lte, notExists, or, sql } from 'drizzle-orm'

/** Escape LIKE wildcards so user input matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, m => `\\${m}`)
}

/** Open-load board for approved carriers. */
export default defineEventHandler(async (event) => {
  const { company } = await requireApprovedCarrier(event)
  const query = await getValidatedQuery(event, boardQuerySchema.parse)

  const myBid = sql<{ id: string, amountCents: number, detentionFreeMinutes: number, detentionRatePerHourCents: number } | null>`(
    select json_build_object(
      'id', b.id,
      'amountCents', b.amount_cents,
      'detentionFreeMinutes', b.detention_free_minutes,
      'detentionRatePerHourCents', b.detention_rate_per_hour_cents
    )
    from ${bids} b
    where b.load_id = ${loads.id} and b.company_id = ${company.id} and b.status = 'pending'
    limit 1
  )`

  // On-site contacts are for the assigned carrier only — never on the board.
  const {
    pickupContactName: _pcn,
    pickupContactPhone: _pcp,
    deliveryContactName: _dcn,
    deliveryContactPhone: _dcp,
    ...boardColumns
  } = getTableColumns(loads)

  const rows = await db.select({ ...boardColumns, shipperName: users.name, myBid })
    .from(loads)
    .innerJoin(users, eq(loads.shipperId, users.id))
    .where(and(
      eq(loads.status, 'posted'),
      // Loads from shippers who blocked this company are invisible.
      notExists(
        db.select({ one: sql`1` }).from(shipperCarrierBlocks).where(and(
          eq(shipperCarrierBlocks.shipperId, loads.shipperId),
          eq(shipperCarrierBlocks.companyId, company.id),
        )),
      ),
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
