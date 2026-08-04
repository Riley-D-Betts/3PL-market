export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper'])
  const id = getUuidParam(event)
  const load = await performTransition({
    actor: user,
    loadId: id,
    to: 'draft',
    set: { postedAt: null },
    rejectPendingBids: true,
  })
  return { load }
})
