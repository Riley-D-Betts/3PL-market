import { desc, eq } from 'drizzle-orm'

/** All bids placed by the carrier admin's company, with load context. */
export default defineEventHandler(async (event) => {
  const { company } = await requireApprovedCarrier(event)

  const rows = await db.select({
    id: bids.id,
    amountCents: bids.amountCents,
    note: bids.note,
    status: bids.status,
    detentionFreeMinutes: bids.detentionFreeMinutes,
    detentionRatePerHourCents: bids.detentionRatePerHourCents,
    createdAt: bids.createdAt,
    updatedAt: bids.updatedAt,
    loadId: loads.id,
    loadStatus: loads.status,
    pickupCity: loads.pickupCity,
    pickupState: loads.pickupState,
    deliveryCity: loads.deliveryCity,
    deliveryState: loads.deliveryState,
    materialType: loads.materialType,
    weightKg: loads.weightKg,
    askingPriceCents: loads.askingPriceCents,
    pickupWindowStart: loads.pickupWindowStart,
  })
    .from(bids)
    .innerJoin(loads, eq(bids.loadId, loads.id))
    .where(eq(bids.companyId, company.id))
    .orderBy(desc(bids.updatedAt))

  return { bids: rows }
})
