import { desc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper'])

  const rows = await db.select({
    id: shipperCarrierBlocks.id,
    companyId: shipperCarrierBlocks.companyId,
    companyName: companies.name,
    companyStatus: companies.status,
    reason: shipperCarrierBlocks.reason,
    createdAt: shipperCarrierBlocks.createdAt,
  })
    .from(shipperCarrierBlocks)
    .innerJoin(companies, eq(shipperCarrierBlocks.companyId, companies.id))
    .where(eq(shipperCarrierBlocks.shipperId, user.id))
    .orderBy(desc(shipperCarrierBlocks.createdAt))

  return { blocks: rows }
})
