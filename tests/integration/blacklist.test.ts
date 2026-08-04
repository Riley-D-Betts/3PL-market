/**
 * Blacklist enforcement tests against a real Postgres
 * (docker compose up -d postgres && pnpm test:integration).
 */
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { db } from '../../server/database/client'
import { bids, companies, loads, shipperCarrierBlocks, users } from '../../server/database/schema'
import type { Company, Load, User } from '../../server/database/schema'
import { awardBid, instantAccept, placeBid } from '../../server/utils/load-actions'
import { createBlock, removeBlock } from '../../server/utils/blocks'

const run = randomUUID().slice(0, 8)
const TERMS = { detentionFreeMinutes: 120, detentionRatePerHourCents: 7500 }

let shipper: User
let otherShipper: User
let blocked: { company: Company, admin: User }
let friendly: { company: Company, admin: User }
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

async function makeShipper(tag: string): Promise<User> {
  const [user] = await db.insert(users).values({
    email: `shipper-${tag}-${run}@test.local`,
    passwordHash: 'x',
    name: `Shipper ${tag}`,
    role: 'shipper',
  }).returning()
  return user!
}

async function makePostedLoad(owner: User): Promise<Load> {
  const [load] = await db.insert(loads).values({
    shipperId: owner.id,
    pickupAddress: '1 Test Yard',
    pickupCity: 'Boise',
    pickupState: 'ID',
    deliveryAddress: '2 Test Site',
    deliveryCity: 'Nampa',
    deliveryState: 'ID',
    materialType: 'sand',
    weightKg: 8000,
    pickupWindowStart: new Date(Date.now() + 86400_000),
    pickupWindowEnd: new Date(Date.now() + 2 * 86400_000),
    askingPriceCents: 60000,
    status: 'posted',
    postedAt: new Date(),
  }).returning()
  createdLoads.push(load!.id)
  return load!
}

beforeAll(async () => {
  shipper = await makeShipper('main')
  otherShipper = await makeShipper('other')
  blocked = await makeCarrier('BlockedCo')
  friendly = await makeCarrier('FriendlyCo')
})

afterAll(async () => {
  for (const id of createdLoads) {
    await db.delete(loads).where(eq(loads.id, id))
  }
  await db.delete(shipperCarrierBlocks).where(eq(shipperCarrierBlocks.shipperId, shipper.id))
  for (const { company, admin } of [blocked, friendly]) {
    await db.delete(users).where(eq(users.id, admin.id))
    await db.delete(companies).where(eq(companies.id, company.id))
  }
  await db.delete(users).where(eq(users.id, shipper.id))
  await db.delete(users).where(eq(users.id, otherShipper.id))
  await db.$client.end()
})

describe('createBlock', () => {
  it('rejects the blocked company pending bids on that shipper loads only', async () => {
    const mine = await makePostedLoad(shipper)
    const theirs = await makePostedLoad(otherShipper)
    const bidOnMine = await placeBid({ user: blocked.admin, company: blocked.company, loadId: mine.id, amountCents: 55000, terms: TERMS })
    const bidOnTheirs = await placeBid({ user: blocked.admin, company: blocked.company, loadId: theirs.id, amountCents: 55000, terms: TERMS })

    await createBlock({ shipperId: shipper.id, companyId: blocked.company.id, reason: 'test' })

    const mineBid = await db.query.bids.findFirst({ where: eq(bids.id, bidOnMine.id) })
    const theirsBid = await db.query.bids.findFirst({ where: eq(bids.id, bidOnTheirs.id) })
    expect(mineBid!.status).toBe('rejected')
    expect(theirsBid!.status).toBe('pending')
  })

  it('is idempotent — one row after a duplicate block', async () => {
    await createBlock({ shipperId: shipper.id, companyId: blocked.company.id })
    const rows = await db.query.shipperCarrierBlocks.findMany({
      where: and(
        eq(shipperCarrierBlocks.shipperId, shipper.id),
        eq(shipperCarrierBlocks.companyId, blocked.company.id),
      ),
    })
    expect(rows).toHaveLength(1)
  })
})

describe('enforcement while blocked', () => {
  it('blocked placeBid gets 403; a friendly carrier can still bid', async () => {
    const load = await makePostedLoad(shipper)
    await expect(placeBid({ user: blocked.admin, company: blocked.company, loadId: load.id, amountCents: 50000, terms: TERMS }))
      .rejects.toMatchObject({ statusCode: 403 })
    const ok = await placeBid({ user: friendly.admin, company: friendly.company, loadId: load.id, amountCents: 52000, terms: TERMS })
    expect(ok.status).toBe('pending')
  })

  it('blocked instantAccept gets 403 and the load stays posted', async () => {
    const load = await makePostedLoad(shipper)
    await expect(instantAccept({ user: blocked.admin, company: blocked.company, loadId: load.id, terms: TERMS }))
      .rejects.toMatchObject({ statusCode: 403 })
    const after = await db.query.loads.findFirst({ where: eq(loads.id, load.id) })
    expect(after!.status).toBe('posted')
  })

  it('awarding a blocked company bid gets 409 (block-vs-bid race)', async () => {
    const load = await makePostedLoad(shipper)
    // Simulate a bid that slipped in before the block by inserting it directly.
    const [sneaky] = await db.insert(bids).values({
      loadId: load.id,
      companyId: blocked.company.id,
      createdBy: blocked.admin.id,
      amountCents: 40000,
      status: 'pending',
    }).returning()
    await expect(awardBid({ shipper, loadId: load.id, bidId: sneaky!.id }))
      .rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('removeBlock', () => {
  it('restores bidding', async () => {
    await removeBlock({ shipperId: shipper.id, companyId: blocked.company.id })
    const load = await makePostedLoad(shipper)
    const bid = await placeBid({ user: blocked.admin, company: blocked.company, loadId: load.id, amountCents: 51000, terms: TERMS })
    expect(bid.status).toBe('pending')
  })

  it('404s when nothing is blocked', async () => {
    await expect(removeBlock({ shipperId: shipper.id, companyId: blocked.company.id }))
      .rejects.toMatchObject({ statusCode: 404 })
  })
})
