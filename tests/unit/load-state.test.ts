import { describe, expect, it } from 'vitest'
import type { ActorLike, LoadLike } from '../../server/utils/load-state'
import { TRANSITIONS, actorKinds, canTransition, isTerminal } from '../../server/utils/load-state'
import { LOAD_STATUSES } from '../../shared/types'
import type { LoadStatus } from '../../shared/types'

const SHIPPER_ID = 'shipper-1'
const OTHER_SHIPPER_ID = 'shipper-2'
const CARRIER_CO = 'company-1'
const OTHER_CO = 'company-2'
const DRIVER_ID = 'driver-1'
const OTHER_DRIVER_ID = 'driver-2'

const owner: ActorLike = { id: SHIPPER_ID, role: 'shipper', companyId: null }
const otherShipper: ActorLike = { id: OTHER_SHIPPER_ID, role: 'shipper', companyId: null }
const carrierAdmin: ActorLike = { id: 'ca-1', role: 'carrier_admin', companyId: CARRIER_CO }
const otherCarrierAdmin: ActorLike = { id: 'ca-2', role: 'carrier_admin', companyId: OTHER_CO }
const assignedDriver: ActorLike = { id: DRIVER_ID, role: 'driver', companyId: CARRIER_CO }
const otherDriver: ActorLike = { id: OTHER_DRIVER_ID, role: 'driver', companyId: CARRIER_CO }
const superadmin: ActorLike = { id: 'admin-1', role: 'superadmin', companyId: null }

function load(status: LoadStatus, opts: Partial<LoadLike> = {}): LoadLike {
  return {
    shipperId: SHIPPER_ID,
    status,
    assignedCompanyId: null,
    assignedDriverId: null,
    ...opts,
  }
}

const assigned = (status: LoadStatus) =>
  load(status, { assignedCompanyId: CARRIER_CO, assignedDriverId: DRIVER_ID })

describe('actorKinds', () => {
  it('identifies the owning shipper', () => {
    expect(actorKinds(owner, load('draft'))).toEqual(['owner_shipper'])
    expect(actorKinds(otherShipper, load('draft'))).toEqual([])
  })

  it('identifies carrier admins and assigned carrier admins', () => {
    expect(actorKinds(carrierAdmin, load('posted'))).toEqual(['carrier_admin'])
    expect(actorKinds(carrierAdmin, assigned('awarded'))).toEqual(['carrier_admin', 'assigned_carrier_admin'])
    expect(actorKinds(otherCarrierAdmin, assigned('awarded'))).toEqual(['carrier_admin'])
  })

  it('identifies the assigned driver only', () => {
    expect(actorKinds(assignedDriver, assigned('awarded'))).toEqual(['assigned_driver'])
    expect(actorKinds(otherDriver, assigned('awarded'))).toEqual([])
  })

  it('gives superadmin no transition powers', () => {
    expect(actorKinds(superadmin, assigned('awarded'))).toEqual([])
  })
})

describe('legal transitions', () => {
  it('owner posts, unposts and cancels drafts/posted loads', () => {
    expect(canTransition(owner, load('draft'), 'posted')).toBe(true)
    expect(canTransition(owner, load('draft'), 'cancelled')).toBe(true)
    expect(canTransition(owner, load('posted'), 'draft')).toBe(true)
    expect(canTransition(owner, load('posted'), 'cancelled')).toBe(true)
  })

  it('owner awards a posted load; any carrier admin can instant-accept', () => {
    expect(canTransition(owner, load('posted'), 'awarded')).toBe(true)
    expect(canTransition(carrierAdmin, load('posted'), 'awarded')).toBe(true)
    expect(canTransition(otherCarrierAdmin, load('posted'), 'awarded')).toBe(true)
  })

  it('assigned driver picks up and delivers', () => {
    expect(canTransition(assignedDriver, assigned('awarded'), 'picked_up')).toBe(true)
    expect(canTransition(assignedDriver, assigned('picked_up'), 'delivered')).toBe(true)
  })

  it('owner or assigned carrier admin cancels pre-pickup', () => {
    expect(canTransition(owner, assigned('awarded'), 'cancelled')).toBe(true)
    expect(canTransition(carrierAdmin, assigned('awarded'), 'cancelled')).toBe(true)
  })

  it('owner confirms delivery', () => {
    expect(canTransition(owner, assigned('delivered'), 'completed')).toBe(true)
  })
})

describe('illegal transitions', () => {
  it('rejects skipping states', () => {
    expect(canTransition(owner, load('draft'), 'awarded')).toBe(false)
    expect(canTransition(owner, load('draft'), 'completed')).toBe(false)
    expect(canTransition(assignedDriver, assigned('awarded'), 'delivered')).toBe(false)
    expect(canTransition(owner, assigned('picked_up'), 'completed')).toBe(false)
  })

  it('rejects everything from terminal states', () => {
    for (const from of ['completed', 'cancelled'] as const) {
      for (const to of LOAD_STATUSES) {
        expect(canTransition(owner, assigned(from), to)).toBe(false)
        expect(canTransition(carrierAdmin, assigned(from), to)).toBe(false)
        expect(canTransition(assignedDriver, assigned(from), to)).toBe(false)
      }
    }
  })

  it('rejects cancelling after pickup', () => {
    expect(canTransition(owner, assigned('picked_up'), 'cancelled')).toBe(false)
    expect(canTransition(carrierAdmin, assigned('picked_up'), 'cancelled')).toBe(false)
  })
})

describe('actor restrictions', () => {
  it('non-owner shipper cannot manage the load', () => {
    expect(canTransition(otherShipper, load('draft'), 'posted')).toBe(false)
    expect(canTransition(otherShipper, load('posted'), 'cancelled')).toBe(false)
    expect(canTransition(otherShipper, assigned('delivered'), 'completed')).toBe(false)
  })

  it('drivers cannot post, award or confirm', () => {
    expect(canTransition(assignedDriver, load('draft'), 'posted')).toBe(false)
    expect(canTransition(assignedDriver, load('posted'), 'awarded')).toBe(false)
    expect(canTransition(assignedDriver, assigned('delivered'), 'completed')).toBe(false)
  })

  it('shipper cannot pick up or deliver', () => {
    expect(canTransition(owner, assigned('awarded'), 'picked_up')).toBe(false)
    expect(canTransition(owner, assigned('picked_up'), 'delivered')).toBe(false)
  })

  it('only the assigned driver may pick up / deliver', () => {
    expect(canTransition(otherDriver, assigned('awarded'), 'picked_up')).toBe(false)
    expect(canTransition(otherDriver, assigned('picked_up'), 'delivered')).toBe(false)
  })

  it('a non-assigned carrier admin cannot cancel an awarded load', () => {
    expect(canTransition(otherCarrierAdmin, assigned('awarded'), 'cancelled')).toBe(false)
  })

  it('pickup requires a driver assignment', () => {
    const noDriver = load('awarded', { assignedCompanyId: CARRIER_CO })
    expect(canTransition(assignedDriver, noDriver, 'picked_up')).toBe(false)
  })
})

describe('machine shape', () => {
  it('covers every status', () => {
    for (const status of LOAD_STATUSES) {
      expect(TRANSITIONS[status]).toBeDefined()
    }
  })

  it('terminal states are exactly completed and cancelled', () => {
    expect(LOAD_STATUSES.filter(isTerminal)).toEqual(['completed', 'cancelled'])
  })
})
