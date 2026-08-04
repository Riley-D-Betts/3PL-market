export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['driver'])
  const id = getUuidParam(event)

  // Departure from pickup: freeze the pickup detention fee from the arrival
  // log and the terms agreed in the winning bid.
  const load = await performTransition({
    actor: user,
    loadId: id,
    to: 'picked_up',
    deriveSet: (current, now) => ({
      pickupDetentionCents: detentionFeeCents(
        detentionMinutes(current.arrivedPickupAt, now, current.detentionFreeMinutes),
        current.detentionRatePerHourCents,
      ),
    }),
    payloadFrom: (current, now) => ({
      detentionMinutes: detentionMinutes(current.arrivedPickupAt, now, current.detentionFreeMinutes),
      detentionCents: detentionFeeCents(
        detentionMinutes(current.arrivedPickupAt, now, current.detentionFreeMinutes),
        current.detentionRatePerHourCents,
      ),
    }),
  })
  return { load }
})
