// Re-export the database client and tables so Nitro auto-imports them in routes.
export { db, DATABASE_URL } from '../database/client'
export type { Db, Tx } from '../database/client'
export * from '../database/schema'

/** Postgres unique-constraint violation (e.g. duplicate email/plate). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505'
}
