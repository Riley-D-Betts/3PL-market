import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper'])
  const body = await readValidatedBody(event, loadInputSchema.parse)
  const { post, trucksRequested, ...fields } = body

  // Dropped Google pins win; otherwise best-effort geocoding, sequential
  // (Nominatim politeness) — cache hits are instant.
  const pickupPoint = fields.pickupLat != null && fields.pickupLng != null
    ? { lat: fields.pickupLat, lng: fields.pickupLng }
    : await geocodeCityState(fields.pickupCity, fields.pickupState)
  const deliveryPoint = fields.deliveryLat != null && fields.deliveryLng != null
    ? { lat: fields.deliveryLat, lng: fields.deliveryLng }
    : await geocodeCityState(fields.deliveryCity, fields.deliveryState)

  // N trucks requested → N sibling loads, one per truck, sharing a group id.
  const truckGroupId = trucksRequested > 1 ? randomUUID() : null

  const created = await db.transaction(async (tx) => {
    const now = new Date()
    const rows = []
    for (let seq = 1; seq <= trucksRequested; seq++) {
      const [load] = await tx.insert(loads).values({
        ...fields,
        materialDescription: fields.materialDescription ?? null,
        quantity: fields.quantity ?? null,
        pickupLat: pickupPoint?.lat ?? null,
        pickupLng: pickupPoint?.lng ?? null,
        deliveryLat: deliveryPoint?.lat ?? null,
        deliveryLng: deliveryPoint?.lng ?? null,
        truckGroupId,
        truckSeq: truckGroupId ? seq : null,
        trucksTotal: truckGroupId ? trucksRequested : null,
        shipperId: user.id,
        status: post ? 'posted' : 'draft',
        postedAt: post ? now : null,
      }).returning()

      await insertLoadEvent(tx, {
        loadId: load!.id,
        actorUserId: user.id,
        eventType: 'created',
        toStatus: 'draft',
        payload: truckGroupId ? { truckSeq: seq, trucksTotal: trucksRequested } : null,
      })
      if (post) {
        await insertLoadEvent(tx, {
          loadId: load!.id,
          actorUserId: user.id,
          eventType: 'posted',
          fromStatus: 'draft',
          toStatus: 'posted',
        })
      }
      rows.push(load!)
    }
    return rows
  })

  setResponseStatus(event, 201)
  return { load: created[0]!, loads: created }
})
