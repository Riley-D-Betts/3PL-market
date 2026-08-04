import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { loadAttachments } from '../../../../database/schema'

const MAX_BYTES = 8 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

/**
 * Scale-ticket photo upload by the assigned driver. Multipart form with a
 * `file` part; marking the load delivered requires at least one on record.
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['driver'])
  const id = getUuidParam(event)
  await requireActiveShift(user.id)

  const load = await db.query.loads.findFirst({ where: eq(loads.id, id) })
  if (!load || load.assignedDriverId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Load not found' })
  }
  if (!['picked_up', 'delivered'].includes(load.status)) {
    throw createError({ statusCode: 409, statusMessage: 'Tickets are attached once the load is picked up' })
  }

  // Cheap DoS guard: refuse oversized uploads before buffering the body.
  // (readMultipartFormData reads the whole request into memory.)
  const declaredLength = Number(getHeader(event, 'content-length') ?? 0)
  if (declaredLength > MAX_BYTES + 64 * 1024) {
    throw createError({ statusCode: 413, statusMessage: 'Photo too large — keep it under 8 MB' })
  }

  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.data?.length)
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: 'Attach the ticket photo as a `file` form part' })
  }
  const contentType = file.type ?? ''
  if (!IMAGE_TYPES.has(contentType)) {
    throw createError({ statusCode: 415, statusMessage: 'Ticket must be a photo (JPEG, PNG, WebP or HEIC)' })
  }
  if (file.data.length > MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Photo too large — keep it under 8 MB' })
  }

  const [attachment] = await db.insert(loadAttachments).values({
    loadId: load.id,
    kind: 'ticket',
    uploadedBy: user.id,
    contentType,
    filename: file.filename ?? null,
    sizeBytes: file.data.length,
    data: file.data,
  }).returning({
    id: loadAttachments.id,
    filename: loadAttachments.filename,
    contentType: loadAttachments.contentType,
    sizeBytes: loadAttachments.sizeBytes,
    createdAt: loadAttachments.createdAt,
  })

  setResponseStatus(event, 201)
  return { attachment }
})
