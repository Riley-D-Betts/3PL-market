import { desc, eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper', 'superadmin'])
  const id = getUuidParam(event)

  const load = await db.query.loads.findFirst({ where: eq(loads.id, id) })
  if (!load || (user.role === 'shipper' && load.shipperId !== user.id)) {
    throw createError({ statusCode: 404, statusMessage: 'Load not found' })
  }

  const rows = await db.select({
    id: bids.id,
    companyId: bids.companyId,
    companyName: companies.name,
    amountCents: bids.amountCents,
    note: bids.note,
    status: bids.status,
    createdAt: bids.createdAt,
    updatedAt: bids.updatedAt,
  })
    .from(bids)
    .innerJoin(companies, eq(bids.companyId, companies.id))
    .where(eq(bids.loadId, id))
    .orderBy(desc(bids.createdAt))

  return { bids: rows }
})
