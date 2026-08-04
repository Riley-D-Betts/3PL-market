export const ROLES = ['superadmin', 'shipper', 'carrier_admin', 'driver'] as const
export type Role = (typeof ROLES)[number]

export const COMPANY_STATUSES = ['pending', 'approved', 'suspended'] as const
export type CompanyStatus = (typeof COMPANY_STATUSES)[number]

export const VEHICLE_TYPES = ['flatbed', 'dump_truck', 'box_truck', 'lowboy', 'tanker', 'mixer', 'other'] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]

export const VEHICLE_STATUSES = ['active', 'maintenance', 'inactive'] as const
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]

export const MATERIAL_TYPES = ['aggregate', 'sand', 'gravel', 'concrete', 'lumber', 'steel', 'brick_block', 'drywall', 'pipe', 'equipment', 'other'] as const
export type MaterialType = (typeof MATERIAL_TYPES)[number]

export const LOAD_STATUSES = ['draft', 'posted', 'awarded', 'picked_up', 'delivered', 'completed', 'cancelled'] as const
export type LoadStatus = (typeof LOAD_STATUSES)[number]

export const BID_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'] as const
export type BidStatus = (typeof BID_STATUSES)[number]

export const LOAD_EVENT_TYPES = ['created', 'posted', 'unposted', 'bid_placed', 'bid_withdrawn', 'awarded', 'driver_assigned', 'picked_up', 'delivered', 'completed', 'cancelled', 'note', 'arrived_pickup', 'arrived_delivery'] as const
export type LoadEventType = (typeof LOAD_EVENT_TYPES)[number]

/** Session user payload stored in the sealed cookie. Authoritative user state is re-read from DB per request. */
export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
  companyId: string | null
  /** Must match users.session_version — bumped on password change to revoke old cookies. */
  sessionVersion: number
}

// UI labels and formatters live in shared/utils/format.ts (auto-imported by Nuxt).
