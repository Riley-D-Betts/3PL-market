import { eq } from 'drizzle-orm'
import { createError } from 'h3'

/**
 * Demo mode only: password-less login as any active account. Gated hard on
 * the deployment flag — a 404 when demo mode is off, like the account list.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!config.public.demoMode) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const body = await readValidatedBody(event, demoLoginSchema.parse)
  const user = await db.query.users.findFirst({ where: eq(users.id, body.userId) })
  if (!user || !user.isActive) {
    throw createError({ statusCode: 401, statusMessage: 'Account is not available' })
  }

  await setUserSession(event, { user: toSessionUser(user) })
  return { user: toPublicUser(user) }
})
