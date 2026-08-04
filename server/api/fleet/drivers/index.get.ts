import { and, asc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { company } = await requireCarrierCompany(event)
  const rows = await db.query.users.findMany({
    where: and(eq(users.companyId, company.id), eq(users.role, 'driver')),
    orderBy: asc(users.name),
  })
  return { drivers: rows.map(toPublicUser) }
})
