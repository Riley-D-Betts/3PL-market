import { sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  await db.execute(sql`select 1`)
  return { ok: true }
})
