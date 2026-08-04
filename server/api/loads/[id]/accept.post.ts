import { readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const { user, company } = await requireApprovedCarrier(event)
  const id = getUuidParam(event)
  // The accept body may be absent entirely — detention terms default.
  const body = acceptSchema.parse((await readBody(event)) ?? {})

  const load = await instantAccept({
    user,
    company,
    loadId: id,
    terms: {
      detentionFreeMinutes: body.detentionFreeMinutes,
      detentionRatePerHourCents: body.detentionRatePerHourCents,
    },
  })
  return { load }
})
