import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const id = getUuidParam(event)
  const body = await readValidatedBody(event, vehiclePatchSchema.parse)

  try {
    const [vehicle] = await db.update(vehicles)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(vehicles.id, id), eq(vehicles.companyId, company.id)))
      .returning()
    if (!vehicle) {
      throw createError({ statusCode: 404, statusMessage: 'Vehicle not found' })
    }
    return { vehicle }
  }
  catch (err) {
    if (isUniqueViolation(err)) {
      throw createError({ statusCode: 409, statusMessage: 'A vehicle with this plate already exists' })
    }
    throw err
  }
})
