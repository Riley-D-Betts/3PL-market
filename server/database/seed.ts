import { eq, sql } from 'drizzle-orm'
import type { Db } from './client'
import { bids, companies, loadEvents, loads, shipperCarrierBlocks, users, vehicles } from './schema'
import { hashUserPassword } from '../utils/password'

export const SUPERADMIN_EMAIL = 'admin@3plmarket.test'
const DEMO_PASSWORD = 'Password123!'

const hours = (n: number) => new Date(Date.now() + n * 3600_000)

/**
 * Idempotent demo seed: a no-op when the superadmin user already exists.
 * Returns true when data was inserted.
 */
export async function seed(db: Db): Promise<boolean> {
  const existing = await db.query.users.findFirst({
    where: eq(sql`lower(${users.email})`, SUPERADMIN_EMAIL),
  })
  if (existing) return false

  const passwordHash = await hashUserPassword(DEMO_PASSWORD)

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      email: SUPERADMIN_EMAIL,
      passwordHash,
      name: 'Platform Admin',
      role: 'superadmin',
    })

    const [shipper] = await tx.insert(users).values({
      email: 'shipper@demo.test',
      passwordHash,
      name: 'Boise Builders Supply',
      phone: '+1 208 555 0101',
      role: 'shipper',
      billingEmail: 'ap@boisebuilders.test',
    }).returning()

    const [granite] = await tx.insert(companies).values({
      name: 'Granite Haulers LLC',
      contactEmail: 'dispatch@granitehaulers.test',
      contactPhone: '+1 208 555 0150',
      mcNumber: 'MC-482913',
      address: '4120 Freight Way, Nampa, ID',
      status: 'approved',
    }).returning()

    const [carrierAdmin] = await tx.insert(users).values({
      email: 'carrier@demo.test',
      passwordHash,
      name: 'Grace Stone',
      phone: '+1 208 555 0151',
      role: 'carrier_admin',
      companyId: granite!.id,
    }).returning()

    const [driver1] = await tx.insert(users).values({
      email: 'driver1@demo.test',
      passwordHash,
      name: 'Dale Rocker',
      phone: '+1 208 555 0152',
      role: 'driver',
      companyId: granite!.id,
    }).returning()

    const [driver2] = await tx.insert(users).values({
      email: 'driver2@demo.test',
      passwordHash,
      name: 'Dana Boulder',
      phone: '+1 208 555 0153',
      role: 'driver',
      companyId: granite!.id,
    }).returning()

    const [flatbed] = await tx.insert(vehicles).values({
      companyId: granite!.id,
      type: 'flatbed',
      plate: 'ID-FLT-101',
      capacityKg: 22000,
    }).returning()

    const [dumpTruck] = await tx.insert(vehicles).values({
      companyId: granite!.id,
      type: 'dump_truck',
      plate: 'ID-DMP-202',
      capacityKg: 18000,
    }).returning()

    await tx.insert(vehicles).values({
      companyId: granite!.id,
      type: 'lowboy',
      plate: 'ID-LOW-303',
      capacityKg: 35000,
      status: 'maintenance',
      notes: 'Brake service until Friday',
    })

    const [pendingCo] = await tx.insert(companies).values({
      name: 'Pending Freight Co',
      contactEmail: 'office@pendingfreight.test',
      contactPhone: '+1 208 555 0180',
      status: 'pending',
    }).returning()

    await tx.insert(users).values({
      email: 'pending-carrier@demo.test',
      passwordHash,
      name: 'Pat Newman',
      role: 'carrier_admin',
      companyId: pendingCo!.id,
    })

    // Second approved carrier — competes on bids with different detention terms.
    const [swift] = await tx.insert(companies).values({
      name: 'Swift Aggregate Logistics',
      contactEmail: 'ops@swiftaggregate.test',
      contactPhone: '+1 208 555 0190',
      mcNumber: 'MC-771204',
      status: 'approved',
    }).returning()
    const [swiftAdmin] = await tx.insert(users).values({
      email: 'carrier2@demo.test',
      passwordHash,
      name: 'Sam Swift',
      role: 'carrier_admin',
      companyId: swift!.id,
    }).returning()

    // Approved carrier the demo shipper has blocked.
    const [rusty] = await tx.insert(companies).values({
      name: 'Rusty Wagon Freight',
      contactEmail: 'dispatch@rustywagon.test',
      status: 'approved',
    }).returning()
    const [rustyAdmin] = await tx.insert(users).values({
      email: 'blocked-carrier@demo.test',
      passwordHash,
      name: 'Rex Wagoner',
      role: 'carrier_admin',
      companyId: rusty!.id,
    }).returning()
    await tx.insert(shipperCarrierBlocks).values({
      shipperId: shipper!.id,
      companyId: rusty!.id,
      reason: 'Damaged a load of drywall in June',
    })

    const shipperId = shipper!.id
    const graniteId = granite!.id

    // 1. Draft load
    const [draftLoad] = await tx.insert(loads).values({
      shipperId,
      pickupAddress: '900 Supply Yard Rd',
      pickupCity: 'Boise',
      pickupState: 'ID',
      deliveryAddress: '77 Subdivision Loop',
      deliveryCity: 'Meridian',
      deliveryState: 'ID',
      materialType: 'sand',
      materialDescription: 'Washed masonry sand',
      weightKg: 9000,
      quantity: '9 t',
      pickupWindowStart: hours(72),
      pickupWindowEnd: hours(96),
      askingPriceCents: 42000,
      status: 'draft',
    }).returning()
    await tx.insert(loadEvents).values({
      loadId: draftLoad!.id,
      actorUserId: shipperId,
      eventType: 'created',
      toStatus: 'draft',
    })

    // 2. Posted load, no bids yet
    const [postedLoad] = await tx.insert(loads).values({
      shipperId,
      pickupAddress: 'Quarry Gate 3, 5500 Rock Rd',
      pickupCity: 'Nampa',
      pickupState: 'ID',
      deliveryAddress: '1420 Riverside Site Office',
      deliveryCity: 'Boise',
      deliveryState: 'ID',
      materialType: 'gravel',
      materialDescription: '3/4" crushed gravel',
      weightKg: 18000,
      quantity: '18 t',
      pickupWindowStart: hours(24),
      pickupWindowEnd: hours(48),
      askingPriceCents: 85000,
      status: 'posted',
      postedAt: hours(-2),
    }).returning()
    await tx.insert(loadEvents).values([
      { loadId: postedLoad!.id, actorUserId: shipperId, eventType: 'created', toStatus: 'draft', createdAt: hours(-3) },
      { loadId: postedLoad!.id, actorUserId: shipperId, eventType: 'posted', fromStatus: 'draft', toStatus: 'posted', createdAt: hours(-2) },
    ])

    // 3. Posted load with a pending counter-bid from Granite Haulers
    const [biddedLoad] = await tx.insert(loads).values({
      shipperId,
      pickupAddress: 'Lumber Mill Dock B, 210 Timber Ave',
      pickupCity: 'Boise',
      pickupState: 'ID',
      deliveryAddress: '88 Commercial Build Site',
      deliveryCity: 'Twin Falls',
      deliveryState: 'ID',
      materialType: 'lumber',
      materialDescription: 'Framing lumber, banded bundles',
      weightKg: 12000,
      quantity: '14 bundles',
      pickupWindowStart: hours(36),
      pickupWindowEnd: hours(60),
      askingPriceCents: 120000,
      pickupContactName: 'Mill office — Manny',
      pickupContactPhone: '+1 208 555 0201',
      deliveryContactName: 'Site super — Kara',
      deliveryContactPhone: '+1 208 555 0202',
      status: 'posted',
      postedAt: hours(-20),
    }).returning()
    const [counterBid] = await tx.insert(bids).values({
      loadId: biddedLoad!.id,
      companyId: graniteId,
      createdBy: carrierAdmin!.id,
      amountCents: 132500,
      note: 'Long deadhead back from Twin Falls — can do it for $1,325.',
      status: 'pending',
    }).returning()
    const [swiftBid] = await tx.insert(bids).values({
      loadId: biddedLoad!.id,
      companyId: swift!.id,
      createdBy: swiftAdmin!.id,
      amountCents: 128000,
      note: 'Curtain-side available, tight terms.',
      status: 'pending',
      detentionFreeMinutes: 60,
      detentionRatePerHourCents: 9500,
    }).returning()
    const [rustyBid] = await tx.insert(bids).values({
      loadId: biddedLoad!.id,
      companyId: rusty!.id,
      createdBy: rustyAdmin!.id,
      amountCents: 110000,
      status: 'rejected', // auto-rejected when the shipper blocked Rusty Wagon
    }).returning()
    await tx.insert(loadEvents).values([
      { loadId: biddedLoad!.id, actorUserId: shipperId, eventType: 'created', toStatus: 'draft', createdAt: hours(-21) },
      { loadId: biddedLoad!.id, actorUserId: shipperId, eventType: 'posted', fromStatus: 'draft', toStatus: 'posted', createdAt: hours(-20) },
      { loadId: biddedLoad!.id, actorUserId: rustyAdmin!.id, eventType: 'bid_placed', payload: { bidId: rustyBid!.id, companyId: rusty!.id, amountCents: 110000, detentionFreeMinutes: 120, detentionRatePerHourCents: 7500 }, createdAt: hours(-9) },
      { loadId: biddedLoad!.id, actorUserId: carrierAdmin!.id, eventType: 'bid_placed', payload: { bidId: counterBid!.id, companyId: graniteId, amountCents: 132500, detentionFreeMinutes: 120, detentionRatePerHourCents: 7500 }, createdAt: hours(-6) },
      { loadId: biddedLoad!.id, actorUserId: swiftAdmin!.id, eventType: 'bid_placed', payload: { bidId: swiftBid!.id, companyId: swift!.id, amountCents: 128000, detentionFreeMinutes: 60, detentionRatePerHourCents: 9500 }, createdAt: hours(-4) },
    ])

    // 4. Awarded load, driver1 + flatbed assigned
    const [awardedLoad] = await tx.insert(loads).values({
      shipperId,
      pickupAddress: 'Steel Depot, 3300 Industry Blvd',
      pickupCity: 'Boise',
      pickupState: 'ID',
      deliveryAddress: 'Bridge Project Staging, Hwy 55 MM 42',
      deliveryCity: 'Horseshoe Bend',
      deliveryState: 'ID',
      materialType: 'steel',
      materialDescription: 'W-beams, 40 ft',
      weightKg: 20000,
      quantity: '18 beams',
      pickupWindowStart: hours(12),
      pickupWindowEnd: hours(30),
      askingPriceCents: 160000,
      finalPriceCents: 150000,
      pickupContactName: 'Depot gate — Ollie',
      pickupContactPhone: '+1 208 555 0203',
      deliveryContactName: 'Bridge crew lead — Dana',
      deliveryContactPhone: '+1 208 555 0204',
      detentionFreeMinutes: 120,
      detentionRatePerHourCents: 7500,
      status: 'awarded',
      assignedCompanyId: graniteId,
      assignedDriverId: driver1!.id,
      assignedVehicleId: flatbed!.id,
      postedAt: hours(-48),
      awardedAt: hours(-24),
    }).returning()
    const [awardedBid] = await tx.insert(bids).values({
      loadId: awardedLoad!.id,
      companyId: graniteId,
      createdBy: carrierAdmin!.id,
      amountCents: 150000,
      note: 'Flatbed with beam racks available.',
      status: 'accepted',
      detentionFreeMinutes: 120,
      detentionRatePerHourCents: 7500,
    }).returning()
    await tx.update(loads).set({ awardedBidId: awardedBid!.id }).where(eq(loads.id, awardedLoad!.id))
    await tx.insert(loadEvents).values([
      { loadId: awardedLoad!.id, actorUserId: shipperId, eventType: 'created', toStatus: 'draft', createdAt: hours(-49) },
      { loadId: awardedLoad!.id, actorUserId: shipperId, eventType: 'posted', fromStatus: 'draft', toStatus: 'posted', createdAt: hours(-48) },
      { loadId: awardedLoad!.id, actorUserId: carrierAdmin!.id, eventType: 'bid_placed', payload: { bidId: awardedBid!.id, companyId: graniteId, amountCents: 150000 }, createdAt: hours(-30) },
      { loadId: awardedLoad!.id, actorUserId: shipperId, eventType: 'awarded', fromStatus: 'posted', toStatus: 'awarded', payload: { bidId: awardedBid!.id, companyId: graniteId, amountCents: 150000 }, createdAt: hours(-24) },
      { loadId: awardedLoad!.id, actorUserId: carrierAdmin!.id, eventType: 'driver_assigned', payload: { driverId: driver1!.id, vehicleId: flatbed!.id }, createdAt: hours(-20) },
    ])

    // 5. Picked-up load, driver2 + dump truck en route
    const [pickedUpLoad] = await tx.insert(loads).values({
      shipperId,
      pickupAddress: 'Batch Plant 2, 660 Mixer Ln',
      pickupCity: 'Caldwell',
      pickupState: 'ID',
      deliveryAddress: 'Foundation Pour, 15 Orchard St',
      deliveryCity: 'Boise',
      deliveryState: 'ID',
      materialType: 'aggregate',
      materialDescription: 'Road base, 1.5" minus',
      weightKg: 16500,
      quantity: '16.5 t',
      pickupWindowStart: hours(-6),
      pickupWindowEnd: hours(2),
      askingPriceCents: 68000,
      finalPriceCents: 68000,
      pickupContactName: 'Plant scale house',
      pickupContactPhone: '+1 208 555 0205',
      deliveryContactName: 'Pour foreman — Gus',
      deliveryContactPhone: '+1 208 555 0206',
      // Tight terms: 30 min free at $80/hr. Pickup wait stayed inside free
      // time (0 frozen); the truck has been waiting at delivery ~72 min, so
      // delivery detention is live-accruing in the UI right now.
      detentionFreeMinutes: 30,
      detentionRatePerHourCents: 8000,
      arrivedPickupAt: hours(-3.5),
      pickupDetentionCents: 0,
      arrivedDeliveryAt: hours(-1.2),
      status: 'picked_up',
      assignedCompanyId: graniteId,
      assignedDriverId: driver2!.id,
      assignedVehicleId: dumpTruck!.id,
      postedAt: hours(-30),
      awardedAt: hours(-26),
      pickedUpAt: hours(-3),
    }).returning()
    const [acceptBid] = await tx.insert(bids).values({
      loadId: pickedUpLoad!.id,
      companyId: graniteId,
      createdBy: carrierAdmin!.id,
      amountCents: 68000,
      note: 'Instant accept at asking price',
      status: 'accepted',
      detentionFreeMinutes: 30,
      detentionRatePerHourCents: 8000,
    }).returning()
    await tx.update(loads).set({ awardedBidId: acceptBid!.id }).where(eq(loads.id, pickedUpLoad!.id))
    await tx.insert(loadEvents).values([
      { loadId: pickedUpLoad!.id, actorUserId: shipperId, eventType: 'created', toStatus: 'draft', createdAt: hours(-31) },
      { loadId: pickedUpLoad!.id, actorUserId: shipperId, eventType: 'posted', fromStatus: 'draft', toStatus: 'posted', createdAt: hours(-30) },
      { loadId: pickedUpLoad!.id, actorUserId: carrierAdmin!.id, eventType: 'awarded', fromStatus: 'posted', toStatus: 'awarded', payload: { instantAccept: true, companyId: graniteId, amountCents: 68000, detentionFreeMinutes: 30, detentionRatePerHourCents: 8000 }, createdAt: hours(-26) },
      { loadId: pickedUpLoad!.id, actorUserId: carrierAdmin!.id, eventType: 'driver_assigned', payload: { driverId: driver2!.id, vehicleId: dumpTruck!.id }, createdAt: hours(-25) },
      { loadId: pickedUpLoad!.id, actorUserId: driver2!.id, eventType: 'arrived_pickup', createdAt: hours(-3.5) },
      { loadId: pickedUpLoad!.id, actorUserId: driver2!.id, eventType: 'picked_up', fromStatus: 'awarded', toStatus: 'picked_up', payload: { detentionMinutes: 0, detentionCents: 0 }, createdAt: hours(-3) },
      { loadId: pickedUpLoad!.id, actorUserId: driver2!.id, eventType: 'arrived_delivery', createdAt: hours(-1.2) },
    ])

    // 6. Delivered load awaiting shipper confirmation
    const [deliveredLoad] = await tx.insert(loads).values({
      shipperId,
      pickupAddress: 'Drywall Warehouse, 1200 Panel Pkwy',
      pickupCity: 'Meridian',
      pickupState: 'ID',
      deliveryAddress: 'Office Remodel, 400 Main St',
      deliveryCity: 'Boise',
      deliveryState: 'ID',
      materialType: 'drywall',
      materialDescription: '5/8" Type X sheets',
      weightKg: 8000,
      quantity: '6 pallets',
      pickupWindowStart: hours(-50),
      pickupWindowEnd: hours(-40),
      askingPriceCents: 38000,
      finalPriceCents: 36000,
      pickupContactName: 'Warehouse dock 3',
      pickupContactPhone: '+1 208 555 0207',
      deliveryContactName: 'GC office — Priya',
      deliveryContactPhone: '+1 208 555 0208',
      // Truck waited 190 min at pickup against 120 free → 70 min over at
      // $75/hr = $87.50 frozen. Delivery unload took 25 min → 0.
      detentionFreeMinutes: 120,
      detentionRatePerHourCents: 7500,
      arrivedPickupAt: hours(-46 - 190 / 60),
      pickupDetentionCents: 8750,
      arrivedDeliveryAt: hours(-42 - 25 / 60),
      deliveryDetentionCents: 0,
      status: 'delivered',
      assignedCompanyId: graniteId,
      assignedDriverId: driver1!.id,
      postedAt: hours(-80),
      awardedAt: hours(-70),
      pickedUpAt: hours(-46),
      deliveredAt: hours(-42),
    }).returning()
    const [deliveredBid] = await tx.insert(bids).values({
      loadId: deliveredLoad!.id,
      companyId: graniteId,
      createdBy: carrierAdmin!.id,
      amountCents: 36000,
      status: 'accepted',
      detentionFreeMinutes: 120,
      detentionRatePerHourCents: 7500,
    }).returning()
    await tx.update(loads).set({ awardedBidId: deliveredBid!.id }).where(eq(loads.id, deliveredLoad!.id))
    await tx.insert(loadEvents).values([
      { loadId: deliveredLoad!.id, actorUserId: shipperId, eventType: 'created', toStatus: 'draft', createdAt: hours(-81) },
      { loadId: deliveredLoad!.id, actorUserId: shipperId, eventType: 'posted', fromStatus: 'draft', toStatus: 'posted', createdAt: hours(-80) },
      { loadId: deliveredLoad!.id, actorUserId: carrierAdmin!.id, eventType: 'bid_placed', payload: { bidId: deliveredBid!.id, companyId: graniteId, amountCents: 36000, detentionFreeMinutes: 120, detentionRatePerHourCents: 7500 }, createdAt: hours(-72) },
      { loadId: deliveredLoad!.id, actorUserId: shipperId, eventType: 'awarded', fromStatus: 'posted', toStatus: 'awarded', payload: { bidId: deliveredBid!.id, companyId: graniteId, amountCents: 36000, detentionFreeMinutes: 120, detentionRatePerHourCents: 7500 }, createdAt: hours(-70) },
      { loadId: deliveredLoad!.id, actorUserId: carrierAdmin!.id, eventType: 'driver_assigned', payload: { driverId: driver1!.id }, createdAt: hours(-60) },
      { loadId: deliveredLoad!.id, actorUserId: driver1!.id, eventType: 'arrived_pickup', createdAt: hours(-46 - 190 / 60) },
      { loadId: deliveredLoad!.id, actorUserId: driver1!.id, eventType: 'picked_up', fromStatus: 'awarded', toStatus: 'picked_up', payload: { detentionMinutes: 70, detentionCents: 8750 }, createdAt: hours(-46) },
      { loadId: deliveredLoad!.id, actorUserId: driver1!.id, eventType: 'arrived_delivery', createdAt: hours(-42 - 25 / 60) },
      { loadId: deliveredLoad!.id, actorUserId: driver1!.id, eventType: 'delivered', fromStatus: 'picked_up', toStatus: 'delivered', payload: { detentionMinutes: 0, detentionCents: 0 }, createdAt: hours(-42) },
    ])
  })

  return true
}
