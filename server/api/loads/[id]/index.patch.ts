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
      throw createError({ statusCode: 400, statusMessage: 'Pickup window start must be before its end' })
    }

    // Re-geocode a stop when its city/state changed.
    const geo: Partial<typeof loads.$inferInsert> = {}
    if ((body.pickupCity && body.pickupCity !== load.pickupCity) || (body.pickupState && body.pickupState !== load.pickupState)) {
      const point = await geocodeCityState(body.pickupCity ?? load.pickupCity, body.pickupState ?? load.pickupState)
      geo.pickupLat = point?.lat ?? null
      geo.pickupLng = point?.lng ?? null
    }
    if ((body.deliveryCity && body.deliveryCity !== load.deliveryCity) || (body.deliveryState && body.deliveryState !== load.deliveryState)) {
      const point = await geocodeCityState(body.deliveryCity ?? load.deliveryCity, body.deliveryState ?? load.deliveryState)
      geo.deliveryLat = point?.lat ?? null
      geo.deliveryLng = point?.lng ?? null
    }

    const [row] = await tx.update(loads)
      .set({ ...body, ...geo, updatedAt: new Date() })
      .where(and(eq(loads.id, id), eq(loads.status, 'draft')))
      .returning()
    return row!
  })

  return { load: updated }
})
