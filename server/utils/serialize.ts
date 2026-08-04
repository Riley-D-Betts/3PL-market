import type { User } from '../database/schema'
import type { SessionUser } from '../../shared/types'

export interface PublicUser {
  id: string
  email: string
  name: string
  phone: string | null
  role: User['role']
  companyId: string | null
  isActive: boolean
  billingEmail: string | null
  createdAt: Date
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    companyId: user.companyId,
    isActive: user.isActive,
    billingEmail: user.billingEmail,
    createdAt: user.createdAt,
  }
}

export function toSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
    sessionVersion: user.sessionVersion,
  }
}
