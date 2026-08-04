import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { loadAttachments } from '../../../../database/schema'

/**
 * Serves an uploaded ticket photo. Same audience as on-site contacts: the
 * load's shipper, superadmin, assigned carrier admin and assigned driver.
 */
export default defineEventHandler(async (event) => {
  const { user, company } = await requireAuth(event)
  const id = getUuidParam(event)
  const attachmentId = getUuidParam(event, 'attachmentId')

  const load = await db.query.loads.findFirst({ where: eq(loads.id, id) })
  if (!load) {
    throw createError({ statusCode: 404, statusMessage: 'Load not found' })
  }
  const entitled = (user.role === 'shipper' && load.shipperId === user.id)
    || user.role === 'superadmin'
    || (user.role === 'driver' && load.assignedDriverId === user.id)
    || (user.role === 'carrier_admin' && company !== null && load.assignedCompanyId === company.id)
  if (!entitled) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to this load' })
  }

  const [attachment] = await db.select().from(loadAttachments)
    .where(and(eq(loadAttachments.id, attachmentId), eq(loadAttachments.loadId, id)))
  if (!attachment) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  setHeader(event, 'content-type', attachment.contentType)
  setHeader(event, 'cache-control', 'private, max-age=3600')
  // The stored type is client-declared — stop browsers from second-guessing
  // it into something executable, and keep downloads inert.
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'content-disposition', `inline; filename="${(attachment.filename ?? 'ticket').replace(/[^\w.-]/g, '_')}"`)
  return attachment.data
})
