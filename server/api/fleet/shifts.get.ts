import { desc, eq } from 'drizzle-orm'
import { driverShifts } from '../../database/schema'

/** Recent driver shifts for the carrier admin — pre-trip, mileage and fuel records. */
export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)

  const rows = await db.select({
    id: driverShifts.id,
    driverName: users.name,
    plate: vehicles.plate,
    vehicleType: vehicles.type,
    startedAt: driverShifts.startedAt,
    startOdometerMi: driverShifts.startOdometerMi,
    pretrip: driverShifts.pretrip,
    pretripDefects: driverShifts.pretripDefects,
    endedAt: driverShifts.endedAt,
    endOdometerMi: driverShifts.endOdometerMi,
    fuelGallons: driverShifts.fuelGallons,
  })
    .from(driverShifts)
    .innerJoin(users, eq(driverShifts.driverId, users.id))
    .innerJoin(vehicles, eq(driverShifts.vehicleId, vehicles.id))
    .where(eq(driverShifts.companyId, company.id))
    .orderBy(desc(driverShifts.startedAt))
    .limit(50)

  return { shifts: rows }
})
