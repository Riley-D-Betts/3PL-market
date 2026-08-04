export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper'])
  const body = await readValidatedBody(event, loadInputSchema.parse)
  const { post, ...fields } = body

  // Best-effort, sequential (Nominatim politeness); cache hits are instant.
  const pickupPoint = await geocodeCityState(fields.pickupCity, fields.pickupState)
  const deliveryPoint = await geocodeCityState(fields.deliveryCity, fields.deliveryState)

  const load = await db.transaction(async (tx) => {
    const now = new Date()
    const [created] = await tx.insert(loads).values({
      ...fields,
      materialDescription: fields.materialDescription ?? null,
      quantity: fields.quantity ?? null,
      pickupLat: pickupPoint?.lat ?? null,
      pickupLng: pickupPoint?.lng ?? null,
      deliveryLat: deliveryPoint?.lat ?? null,
      deliveryLng: deliveryPoint?.lng ?? null,
      shipperId: user.id,
      status: post ? 'posted' : 'draft',
      postedAt: post ? now : null,
    }).returning()

    await insertLoadEvent(tx, {
      loadId: created!.id,
      actorUserId: user.id,
      eventType: 'created',
      toStatus: 'draft',
    })
    if (post) {
      await insertLoadEvent(tx, {
        loadId: created!.id,
        actorUserId: user.id,
        eventType: 'posted',
        fromStatus: 'draft',
        toStatus: 'posted',
      })
    }
    return created!
  })

  setResponseStatus(event, 201)
  return { load }
})
