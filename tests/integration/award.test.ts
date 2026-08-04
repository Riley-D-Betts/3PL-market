/**
 * Integration tests for the transactional bidding core, run against a real
 * Postgres (docker compose up -d postgres && pnpm test:integration).
 * DATABASE_URL defaults to the compose database.
 */
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../server/database/client'
import { bids, companies, loadEvents, loads, users } from '../../server/database/schema'
import type { Company, Load, User } from '../../server/database/schema'
import { awardBid, instantAccept, performTransition, placeBid, withdrawBid } from '../../server/utils/load-actions'

const run = randomUUID().slice(0, 8)
const TERMS = { detentionFreeMinutes: 120, detentionRatePerHourCents: 7500 }

let shipper: User
let carrierA: { company: Company, admin: User }
let carrierB: { company: Company, admin: User }
const createdLoads: string[] = []

async function makeCarrier(name: string): Promise<{ company: Company, admin: User }> {
  const [company] = await db.insert(companies).values({
    name: `${name} ${run}`,
    contactEmail: `${name.toLowerCase()}-${run}@test.local`,
    status: 'approved',
  }).returning()
  const [admin] = await db.insert(users).values({
    email: `${name.toLowerCase()}-admin-${run}@test.local`,
    passwordHash: 'x',
    name: `${name} Admin`,
    role: 'carrier_admin',
    companyId: company!.id,
  }).returning()
  return { company: company!, admin: admin! }
}

async function makePostedLoad(askingPriceCents = 100000): Promise<Load> {
  const [load] = await db.insert(loads).values({
    shipperId: shipper.id,
    pickupAddress: '1 Test Yard',
    pickupCity: 'Boise',
    pickupState: 'ID',
    deliveryAddress: '2 Test Site',
    deliveryCity: 'Nampa',
    deliveryState: 'ID',
    materialType: 'gravel',
    weightLbs: 10000,
    pickupWindowStart: new Date(Date.now() + 86400_000),
    pickupWindowEnd: new Date(Date.now() + 2 * 86400_000),
    askingPriceCents,
    status: 'posted',
    postedAt: new Date(),
  }).returning()
  createdLoads.push(load!.id)
  return load!
}

function statusCodeOf(err: unknown): number | undefined {
  return (err as { statusCode?: number })?.statusCode
}

beforeAll(async () => {
  const [user] = await db.insert(users).values({
    email: `shipper-${run}@test.local`,
    passwordHash: 'x',
    name: 'Test Shipper',
    role: 'shipper',
  }).returning()
  shipper = user!
  carrierA = await makeCarrier('CarrierA')
  carrierB = await makeCarrier('CarrierB')
})

afterAll(async () => {
  for (const id of createdLoads) {
    await db.delete(loads).where(eq(loads.id, id))
  }
  await db.delete(users).where(eq(users.id, shipper.id))
  for (const { company, admin } of [carrierA, carrierB]) {
    await db.delete(users).where(eq(users.id, admin.id))
    await db.delete(companies).where(eq(companies.id, company.id))
  }
  await db.$client.end()
})

describe('instant accept', () => {
  it('two concurrent accepts: exactly one wins, the other gets 409', async () => {
    const load = await makePostedLoad()

    const results = await Promise.allSettled([
      instantAccept({ user: carrierA.admin, company: carrierA.company, loadId: load.id, terms: TERMS }),
      instantAccept({ user: carrierB.admin, company: carrierB.company, loadId: load.id, terms: TERMS }),
    ])

    const wins = results.filter(r => r.status === 'fulfilled')
    const losses = results.filter(r => r.status === 'rejected')
    expect(wins).toHaveLength(1)
    expect(losses).toHaveLength(1)
    expect(statusCodeOf((losses[0] as PromiseRejectedResult).reason)).toBe(409)

    const finalLoad = await db.query.loads.findFirst({ where: eq(loads.id, load.id) })
    expect(finalLoad!.status).toBe('awarded')
    expect(finalLoad!.finalPriceCents).toBe(load.askingPriceCents)
    expect(finalLoad!.awardedBidId).not.toBeNull()

    const loadBids = await db.query.bids.findMany({ where: eq(bids.loadId, load.id) })
    expect(loadBids.filter(b => b.status === 'accepted')).toHaveLength(1)
  })

  it('rejects pending counter-bids from other companies on accept', async () => {
    const load = await makePostedLoad()
    const counter = await placeBid({ user: carrierB.admin, company: carrierB.company, loadId: load.id, amountCents: 90000, terms: TERMS })

    await instantAccept({ user: carrierA.admin, company: carrierA.company, loadId: load.id, terms: TERMS })

    const bBid = await db.query.bids.findFirst({ where: eq(bids.id, counter.id) })
    expect(bBid!.status).toBe('rejected')
  })
})

describe('award', () => {
  it('awards the chosen bid, rejects the rest, assigns the company and price', async () => {
    const load = await makePostedLoad()
    const bidA = await placeBid({ user: carrierA.admin, company: carrierA.company, loadId: load.id, amountCents: 88000, terms: TERMS })
    const bidB = await placeBid({ user: carrierB.admin, company: carrierB.company, loadId: load.id, amountCents: 92000, terms: TERMS })

    const awarded = await awardBid({ shipper, loadId: load.id, bidId: bidA.id })
    expect(awarded.status).toBe('awarded')
    expect(awarded.assignedCompanyId).toBe(carrierA.company.id)
    expect(awarded.finalPriceCents).toBe(88000)
    expect(awarded.awardedBidId).toBe(bidA.id)

    const a = await db.query.bids.findFirst({ where: eq(bids.id, bidA.id) })
    const b = await db.query.bids.findFirst({ where: eq(bids.id, bidB.id) })
    expect(a!.status).toBe('accepted')
    expect(b!.status).toBe('rejected')
  })

  it('re-bidding replaces the company bid in place (upsert)', async () => {
    const load = await makePostedLoad()
    const first = await placeBid({ user: carrierA.admin, company: carrierA.company, loadId: load.id, amountCents: 80000, terms: TERMS })
    const second = await placeBid({ user: carrierA.admin, company: carrierA.company, loadId: load.id, amountCents: 75000, note: 'sharper', terms: TERMS })

    expect(second.id).toBe(first.id)
    const rows = await db.query.bids.findMany({ where: eq(bids.loadId, load.id) })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.amountCents).toBe(75000)
  })

  it('cannot award a withdrawn bid, cannot withdraw an accepted bid', async () => {
    const load = await makePostedLoad()
    const bidA = await placeBid({ user: carrierA.admin, company: carrierA.company, loadId: load.id, amountCents: 85000, terms: TERMS })
    await withdrawBid({ user: carrierA.admin, company: carrierA.company, bidId: bidA.id })

    await expect(awardBid({ shipper, loadId: load.id, bidId: bidA.id }))
      .rejects.toMatchObject({ statusCode: 409 })

    const bidB = await placeBid({ user: carrierB.admin, company: carrierB.company, loadId: load.id, amountCents: 87000, terms: TERMS })
    await awardBid({ shipper, loadId: load.id, bidId: bidB.id })
    await expect(withdrawBid({ user: carrierB.admin, company: carrierB.company, bidId: bidB.id }))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('a non-owner cannot award', async () => {
    const load = await makePostedLoad()
    const bidA = await placeBid({ user: carrierA.admin, company: carrierA.company, loadId: load.id, amountCents: 85000, terms: TERMS })
    await expect(awardBid({ shipper: carrierA.admin, loadId: load.id, bidId: bidA.id }))
      .rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('transitions with pending bids', () => {
  it('cancelling a posted load rejects its pending bids', async () => {
    const load = await makePostedLoad()
    const bidA = await placeBid({ user: carrierA.admin, company: carrierA.company, loadId: load.id, amountCents: 82000, terms: TERMS })

    const cancelled = await performTransition({ actor: shipper, loadId: load.id, to: 'cancelled', rejectPendingBids: true })
    expect(cancelled.status).toBe('cancelled')

    const a = await db.query.bids.findFirst({ where: eq(bids.id, bidA.id) })
    expect(a!.status).toBe('rejected')
  })

  it('bidding on a cancelled load is refused', async () => {
    const load = await makePostedLoad()
    await performTransition({ actor: shipper, loadId: load.id, to: 'cancelled' })
    await expect(placeBid({ user: carrierA.admin, company: carrierA.company, loadId: load.id, amountCents: 50000, terms: TERMS }))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('records an event per transition', async () => {
    const load = await makePostedLoad()
    await instantAccept({ user: carrierA.admin, company: carrierA.company, loadId: load.id, terms: TERMS })
    const events = await db.query.loadEvents.findMany({ where: eq(loadEvents.loadId, load.id) })
    expect(events.map(e => e.eventType)).toContain('awarded')
  })
})
