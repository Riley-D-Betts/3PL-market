export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['driver'])
  const id = getUuidParam(event)

  // Unloaded/released: freeze the delivery detention fee.
  const load = await performTransition({
    actor: user,
    loadId: id,
    to: 'delivered',
    deriveSet: (current, now) => ({
      deliveryDetentionCents: detentionFeeCents(
        detentionMinutes(current.arrivedDeliveryAt, now, current.detentionFreeMinutes),
        current.detentionRatePerHourCents,
      ),
    }),
    payloadFrom: (current, now) => ({
      detentionMinutes: detentionMinutes(current.arrivedDeliveryAt, now, current.detentionFreeMinutes),
      detentionCents: detentionFeeCents(
        detentionMinutes(current.arrivedDeliveryAt, now, current.detentionFreeMinutes),
        current.detentionRatePerHourCents,
      ),
    }),
  })
  return { load }
})
