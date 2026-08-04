export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper'])
  const companyId = getUuidParam(event, 'companyId')
  await removeBlock({ shipperId: user.id, companyId })
  return { ok: true }
})
