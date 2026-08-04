export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper'])
  const body = await readValidatedBody(event, blockInputSchema.parse)

  const block = await createBlock({
    shipperId: user.id,
    companyId: body.companyId,
    reason: body.reason,
  })
  setResponseStatus(event, 201)
  return { block }
})
