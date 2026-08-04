/**
 * Detention terms flow + arrival sequence tests against a real Postgres
 * (docker compose up -d postgres && pnpm test:integration).
 */
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { desc, eq } from 'drizzle-orm'
import { db } from '../../server/database/client'
import { bids, companies, loadEvents, loads, users } from '../../server/database/schema'
import type { Company, Load, User } from '../../server/database/schema'
import { awardBid, instantAccept, performTransition, placeBid, recordArrival } from '../../server/utils/load-actions'
import { detentionFeeCents, detentionMinutes } from '../../server/utils/detention'

const run = randomUUID().slice(0, 8)

let shipper: User
let carrier: { company: Company, admin: User, driver: User }
let otherDriver: User
const createdLoads: string[] = []

async function makePostedLoad(): Promise<Load> {
  const [load] = await db.insert(loads).values({
    shipperId: shipper.id,
    pickupAddress: '1 Test Yard',
    pickupCity: 'Boise',
    pickupState: 'ID',
    deliveryAddress: '2 Test Site',
    deliveryCity: 'Nampa',
    deliveryState: 'ID',
    materialType: 'steel',
    weightLbs: 12000,
    pickupWindowStart: new Date(Date.now() + 86400_000),
    pickupWindowEnd: new Date(Date.now() + 2 * 86400_000),
    askingPriceCents: 90000,
    status: 'posted',
    postedAt: new Date(),
  }).returning()
  createdLoads.push(load!.id)
  return load!
}

/** Award to the carrier with the given terms and assign the driver. */
async function awardedLoadWithTerms(freeMinutes: number, rateCents: number): Promise<Load> {
  const posted = await makePostedLoad()
  const bid = await placeBid({
    user: carrier.admin,
    company: carrier.company,
    loadId: posted.id,
    amountCents: 85000,
    terms: { detentionFreeMinutes: freeMinutes, detentionRatePerHourCents: rateCents },
  })
  await awardBid({ shipper, loadId: posted.id, bidId: bid.id })
  const [assigned] = await db.update(loads)
    .set({ assignedDriverId: carrier.driver.id })
    .where(eq(loads.id, posted.id))
    .returning()
  return assigned!
}

/** Test-only clock control: back-date an arrival timestamp. */
async function backdateArrival(loadId: string, column: 'arrivedPickupAt' | 'arrivedDeliveryAt', minutesAgo: number): Promise<void> {
  await db.update(loads)
    .set({ [column]: new Date(Date.now() - minutesAgo * 60_000) })
    .where(eq(loads.id, loadId))
}

beforeAll(async () => {
  const [user] = await db.insert(users).values({
    email: `shipper-det-${run}@test.local`,
    passwordHash: 'x',
    name: 'Detention Shipper',
    role: 'shipper',
  }).returning()
  shipper = user!

  const [company] = await db.insert(companies).values({
    name: `DetentionCo ${run}`,
    contactEmail: `detco-${run}@test.local`,
    status: 'approved',
  }).returning()
  const [admin] = await db.insert(users).values({
    email: `detco-admin-${run}@test.local`,
    passwordHash: 'x',
    name: 'DetCo Admin',
    role: 'carrier_admin',
    companyId: company!.id,
  }).returning()
  const [driver] = await db.insert(users).values({
    email: `detco-driver-${run}@test.local`,
    passwordHash: 'x',
    name: 'DetCo Driver',
    role: 'driver',
    companyId: company!.id,
  }).returning()
  const [second] = await db.insert(users).values({
    email: `detco-driver2-${run}@test.local`,
    passwordHash: 'x',
    name: 'DetCo Driver 2',
    role: 'driver',
    companyId: company!.id,
  }).returning()
  carrier = { company: company!, admin: admin!, driver: driver! }
  otherDriver = second!
})

afterAll(async () => {
  for (const id of createdLoads) {
    await db.delete(loads).where(eq(loads.id, id))
  }
  for (const u of [carrier.admin, carrier.driver, otherDriver]) {
    await db.delete(users).where(eq(users.id, u.id))
  }
  await db.delete(companies).where(eq(companies.id, carrier.company.id))
  await db.delete(users).where(eq(users.id, shipper.id))
  await db.$client.end()
})

describe('detention terms flow', () => {
  it('bid upsert replaces terms; award copies the winning terms onto the load', async () => {
    const posted = await makePostedLoad()
    await placeBid({
      user: carrier.admin,
      company: carrier.company,
      loadId: posted.id,
      amountCents: 85000,
      terms: { detentionFreeMinutes: 120, detentionRatePerHourCents: 7500 },
    })
    const rebid = await placeBid({
      user: carrier.admin,
      company: carrier.company,
      loadId: posted.id,
      amountCents: 84000,
      terms: { detentionFreeMinutes: 60, detentionRatePerHourCents: 9500 },
    })
    expect(rebid.detentionFreeMinutes).toBe(60)
    expect(rebid.detentionRatePerHourCents).toBe(9500)

    const awarded = await awardBid({ shipper, loadId: posted.id, bidId: rebid.id })
    expect(awarded.detentionFreeMinutes).toBe(60)
    expect(awarded.detentionRatePerHourCents).toBe(9500)
  })

  it('instant accept stamps the stated terms on load and synthetic bid', async () => {
    const posted = await makePostedLoad()
    const accepted = await instantAccept({
      user: carrier.admin,
      company: carrier.company,
      loadId: posted.id,
      terms: { detentionFreeMinutes: 30, detentionRatePerHourCents: 8000 },
    })
    expect(accepted.detentionFreeMinutes).toBe(30)
    expect(accepted.detentionRatePerHourCents).toBe(8000)
    const synthetic = await db.query.bids.findFirst({ where: eq(bids.id, accepted.awardedBidId!) })
    expect(synthetic!.detentionFreeMinutes).toBe(30)
    expect(synthetic!.detentionRatePerHourCents).toBe(8000)
  })
})

describe('arrival sequence guards', () => {
  it('pickup without a logged arrival gets a 409 pointing at the arrival step', async () => {
    const load = await awardedLoadWithTerms(120, 7500)
    await expect(performTransition({ actor: carrier.driver, loadId: load.id, to: 'picked_up' }))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('arrival on the wrong status gets 409', async () => {
    const posted = await makePostedLoad()
    await expect(recordArrival({ actor: carrier.driver, loadId: posted.id, phase: 'pickup' }))
      .rejects.toMatchObject({ statusCode: 403 }) // not even assigned on a posted load
    const load = await awardedLoadWithTerms(120, 7500)
    await expect(recordArrival({ actor: carrier.driver, loadId: load.id, phase: 'delivery' }))
      .rejects.toMatchObject({ statusCode: 409 }) // delivery arrival while still awarded
  })

  it('double arrival gets 409; non-assigned driver gets 403', async () => {
    const load = await awardedLoadWithTerms(120, 7500)
    await recordArrival({ actor: carrier.driver, loadId: load.id, phase: 'pickup' })
    await expect(recordArrival({ actor: carrier.driver, loadId: load.id, phase: 'pickup' }))
      .rejects.toMatchObject({ statusCode: 409 })
    await expect(recordArrival({ actor: otherDriver, loadId: load.id, phase: 'pickup' }))
      .rejects.toMatchObject({ statusCode: 403 })
  })

  it('deliver without a delivery arrival gets 409', async () => {
    const load = await awardedLoadWithTerms(120, 7500)
    await recordArrival({ actor: carrier.driver, loadId: load.id, phase: 'pickup' })
    await performTransition({ actor: carrier.driver, loadId: load.id, to: 'picked_up' })
    await expect(performTransition({ actor: carrier.driver, loadId: load.id, to: 'delivered' }))
      .rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('detention freeze', () => {
  const freeze = (load: Load, column: 'arrivedPickupAt' | 'arrivedDeliveryAt') =>
    (l: Load, now: Date) => ({
      [column === 'arrivedPickupAt' ? 'pickupDetentionCents' : 'deliveryDetentionCents']:
        detentionFeeCents(detentionMinutes(l[column], now, l.detentionFreeMinutes), l.detentionRatePerHourCents),
    })

  it('freezes 70 minutes over @ $75/hr as 8750 cents at pickup', async () => {
    const load = await awardedLoadWithTerms(120, 7500)
    await recordArrival({ actor: carrier.driver, loadId: load.id, phase: 'pickup' })
    await backdateArrival(load.id, 'arrivedPickupAt', 190)

    const picked = await performTransition({
      actor: carrier.driver,
      loadId: load.id,
      to: 'picked_up',
      deriveSet: freeze(load, 'arrivedPickupAt'),
    })
    expect(picked.pickupDetentionCents).toBe(8750)
  })

  it('freezes 0 (not null) when the wait stayed inside free time', async () => {
    const load = await awardedLoadWithTerms(120, 7500)
    await recordArrival({ actor: carrier.driver, loadId: load.id, phase: 'pickup' })
    await backdateArrival(load.id, 'arrivedPickupAt', 30)

    const picked = await performTransition({
      actor: carrier.driver,
      loadId: load.id,
      to: 'picked_up',
      deriveSet: freeze(load, 'arrivedPickupAt'),
    })
    expect(picked.pickupDetentionCents).toBe(0)
  })

  it('freezes the delivery leg independently and records it in the event payload', async () => {
    const load = await awardedLoadWithTerms(60, 6000)
    await recordArrival({ actor: carrier.driver, loadId: load.id, phase: 'pickup' })
    await performTransition({
      actor: carrier.driver,
      loadId: load.id,
      to: 'picked_up',
      deriveSet: freeze(load, 'arrivedPickupAt'),
    })
    await recordArrival({ actor: carrier.driver, loadId: load.id, phase: 'delivery' })
    await backdateArrival(load.id, 'arrivedDeliveryAt', 90) // 30 min over @ $60/hr = 3000

    const delivered = await performTransition({
      actor: carrier.driver,
      loadId: load.id,
      to: 'delivered',
      deriveSet: freeze(load, 'arrivedDeliveryAt'),
      payloadFrom: (l: Load, now: Date) => ({
        detentionCents: detentionFeeCents(detentionMinutes(l.arrivedDeliveryAt, now, l.detentionFreeMinutes), l.detentionRatePerHourCents),
      }),
    })
    expect(delivered.deliveryDetentionCents).toBe(3000)

    const [event] = await db.select().from(loadEvents)
      .where(eq(loadEvents.loadId, load.id))
      .orderBy(desc(loadEvents.seq))
      .limit(1)
    expect(event!.eventType).toBe('delivered')
    expect((event!.payload as { detentionCents?: number }).detentionCents).toBe(3000)
  })
})
