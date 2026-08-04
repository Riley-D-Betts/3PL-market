import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper'])
  const id = getUuidParam(event)
  const body = await readValidatedBody(event, loadPatchSchema.parse)

  const updated = await db.transaction(async (tx) => {
    const [load] = await tx.select().from(loads).where(eq(loads.id, id)).for('update')
    if (!load || load.shipperId !== user.id) {
      throw createError({ statusCode: 404, statusMessage: 'Load not found' })
    }
    if (load.status !== 'draft') {
      throw createError({ statusCode: 409, statusMessage: 'Only draft loads can be edited' })
    }

    const start = body.pickupWindowStart ?? load.pickupWindowStart
    const end = body.pickupWindowEnd ?? load.pickupWindowEnd
    if (start > end) {
      throw createError({ statusCode: 400, statusMessage: 'First load time must be before the last load time' })
    }

    // Re-derive a stop's coordinates when it moved (address, city or state
    // changed) and the body carries no fresh pin — stored coordinates can be
    // an address-precise dropped pin, which must not survive an address edit.
    const geo: Partial<typeof loads.$inferInsert> = {}
    const pickupMoved = (body.pickupAddress && body.pickupAddress !== load.pickupAddress)
      || (body.pickupCity && body.pickupCity !== load.pickupCity)
      || (body.pickupState && body.pickupState !== load.pickupState)
    if (pickupMoved && (body.pickupLat == null || body.pickupLng == null)) {
      const point = await geocodeCityState(body.pickupCity ?? load.pickupCity, body.pickupState ?? load.pickupState)
      geo.pickupLat = point?.lat ?? null
      geo.pickupLng = point?.lng ?? null
    }
    const deliveryMoved = (body.deliveryAddress && body.deliveryAddress !== load.deliveryAddress)
      || (body.deliveryCity && body.deliveryCity !== load.deliveryCity)
      || (body.deliveryState && body.deliveryState !== load.deliveryState)
    if (deliveryMoved && (body.deliveryLat == null || body.deliveryLng == null)) {
      const point = await geocodeCityState(body.deliveryCity ?? load.deliveryCity, body.deliveryState ?? load.deliveryState)
      geo.deliveryLat = point?.lat ?? null
      geo.deliveryLng = point?.lng ?? null
    }

    // Explicit pin coordinates in the body win over the re-geocode.
    const [row] = await tx.update(loads)
      .set({ ...geo, ...body, updatedAt: new Date() })
      .where(and(eq(loads.id, id), eq(loads.status, 'draft')))
      .returning()
    return row!
  })

  return { load: updated }
})
