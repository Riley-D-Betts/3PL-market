import type { LoadEventType, LoadStatus, Role } from '../../shared/types'

/**
 * Pure load state machine — no I/O. Route handlers authenticate and load rows;
 * this module answers "may this actor move this load from A to B?".
 *
 * Company approval status is not part of the pure model: routes gate carrier
 * actions through requireApprovedCarrier() before consulting the machine.
 */

export type ActorKind
  = | 'owner_shipper' /** the shipper who created the load */
    | 'carrier_admin' /** any carrier admin (instant accept on posted loads) */
    | 'assigned_carrier_admin' /** a carrier admin of the company the load is assigned to */
    | 'assigned_driver' /** the driver the load is assigned to */

export interface ActorLike {
  id: string
  role: Role
  companyId: string | null
}

export interface LoadLike {
  /** Null for manual (off-platform) loads — the assigned carrier owns those. */
  shipperId: string | null
  status: LoadStatus
  assignedCompanyId: string | null
  assignedDriverId: string | null
  arrivedPickupAt: Date | null
  arrivedDeliveryAt: Date | null
}

export const TRANSITIONS: Record<LoadStatus, Partial<Record<LoadStatus, ActorKind[]>>> = {
  draft: {
    posted: ['owner_shipper'],
    cancelled: ['owner_shipper'],
  },
  posted: {
    draft: ['owner_shipper'], // "unpost"
    awarded: ['owner_shipper', 'carrier_admin'], // award a bid / instant accept
    cancelled: ['owner_shipper'],
  },
  awarded: {
    picked_up: ['assigned_driver'],
    cancelled: ['owner_shipper', 'assigned_carrier_admin'], // pre-pickup backout
  },
  picked_up: {
    delivered: ['assigned_driver'],
  },
  delivered: {
    completed: ['owner_shipper'],
  },
  completed: {},
  cancelled: {},
}

export const TRANSITION_EVENT: Partial<Record<`${LoadStatus}->${LoadStatus}`, LoadEventType>> = {
  'draft->posted': 'posted',
  'draft->cancelled': 'cancelled',
  'posted->draft': 'unposted',
  'posted->awarded': 'awarded',
  'posted->cancelled': 'cancelled',
  'awarded->picked_up': 'picked_up',
  'awarded->cancelled': 'cancelled',
  'picked_up->delivered': 'delivered',
  'delivered->completed': 'completed',
}

/** Timestamp column (on loads) stamped when entering each status. */
export const STATUS_TIMESTAMP: Partial<Record<LoadStatus, 'postedAt' | 'awardedAt' | 'pickedUpAt' | 'deliveredAt' | 'completedAt' | 'cancelledAt'>> = {
  posted: 'postedAt',
  awarded: 'awardedAt',
  picked_up: 'pickedUpAt',
  delivered: 'deliveredAt',
  completed: 'completedAt',
  cancelled: 'cancelledAt',
}

export function actorKinds(actor: ActorLike, load: LoadLike): ActorKind[] {
  const kinds: ActorKind[] = []
  if (actor.role === 'shipper' && actor.id === load.shipperId) {
    kinds.push('owner_shipper')
  }
  if (actor.role === 'carrier_admin') {
    kinds.push('carrier_admin')
    if (actor.companyId && actor.companyId === load.assignedCompanyId) {
      kinds.push('assigned_carrier_admin')
      // Manual (off-platform) loads have no shipper account — the assigned
      // carrier admin holds the owner powers (confirm completion, cancel).
      if (load.shipperId === null) {
        kinds.push('owner_shipper')
      }
    }
  }
  if (actor.role === 'driver' && actor.id === load.assignedDriverId) {
    kinds.push('assigned_driver')
  }
  return kinds
}

export function canTransition(actor: ActorLike, load: LoadLike, to: LoadStatus): boolean {
  const allowedActors = TRANSITIONS[load.status]?.[to]
  if (!allowedActors) return false
  // Manual loads never enter the marketplace board.
  if (to === 'posted' && load.shipperId === null) return false
  // Pickup requires an assigned driver who has logged arrival at the pickup
  // site; delivery requires logged arrival at the delivery site. The arrival
  // log doubles as the start of the detention clock.
  if (to === 'picked_up' && (!load.assignedDriverId || !load.arrivedPickupAt)) return false
  if (to === 'delivered' && !load.arrivedDeliveryAt) return false
  const kinds = actorKinds(actor, load)
  return allowedActors.some(kind => kinds.includes(kind))
}

/** True when the status can never change again. */
export function isTerminal(status: LoadStatus): boolean {
  return Object.keys(TRANSITIONS[status]).length === 0
}
