import { and, eq, inArray, sql } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const id = getUuidParam(event)
  const body = await readValidatedBody(event, driverPatchSchema.parse)

  // Deactivating a driver who is on an in-flight load would strand the load.
  if (body.isActive === false) {
    const inFlight = await db.query.loads.findFirst({
      where: and(
        eq(loads.assignedDriverId, id),
        inArray(loads.status, ['awarded', 'picked_up']),
      ),
      columns: { id: true },
    })
    if (inFlight) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Driver is assigned to an in-flight load — reassign it first',
      })
    }
  }

  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (body.name !== undefined) set.name = body.name
  if (body.phone !== undefined) set.phone = body.phone
  if (body.isActive !== undefined) set.isActive = body.isActive
  if (body.password !== undefined) {
    set.passwordHash = await hashUserPassword(body.password)
    // Revoke sessions sealed with the old password.
    set.sessionVersion = sql`${users.sessionVersion} + 1`
  }

  const [driver] = await db.update(users)
    .set(set)
    .where(and(eq(users.id, id), eq(users.companyId, company.id), eq(users.role, 'driver')))
    .returning()
  if (!driver) {
    throw createError({ statusCode: 404, statusMessage: 'Driver not found' })
  }
  return { driver: toPublicUser(driver) }
})
