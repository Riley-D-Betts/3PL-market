import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { loadAttachments } from '../../../../database/schema'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['driver'])
  const id = getUuidParam(event)
  await requireActiveShift(user.id)
  const body = await readValidatedBody(event, deliverSchema.parse)

  // Ownership first — otherwise the ticket 409 leaks whether an arbitrary
  // load has attachments. performTransition re-validates on the locked row.
  const owned = await db.query.loads.findFirst({ where: eq(loads.id, id), columns: { id: true, assignedDriverId: true } })
  if (!owned || owned.assignedDriverId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Load not found' })
  }

  // Delivery needs the paper trail: a scale-ticket photo must be on file.
  const [ticket] = await db.select({ id: loadAttachments.id }).from(loadAttachments)
    .where(and(eq(loadAttachments.loadId, id), eq(loadAttachments.kind, 'ticket')))
    .limit(1)
  if (!ticket) {
    throw createError({ statusCode: 409, statusMessage: 'Upload a photo of the scale ticket before marking the load delivered' })
  }

  // Unloaded/released: freeze the delivery detention fee and record the
  // actual hauled tonnage.
  const load = await performTransition({
    actor: user,
    loadId: id,
    to: 'delivered',
    set: { deliveredTons: body.deliveredTons },
    deriveSet: (current, now) => ({
      deliveryDetentionCents: detentionFeeCents(
        detentionMinutes(current.arrivedDeliveryAt, now, current.detentionFreeMinutes),
        current.detentionRatePerHourCents,
      ),
    }),
    payloadFrom: (current, now) => ({
      deliveredTons: body.deliveredTons,
      detentionMinutes: detentionMinutes(current.arrivedDeliveryAt, now, current.detentionFreeMinutes),
      detentionCents: detentionFeeCents(
        detentionMinutes(current.arrivedDeliveryAt, now, current.detentionFreeMinutes),
        current.detentionRatePerHourCents,
      ),
    }),
  })
  return { load }
})
