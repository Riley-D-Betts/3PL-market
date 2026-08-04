import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const id = getUuidParam(event)

  try {
    const [deleted] = await db.delete(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.companyId, company.id)))
      .returning()
    if (!deleted) {
      throw createError({ statusCode: 404, statusMessage: 'Vehicle not found' })
    }
    return { ok: true }
  }
  catch (err) {
    if (isForeignKeyViolation(err)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Vehicle is referenced by loads and cannot be deleted — set its status to inactive instead',
      })
    }
    throw err
  }
})
