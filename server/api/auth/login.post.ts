import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, loginSchema.parse)

  const user = await db.query.users.findFirst({
    where: eq(sql`lower(${users.email})`, body.email),
  })
  // Verify against a dummy hash on unknown emails to keep timing uniform.
  const ok = user
    ? await verifyUserPassword(user.passwordHash, body.password)
    : (await hashUserPassword(body.password), false)
  if (!user || !ok) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }
  if (!user.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'This account has been deactivated' })
  }

  await setUserSession(event, { user: toSessionUser(user) })
  return { user: toPublicUser(user) }
})
