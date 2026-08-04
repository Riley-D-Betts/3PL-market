import { desc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAuth(event, ['superadmin'])

  const rows = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    phone: users.phone,
    role: users.role,
    companyId: users.companyId,
    companyName: companies.name,
    isActive: users.isActive,
    createdAt: users.createdAt,
  })
    .from(users)
    .leftJoin(companies, eq(users.companyId, companies.id))
    .orderBy(desc(users.createdAt))
  return { users: rows }
})
