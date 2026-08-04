export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['driver'])
  const id = getUuidParam(event)
  const load = await recordArrival({ actor: user, loadId: id, phase: 'delivery' })
  return { load }
})
