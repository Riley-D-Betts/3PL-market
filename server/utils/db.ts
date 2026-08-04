// Re-export the database client and tables so Nitro auto-imports them in routes.
export { db, DATABASE_URL } from '../database/client'
export type { Db, Tx } from '../database/client'
export * from '../database/schema'

/**
 * Postgres error code, unwrapping DrizzleQueryError (drizzle >= 0.44 wraps the
 * driver error and exposes it on `cause`).
 */
function pgErrorCode(err: unknown): string | undefined {
  let current = err as { code?: unknown, cause?: unknown } | null | undefined
  for (let depth = 0; current && depth < 5; depth++) {
    if (typeof current.code === 'string') return current.code
    current = current.cause as typeof current
  }
  return undefined
}

/** Postgres unique-constraint violation (e.g. duplicate email/plate). */
export function isUniqueViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23505'
}

/** Postgres foreign-key violation (e.g. deleting a vehicle referenced by loads). */
export function isForeignKeyViolation(err: unknown): boolean {
  return pgErrorCode(err) === '23503'
}
