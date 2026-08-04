import { and, asc, desc, eq } from 'drizzle-orm'
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

  // Carrier admins may open a load from the board (posted) or one assigned to
  // their company; everyone else needs a direct relationship to the load.
  const canView = isOwner || isSuperadmin || isAssignedDriver
    || (isCarrierAdmin && (load.status === 'posted' || isAssignedCarrier))
  if (!canView) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to this load' })
  }

  const events = await db.select({
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

  // Full bid list is for the owner (and superadmin) only.
  let bidList = null
  if (isOwner || isSuperadmin) {
    bidList = await db.select({
      id: bids.id,
      companyId: bids.companyId,
      companyName: companies.name,
      amountCents: bids.amountCents,
      note: bids.note,
      status: bids.status,
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
    columns: { id: true, name: true, phone: true },
  })

  return {
    load,
    events,
    bids: bidList,
    myBid,
    shipper,
    assignedCompany,
    assignedDriver,
    assignedVehicle,
  }
})
