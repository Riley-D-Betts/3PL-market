export default defineEventHandler(async (event) => {
  const { user, company } = await requireApprovedCarrier(event)
  const id = getUuidParam(event)
  const load = await instantAccept({ user, company, loadId: id })
  return { load }
})
