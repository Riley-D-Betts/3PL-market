import type { H3Event } from 'h3'
import { createError } from 'h3'
import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { companies, users } from '../database/schema'
import type { Company, User } from '../database/schema'
import type { Role } from '../../shared/types'

export interface AuthContext {
  user: User
  company: Company | null
}

export interface CarrierContext {
  user: User
  company: Company
}

/**
 * Authenticate the request and (optionally) restrict to specific roles.
 *
 * Sealed cookies cannot be revoked server-side, so the user row is re-read on
 * every request: deactivating a user or changing their role takes effect
 * immediately, valid cookie or not.
 */
export async function requireAuth(event: H3Event, roles?: Role[]): Promise<AuthContext> {
  const session = await requireUserSession(event)
  const userId = session.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user || !user.isActive) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Account is not active' })
  }
  if (roles && !roles.includes(user.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' })
  }

  let company: Company | null = null
  if (user.companyId) {
    company = (await db.query.companies.findFirst({ where: eq(companies.id, user.companyId) })) ?? null
  }
  return { user, company }
}

/**
 * Carrier admin with a company. Approval is NOT required — pending carriers
 * may manage their fleet and drivers while waiting for platform approval.
 */
export async function requireCarrierCompany(event: H3Event): Promise<CarrierContext> {
  const ctx = await requireAuth(event, ['carrier_admin'])
  if (!ctx.company) {
    throw createError({ statusCode: 403, statusMessage: 'No carrier company on this account' })
  }
  return { user: ctx.user, company: ctx.company }
}

/**
 * Marketplace-side carrier actions (bidding, accepting, load assignment)
 * additionally require the company to be approved by the platform operator.
 */
export async function requireApprovedCarrier(event: H3Event): Promise<CarrierContext> {
  const ctx = await requireCarrierCompany(event)
  if (ctx.company.status !== 'approved') {
    throw createError({ statusCode: 403, statusMessage: 'Carrier company is not approved yet' })
  }
  return ctx
}
