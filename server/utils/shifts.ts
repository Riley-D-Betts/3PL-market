import { and, eq, isNull } from 'drizzle-orm'
import { createError } from 'h3'
import type { DriverShift } from '../database/schema'
import { driverShifts } from '../database/schema'
import { db } from '../database/client'

/** The driver's un-ended shift, or null. */
export async function activeShift(driverId: string): Promise<DriverShift | null> {
  const [shift] = await db.select().from(driverShifts)
    .where(and(eq(driverShifts.driverId, driverId), isNull(driverShifts.endedAt)))
    .limit(1)
  return shift ?? null
}

/**
 * Load actions (arrive, pickup, deliver) require a signed-on driver — a
 * truck, a pre-trip inspection and a begin mileage on record.
 */
export async function requireActiveShift(driverId: string): Promise<DriverShift> {
  const shift = await activeShift(driverId)
  if (!shift) {
    throw createError({ statusCode: 409, statusMessage: 'Start your shift first — pick a truck, run the pre-trip and enter your beginning mileage' })
  }
  return shift
}
