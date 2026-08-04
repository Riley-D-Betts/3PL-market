/**
 * Detention fee math — pure, no I/O.
 *
 * Detention accrues when the truck waits at a stop longer than the free
 * window agreed in the winning bid. Whole minutes only (floor), fees prorated
 * per minute and rounded up to the next cent so the carrier is never
 * shortchanged by fractional-cent truncation.
 */

/** Billable waiting minutes beyond the free window; null when the arrival was never logged. */
export function detentionMinutes(
  arrivedAt: Date | null,
  departedAt: Date,
  freeMinutes: number | null,
): number | null {
  if (!arrivedAt) return null
  const waitedMinutes = Math.floor((departedAt.getTime() - arrivedAt.getTime()) / 60_000)
  return Math.max(0, waitedMinutes - (freeMinutes ?? 0))
}

/** Fee in cents for the billable minutes; null when minutes or terms are unknown. */
export function detentionFeeCents(
  minutes: number | null,
  ratePerHourCents: number | null,
): number | null {
  if (minutes === null || ratePerHourCents === null) return null
  return Math.ceil((minutes * ratePerHourCents) / 60)
}
