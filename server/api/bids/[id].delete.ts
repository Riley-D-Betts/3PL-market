export default defineEventHandler(async (event) => {
  // Withdrawing an own bid is allowed even while suspended/pending.
  const { user, company } = await requireCarrierCompany(event)
  const id = getUuidParam(event)
  const bid = await withdrawBid({ user, company, bidId: id })
  return { bid }
})
