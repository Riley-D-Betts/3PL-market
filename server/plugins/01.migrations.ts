import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from '../database/client'
import { seed } from '../database/seed'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()
  const migrationsFolder = config.migrationsDir || 'server/database/migrations'

  await migrate(db, { migrationsFolder })
  console.log('[db] migrations applied')

  if (config.seedDemoData) {
    const seeded = await seed(db)
    if (seeded) console.log('[db] demo data seeded')
  }
})
