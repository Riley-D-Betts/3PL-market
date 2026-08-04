export default defineEventHandler(async (event) => {
  const { user, company } = await requireApprovedCarrier(event)
  const id = getUuidParam(event)
  const bid = await withdrawBid({ user, company, bidId: id })
  return { bid }
})
