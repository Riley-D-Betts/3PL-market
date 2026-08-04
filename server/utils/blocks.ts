import { createError } from 'h3'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../database/client'
import type { Tx } from '../database/client'
import { bids, companies, loads, shipperCarrierBlocks } from '../database/schema'
import type { ShipperCarrierBlock } from '../database/schema'

/** True when the shipper has blocked the carrier company. Usable inside a transaction. */
export async function isCarrierBlocked(tx: Tx | typeof db, shipperId: string, companyId: string): Promise<boolean> {
  const block = await tx.query.shipperCarrierBlocks.findFirst({
    where: and(
      eq(shipperCarrierBlocks.shipperId, shipperId),
      eq(shipperCarrierBlocks.companyId, companyId),
    ),
    columns: { id: true },
  })
  return Boolean(block)
}

/**
 * Block a carrier company for a shipper. Idempotent. In the same transaction,
 * the company's pending bids on THIS shipper's loads are rejected (a
 * shipper-side decision — same semantics as losing an award).
 */
export async function createBlock(opts: { shipperId: string, companyId: string, reason?: string }): Promise<ShipperCarrierBlock> {
  return db.transaction(async (tx) => {
    const company = await tx.query.companies.findFirst({ where: eq(companies.id, opts.companyId) })
    if (!company) {
      throw createError({ statusCode: 404, statusMessage: 'Carrier company not found' })
    }

    await tx.insert(shipperCarrierBlocks)
      .values({ shipperId: opts.shipperId, companyId: opts.companyId, reason: opts.reason ?? null })
      .onConflictDoNothing({ target: [shipperCarrierBlocks.shipperId, shipperCarrierBlocks.companyId] })

    await tx.update(bids)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(and(
        eq(bids.companyId, opts.companyId),
        eq(bids.status, 'pending'),
        inArray(bids.loadId, tx.select({ id: loads.id }).from(loads).where(eq(loads.shipperId, opts.shipperId))),
      ))

    const block = await tx.query.shipperCarrierBlocks.findFirst({
      where: and(
        eq(shipperCarrierBlocks.shipperId, opts.shipperId),
        eq(shipperCarrierBlocks.companyId, opts.companyId),
      ),
    })
    return block!
  })
}

export async function removeBlock(opts: { shipperId: string, companyId: string }): Promise<void> {
  const [deleted] = await db.delete(shipperCarrierBlocks)
    .where(and(
      eq(shipperCarrierBlocks.shipperId, opts.shipperId),
      eq(shipperCarrierBlocks.companyId, opts.companyId),
    ))
    .returning()
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'This carrier is not blocked' })
  }
}
