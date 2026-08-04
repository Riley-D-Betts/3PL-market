import { eq } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { user: admin } = await requireAuth(event, ['superadmin'])
  const id = getUuidParam(event)
  if (id === admin.id) {
    throw createError({ statusCode: 400, statusMessage: 'You cannot deactivate your own account' })
  }

  const [user] = await db.update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning()
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  return { user: toPublicUser(user) }
})
