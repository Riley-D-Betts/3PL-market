import { asc, eq } from 'drizzle-orm'
import { createError } from 'h3'

/** Demo mode only: the accounts offered by the login page picker. */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!config.public.demoMode) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const rows = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    companyName: companies.name,
  })
    .from(users)
    .leftJoin(companies, eq(users.companyId, companies.id))
    .where(eq(users.isActive, true))
    .orderBy(asc(users.role), asc(users.name))
    .limit(50)

  return { accounts: rows }
})
