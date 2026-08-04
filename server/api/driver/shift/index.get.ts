import { and, eq } from 'drizzle-orm'

/**
 * The driver's current shift (with truck info) plus the company's active
 * trucks for the sign-on form — drivers have no access to the fleet routes.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['driver'])

  const fleet = await db.select({
    id: vehicles.id,
    plate: vehicles.plate,
    type: vehicles.type,
    odometerMi: vehicles.odometerMi,
  })
    .from(vehicles)
    .where(and(eq(vehicles.companyId, user.companyId!), eq(vehicles.status, 'active')))
    .orderBy(vehicles.plate)

  const shift = await activeShift(user.id)
  // Direct lookup — the shift's truck may have left 'active' status mid-shift.
  const vehicle = shift
    ? await db.query.vehicles.findFirst({
        where: eq(vehicles.id, shift.vehicleId),
        columns: { id: true, plate: true, type: true, odometerMi: true },
      }) ?? null
    : null
  return { shift, vehicle, fleet }
})
