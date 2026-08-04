import { sql } from 'drizzle-orm'

// Baked in at image build time (see Dockerfile ARG GIT_COMMIT). Lets a deploy
// prove the running container is the one just built: a healthy container alone
// is not proof, since a failed rebuild leaves the previous image serving.
const commit = process.env.NUXT_GIT_COMMIT || null
const builtAt = process.env.NUXT_BUILT_AT || null

export default defineEventHandler(async () => {
  await db.execute(sql`select 1`)
  return { ok: true, commit, builtAt }
})
