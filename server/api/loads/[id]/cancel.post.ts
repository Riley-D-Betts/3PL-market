export default defineEventHandler(async (event) => {
  // Shippers cancel their own loads; the assigned carrier admin may back out
  // of an awarded load pre-pickup. The state machine decides who may do what.
  const { user } = await requireAuth(event, ['shipper', 'carrier_admin'])
  const id = getUuidParam(event)
  const load = await performTransition({
    actor: user,
    loadId: id,
    to: 'cancelled',
    rejectPendingBids: true,
  })
  return { load }
})
