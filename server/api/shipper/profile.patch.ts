import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper'])
  const body = await readValidatedBody(event, shipperProfileSchema.parse)

  const [updated] = await db.update(users)
    .set({ billingEmail: body.billingEmail, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning()
  return { user: toPublicUser(updated!) }
})
