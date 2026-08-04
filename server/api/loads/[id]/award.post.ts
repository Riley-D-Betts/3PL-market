export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper'])
  const id = getUuidParam(event)
  const body = await readValidatedBody(event, awardSchema.parse)
  const load = await awardBid({ shipper: user, loadId: id, bidId: body.bidId })
  return { load }
})
