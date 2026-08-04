import { createError } from 'h3'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '../database/client'
import type { Tx } from '../database/client'
import { bids, loadEvents, loads } from '../database/schema'
import type { Bid, Company, Load } from '../database/schema'
import type { LoadEventType, LoadStatus } from '../../shared/types'
import type { ActorLike } from './load-state'
import { STATUS_TIMESTAMP, TRANSITION_EVENT, TRANSITIONS, canTransition } from './load-state'

interface LoadEventInput {
  loadId: string
  actorUserId: string | null
  eventType: LoadEventType
  fromStatus?: LoadStatus | null
  toStatus?: LoadStatus | null
  payload?: unknown
}

export async function insertLoadEvent(tx: Tx | typeof db, input: LoadEventInput): Promise<void> {
  await tx.insert(loadEvents).values({
    loadId: input.loadId,
    actorUserId: input.actorUserId,
    eventType: input.eventType,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    payload: input.payload ?? null,
  })
}

export interface TransitionOptions {
  actor: ActorLike
  loadId: string
  to: LoadStatus
  /** Extra columns to set alongside the status change. */
  set?: Partial<typeof loads.$inferInsert>
  payload?: unknown
  /** Reject all pending bids in the same transaction (unpost / cancel while posted). */
  rejectPendingBids?: boolean
}

/**
 * Generic race-safe state transition: locks the load row, validates the
 * transition for this actor against the state machine, applies the update,
 * stamps the status timestamp and appends a load_events row — one transaction.
 *
 * Award and instant-accept have dedicated flows below.
 */
export async function performTransition(opts: TransitionOptions): Promise<Load> {
  return db.transaction(async (tx) => {
    const [load] = await tx.select().from(loads).where(eq(loads.id, opts.loadId)).for('update')
    if (!load) {
      throw createError({ statusCode: 404, statusMessage: 'Load not found' })
    }
    if (!canTransition(opts.actor, load, opts.to)) {
      const stateAllows = Boolean(TRANSITIONS[load.status]?.[opts.to])
      if (!stateAllows) {
        throw createError({ statusCode: 409, statusMessage: `Load is ${load.status}; cannot move it to ${opts.to}` })
      }
      throw createError({ statusCode: 403, statusMessage: 'You are not allowed to perform this action on this load' })
    }

    const now = new Date()
    const set: Partial<typeof loads.$inferInsert> = { status: opts.to, updatedAt: now, ...opts.set }
    const timestampColumn = STATUS_TIMESTAMP[opts.to]
    if (timestampColumn) {
      set[timestampColumn] = now
    }
    const [updated] = await tx.update(loads).set(set).where(eq(loads.id, load.id)).returning()

    if (opts.rejectPendingBids) {
      await tx.update(bids)
        .set({ status: 'rejected', updatedAt: now })
        .where(and(eq(bids.loadId, load.id), eq(bids.status, 'pending')))
    }

    await insertLoadEvent(tx, {
      loadId: load.id,
      actorUserId: opts.actor.id,
      eventType: TRANSITION_EVENT[`${load.status}->${opts.to}`] ?? 'note',
      fromStatus: load.status,
      toStatus: opts.to,
      payload: opts.payload,
    })
    return updated!
  })
}

/**
 * Shipper awards a specific bid. Locks load then bid (all flows lock the load
 * first, so lock order is consistent), accepts the winner, rejects the other
 * pending bids and assigns the load to the winning company.
 */
export async function awardBid(opts: { shipper: ActorLike, loadId: string, bidId: string }): Promise<Load> {
  return db.transaction(async (tx) => {
    const [load] = await tx.select().from(loads).where(eq(loads.id, opts.loadId)).for('update')
    if (!load) {
      throw createError({ statusCode: 404, statusMessage: 'Load not found' })
    }
    if (load.shipperId !== opts.shipper.id) {
      throw createError({ statusCode: 403, statusMessage: 'Only the load owner can award bids' })
    }
    if (load.status !== 'posted') {
      throw createError({ statusCode: 409, statusMessage: 'Load is no longer open for award' })
    }

    const [bid] = await tx.select().from(bids).where(eq(bids.id, opts.bidId)).for('update')
    if (!bid || bid.loadId !== load.id) {
      throw createError({ statusCode: 404, statusMessage: 'Bid not found on this load' })
    }
    if (bid.status !== 'pending') {
      throw createError({ statusCode: 409, statusMessage: 'Bid is no longer pending' })
    }

    const now = new Date()
    await tx.update(bids).set({ status: 'accepted', updatedAt: now }).where(eq(bids.id, bid.id))
    await tx.update(bids)
      .set({ status: 'rejected', updatedAt: now })
      .where(and(eq(bids.loadId, load.id), eq(bids.status, 'pending'), ne(bids.id, bid.id)))

    const [updated] = await tx.update(loads)
      .set({
        status: 'awarded',
        awardedBidId: bid.id,
        assignedCompanyId: bid.companyId,
        finalPriceCents: bid.amountCents,
        awardedAt: now,
        updatedAt: now,
      })
      .where(eq(loads.id, load.id))
      .returning()

    await insertLoadEvent(tx, {
      loadId: load.id,
      actorUserId: opts.shipper.id,
      eventType: 'awarded',
      fromStatus: 'posted',
      toStatus: 'awarded',
      payload: { bidId: bid.id, companyId: bid.companyId, amountCents: bid.amountCents },
    })
    return updated!
  })
}

/**
 * Carrier instantly accepts a posted load at asking price.
 *
 * The conditional UPDATE is the whole race: two simultaneous accepts both try
 * `WHERE status = 'posted'`; Postgres row locking makes the loser wait, then
 * re-evaluate against the committed row, match zero rows and get a clean 409.
 */
export async function instantAccept(opts: { user: ActorLike, company: Company, loadId: string }): Promise<Load> {
  return db.transaction(async (tx) => {
    const now = new Date()
    const [updated] = await tx.update(loads)
      .set({
        status: 'awarded',
        assignedCompanyId: opts.company.id,
        finalPriceCents: sql`${loads.askingPriceCents}`,
        awardedAt: now,
        updatedAt: now,
      })
      .where(and(eq(loads.id, opts.loadId), eq(loads.status, 'posted')))
      .returning()
    if (!updated) {
      throw createError({ statusCode: 409, statusMessage: 'Load is no longer available' })
    }

    await tx.update(bids)
      .set({ status: 'rejected', updatedAt: now })
      .where(and(eq(bids.loadId, updated.id), eq(bids.status, 'pending')))

    const [syntheticBid] = await tx.insert(bids)
      .values({
        loadId: updated.id,
        companyId: opts.company.id,
        createdBy: opts.user.id,
        amountCents: updated.askingPriceCents,
        note: 'Instant accept at asking price',
        status: 'accepted',
      })
      .returning()
    await tx.update(loads).set({ awardedBidId: syntheticBid!.id }).where(eq(loads.id, updated.id))

    await insertLoadEvent(tx, {
      loadId: updated.id,
      actorUserId: opts.user.id,
      eventType: 'awarded',
      fromStatus: 'posted',
      toStatus: 'awarded',
      payload: { instantAccept: true, companyId: opts.company.id, amountCents: updated.askingPriceCents },
    })
    return { ...updated, awardedBidId: syntheticBid!.id }
  })
}

/**
 * Place (or replace) a company's live counter-bid on a posted load.
 * Locks the load row so a bid can never land after an award rejected the
 * pending bids but before that award committed.
 */
export async function placeBid(opts: { user: ActorLike, company: Company, loadId: string, amountCents: number, note?: string }): Promise<Bid> {
  return db.transaction(async (tx) => {
    const [load] = await tx.select().from(loads).where(eq(loads.id, opts.loadId)).for('update')
    if (!load) {
      throw createError({ statusCode: 404, statusMessage: 'Load not found' })
    }
    if (load.status !== 'posted') {
      throw createError({ statusCode: 409, statusMessage: 'Load is not open for bidding' })
    }

    const now = new Date()
    const [bid] = await tx.insert(bids)
      .values({
        loadId: load.id,
        companyId: opts.company.id,
        createdBy: opts.user.id,
        amountCents: opts.amountCents,
        note: opts.note ?? null,
        status: 'pending',
      })
      .onConflictDoUpdate({
        target: [bids.loadId, bids.companyId],
        targetWhere: sql`${bids.status} = 'pending'`,
        set: { amountCents: opts.amountCents, note: opts.note ?? null, createdBy: opts.user.id, updatedAt: now },
      })
      .returning()

    await insertLoadEvent(tx, {
      loadId: load.id,
      actorUserId: opts.user.id,
      eventType: 'bid_placed',
      payload: { bidId: bid!.id, companyId: opts.company.id, amountCents: opts.amountCents },
    })
    return bid!
  })
}

/** Withdraw a pending bid. Conditional update — races with award resolve to 409. */
export async function withdrawBid(opts: { user: ActorLike, company: Company, bidId: string }): Promise<Bid> {
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(bids)
      .set({ status: 'withdrawn', updatedAt: new Date() })
      .where(and(eq(bids.id, opts.bidId), eq(bids.companyId, opts.company.id), eq(bids.status, 'pending')))
      .returning()
    if (!updated) {
      throw createError({ statusCode: 409, statusMessage: 'Bid can no longer be withdrawn' })
    }
    await insertLoadEvent(tx, {
      loadId: updated.loadId,
      actorUserId: opts.user.id,
      eventType: 'bid_withdrawn',
      payload: { bidId: updated.id, companyId: opts.company.id },
    })
    return updated
  })
}
