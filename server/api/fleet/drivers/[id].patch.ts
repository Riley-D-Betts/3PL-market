import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const id = getUuidParam(event)
  const body = await readValidatedBody(event, driverPatchSchema.parse)

  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (body.name !== undefined) set.name = body.name
  if (body.phone !== undefined) set.phone = body.phone
  if (body.isActive !== undefined) set.isActive = body.isActive
  if (body.password !== undefined) set.passwordHash = await hashUserPassword(body.password)

  const [driver] = await db.update(users)
    .set(set)
    .where(and(eq(users.id, id), eq(users.companyId, company.id), eq(users.role, 'driver')))
    .returning()
  if (!driver) {
    throw createError({ statusCode: 404, statusMessage: 'Driver not found' })
  }
  return { driver: toPublicUser(driver) }
})
