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
    console.warn('[security] Demo seed is enabled (NUXT_SEED_DEMO_DATA) — demo accounts use a public password. Disable the seed and change all credentials before exposing this instance.')
  }
  if ((process.env.NUXT_SESSION_PASSWORD ?? '').startsWith('insecure-dev-session-password')) {
    console.warn('[security] NUXT_SESSION_PASSWORD is the compose default — set a private 32+ character secret in production.')
  }
  if (config.public.demoMode) {
    console.warn('[security] Demo mode is ON (NUXT_PUBLIC_DEMO_MODE) — the login page offers password-less access to every account. Never enable this on a real deployment.')
  }
})
