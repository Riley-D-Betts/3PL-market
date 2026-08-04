export default defineEventHandler(async (event) => {
  // Shippers confirm marketplace loads; on manual loads the assigned carrier
  // admin holds the owner powers — the state machine decides.
  const { user } = await requireAuth(event, ['shipper', 'carrier_admin'])
  const id = getUuidParam(event)
  const load = await performTransition({ actor: user, loadId: id, to: 'completed' })
  return { load }
})
