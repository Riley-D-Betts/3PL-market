export default defineEventHandler(async (event) => {
  const { user, company } = await requireApprovedCarrier(event)
  const id = getUuidParam(event)
  const body = await readValidatedBody(event, bidInputSchema.parse)

  const bid = await placeBid({
    user,
    company,
    loadId: id,
    amountCents: body.amountCents,
    note: body.note,
    terms: {
      detentionFreeMinutes: body.detentionFreeMinutes,
      detentionRatePerHourCents: body.detentionRatePerHourCents,
    },
  })
  setResponseStatus(event, 201)
  return { bid }
})
