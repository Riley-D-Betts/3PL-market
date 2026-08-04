import { eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  await requireAuth(event, ['superadmin'])
  const id = getUuidParam(event)

  const [user] = await db.update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning()
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  return { user: toPublicUser(user) }
})
