export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['driver'])
  const id = getUuidParam(event)
  const load = await performTransition({ actor: user, loadId: id, to: 'picked_up' })
  return { load }
})
