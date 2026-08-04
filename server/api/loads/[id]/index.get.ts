import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  const { user, company } = await requireAuth(event)
  const id = getUuidParam(event)

  const load = await db.query.loads.findFirst({ where: eq(loads.id, id) })
  if (!load) {
    throw createError({ statusCode: 404, statusMessage: 'Load not found' })
  }

  const isOwner = user.role === 'shipper' && load.shipperId === user.id
  const isSuperadmin = user.role === 'superadmin'
  const isAssignedDriver = user.role === 'driver' && load.assignedDriverId === user.id
  const isCarrierAdmin = user.role === 'carrier_admin' && company !== null
  const isAssignedCarrier = isCarrierAdmin && load.assignedCompanyId === company!.id
  const isApprovedCarrier = isCarrierAdmin && company!.status === 'approved'

  // Board browsing (posted loads) requires an approved carrier that the
  // shipper has not blocked; an assigned carrier keeps access to its
  // in-flight loads regardless of company status.
  const blockedForViewer = isCarrierAdmin
    ? await isCarrierBlocked(db, load.shipperId, company!.id)
    : false
  const canView = isOwner || isSuperadmin || isAssignedDriver || isAssignedCarrier
    || (isApprovedCarrier && load.status === 'posted' && !blockedForViewer)
  if (!canView) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to this load' })
  }

  const allEvents = await db.select({
    id: loadEvents.id,
    eventType: loadEvents.eventType,
    fromStatus: loadEvents.fromStatus,
    toStatus: loadEvents.toStatus,
    payload: loadEvents.payload,
    createdAt: loadEvents.createdAt,
    actorName: users.name,
  })
    .from(loadEvents)
    .leftJoin(users, eq(loadEvents.actorUserId, users.id))
    .where(eq(loadEvents.loadId, id))
    .orderBy(asc(loadEvents.seq))

  // Bid events carry competitor amounts and bidder names in their payloads —
  // only the load owner and superadmin may see other companies' bids. Everyone
  // else gets their own company's bid events only, and the awarded amount only
  // when it is their own price (the assigned carrier).
  const myCompanyId = isCarrierAdmin ? company!.id : null
  const events = (isOwner || isSuperadmin)
    ? allEvents
    : allEvents
        .filter((e) => {
          if (e.eventType === 'bid_placed' || e.eventType === 'bid_withdrawn') {
            const payload = e.payload as { companyId?: string } | null
            return myCompanyId !== null && payload?.companyId === myCompanyId
          }
          return true
        })
        .map((e) => {
          if (e.eventType === 'awarded' && !isAssignedCarrier) {
            const payload = e.payload as { instantAccept?: boolean } | null
            return { ...e, payload: payload?.instantAccept ? { instantAccept: true } : null }
          }
          return e
        })

  // Full bid list is for the owner (and superadmin) only. The blocked flag
  // lets the UI render Block/Blocked without an extra roundtrip.
  let bidList = null
  if (isOwner || isSuperadmin) {
    const blocked = sql<boolean>`exists (
      select 1 from ${shipperCarrierBlocks} scb
      where scb.shipper_id = ${load.shipperId} and scb.company_id = ${bids.companyId}
    )`
    bidList = await db.select({
      id: bids.id,
      companyId: bids.companyId,
      companyName: companies.name,
      amountCents: bids.amountCents,
      note: bids.note,
      status: bids.status,
      detentionFreeMinutes: bids.detentionFreeMinutes,
      detentionRatePerHourCents: bids.detentionRatePerHourCents,
      companyBlocked: blocked,
      createdAt: bids.createdAt,
      updatedAt: bids.updatedAt,
    })
      .from(bids)
      .innerJoin(companies, eq(bids.companyId, companies.id))
      .where(eq(bids.loadId, id))
      .orderBy(desc(bids.createdAt))
  }

  // A carrier sees only their own company's bid.
  let myBid = null
  if (isCarrierAdmin) {
    myBid = (await db.query.bids.findFirst({
      where: and(eq(bids.loadId, id), eq(bids.companyId, company!.id)),
      orderBy: desc(bids.updatedAt),
    })) ?? null
  }

  // Names for the assignment block (visible to anyone who can see the load).
  const assignedCompany = load.assignedCompanyId
    ? await db.query.companies.findFirst({ where: eq(companies.id, load.assignedCompanyId), columns: { id: true, name: true } })
    : null
  const assignedDriver = load.assignedDriverId
    ? await db.query.users.findFirst({ where: eq(users.id, load.assignedDriverId), columns: { id: true, name: true, phone: true } })
    : null
  const assignedVehicle = load.assignedVehicleId
    ? await db.query.vehicles.findFirst({ where: eq(vehicles.id, load.assignedVehicleId), columns: { id: true, type: true, plate: true } })
    : null
  const shipper = await db.query.users.findFirst({
    where: eq(users.id, load.shipperId),
    columns: { id: true, name: true, phone: true, email: true, billingEmail: true },
  })

  // On-site contacts belong to the working relationship — never to board
  // browsers. Same for the invoicing address.
  const canSeeContacts = isOwner || isSuperadmin || isAssignedCarrier || isAssignedDriver
  const visibleLoad = canSeeContacts
    ? load
    : { ...load, pickupContactName: null, pickupContactPhone: null, deliveryContactName: null, deliveryContactPhone: null }
  const invoiceEmail = (isOwner || isSuperadmin || isAssignedCarrier)
    ? (shipper?.billingEmail ?? shipper?.email ?? null)
    : null

  return {
    load: visibleLoad,
    events,
    bids: bidList,
    myBid,
    shipper: shipper ? { id: shipper.id, name: shipper.name, phone: shipper.phone } : null,
    invoiceEmail,
    assignedCompany,
    assignedDriver,
    assignedVehicle,
  }
})
