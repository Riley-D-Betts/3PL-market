import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { formatLoadNumber } from '../../../../shared/utils/format'

/**
 * The assigned carrier marks a finished (delivered/completed) load's invoice
 * as sent. Orthogonal to the load status — recorded as invoiced_at plus a
 * timeline event both parties see.
 */
export default defineEventHandler(async (event) => {
  const { user, company } = await requireCarrierCompany(event)
  const id = getUuidParam(event)

  const load = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(loads).where(eq(loads.id, id)).for('update')
    if (!current || current.assignedCompanyId !== company.id) {
      throw createError({ statusCode: 404, statusMessage: 'Load not found' })
    }
    if (!['delivered', 'completed'].includes(current.status)) {
      throw createError({ statusCode: 409, statusMessage: 'Only delivered or completed loads can be invoiced' })
    }
    if (current.invoicedAt) {
      throw createError({ statusCode: 409, statusMessage: 'Load is already marked invoiced' })
    }

    const now = new Date()
    const [updated] = await tx.update(loads)
      .set({ invoicedAt: now, updatedAt: now })
      .where(eq(loads.id, id))
      .returning()
    await insertLoadEvent(tx, {
      loadId: id,
      actorUserId: user.id,
      eventType: 'invoiced',
      payload: { invoiceNumber: `INV-${formatLoadNumber(current.loadNumber)}` },
    })
    return updated!
  })

  return { load }
})
