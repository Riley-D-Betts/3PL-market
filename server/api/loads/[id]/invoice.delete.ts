import { eq } from 'drizzle-orm'
import { createError } from 'h3'

/** Undo a mistaken invoiced marking — leaves a note on the timeline. */
export default defineEventHandler(async (event) => {
  const { user, company } = await requireCarrierCompany(event)
  const id = getUuidParam(event)

  const load = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(loads).where(eq(loads.id, id)).for('update')
    if (!current || current.assignedCompanyId !== company.id) {
      throw createError({ statusCode: 404, statusMessage: 'Load not found' })
    }
    if (!current.invoicedAt) {
      throw createError({ statusCode: 409, statusMessage: 'Load is not marked invoiced' })
    }

    const [updated] = await tx.update(loads)
      .set({ invoicedAt: null, updatedAt: new Date() })
      .where(eq(loads.id, id))
      .returning()
    await insertLoadEvent(tx, {
      loadId: id,
      actorUserId: user.id,
      eventType: 'note',
      payload: { note: 'Invoiced marking removed' },
    })
    return updated!
  })

  return { load }
})
