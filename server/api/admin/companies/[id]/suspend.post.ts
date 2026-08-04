import { eq } from 'drizzle-orm'
import { createError } from 'h3'

import { and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAuth(event, ['superadmin'])
  const id = getUuidParam(event)
  const body = await readValidatedBody(event, suspendSchema.parse)

  const company = await db.transaction(async (tx) => {
    const [row] = await tx.update(companies)
      .set({ status: 'suspended', suspendedReason: body.reason ?? null, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning()
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Company not found' })
    }
    // A suspended carrier must not win loads — void its live bids.
    await tx.update(bids)
      .set({ status: 'withdrawn', updatedAt: new Date() })
      .where(and(eq(bids.companyId, id), eq(bids.status, 'pending')))
    return row
  })
  return { company }
})
