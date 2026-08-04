import { eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event, ['superadmin'])
  const id = getUuidParam(event)

  const [company] = await db.update(companies)
    .set({ status: 'approved', suspendedReason: null, updatedAt: new Date() })
    .where(eq(companies.id, id))
    .returning()
  if (!company) {
    throw createError({ statusCode: 404, statusMessage: 'Company not found' })
  }
  return { company }
})
