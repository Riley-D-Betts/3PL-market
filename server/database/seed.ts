import { randomUUID } from 'node:crypto'
import { eq, sql } from 'drizzle-orm'
import type { Db } from './client'
import { bids, companies, driverShifts, geocodeCache, loadAttachments, loadEvents, loads, shipperCarrierBlocks, users, vehicleMaintenanceLogs, vehicles } from './schema'
import { hashUserPassword } from '../utils/password'

export const SUPERADMIN_EMAIL = 'admin@3plmarket.test'
const DEMO_PASSWORD = 'Password123!'

const hours = (n: number) => new Date(Date.now() + n * 3600_000)

/** Real coordinates for the demo's Idaho cities — maps work with no network. */
const CITY_COORDS: Record<string, { lat: number, lng: number }> = {
  'boise': { lat: 43.6150, lng: -116.2023 },
  'meridian': { lat: 43.6121, lng: -116.3915 },
  'nampa': { lat: 43.5407, lng: -116.5635 },
  'caldwell': { lat: 43.6629, lng: -116.6874 },
  'twin falls': { lat: 42.5558, lng: -114.4701 },
  'horseshoe bend': { lat: 43.9174, lng: -116.1962 },
  'kuna': { lat: 43.4918, lng: -116.4201 },
}

const geo = (city: string) => CITY_COORDS[city.toLowerCase()]!

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
      homeBaseCity: 'Boise',
      homeBaseState: 'ID',
      homeBaseLat: geo('boise').lat,
      homeBaseLng: geo('boise').lng,
    }).returning()

    const [driver2] = await tx.insert(users).values({
      email: 'driver2@demo.test',
      passwordHash,
      name: 'Dana Boulder',
      phone: '+1 208 555 0153',
      role: 'driver',
      companyId: granite!.id,
      homeBaseCity: 'Nampa',
      homeBaseState: 'ID',
      homeBaseLat: geo('nampa').lat,
      homeBaseLng: geo('nampa').lng,
    }).returning()

    const [flatbed] = await tx.insert(vehicles).values({
      companyId: granite!.id,
      type: 'flatbed',
      plate: 'ID-FLT-101',
      capacityLbs: 48000,
      insurancePolicy: 'GH-INS-77812',
      insuranceExpiresAt: hours(200 * 24),
      nextServiceDueAt: hours(20 * 24), // "20d left" warning badge
      odometerMi: 90200,
    }).returning()

    const [dumpTruck] = await tx.insert(vehicles).values({
      companyId: granite!.id,
      type: 'dump_truck',
      plate: 'ID-DMP-202',
      capacityLbs: 40000,
      insurancePolicy: 'GH-INS-77813',
      insuranceExpiresAt: hours(18 * 24), // expiring-soon warning badge
      nextServiceDueAt: hours(120 * 24),
      odometerMi: 113300,
    }).returning()

    await tx.insert(vehicles).values({
      companyId: granite!.id,
      type: 'lowboy',
      plate: 'ID-LOW-303',
      capacityLbs: 77000,
      status: 'maintenance',
      notes: 'Brake service until Friday',
      insurancePolicy: 'GH-INS-77814',
      insuranceExpiresAt: hours(300 * 24),
      nextServiceDueAt: hours(-5 * 24), // overdue badge
      odometerMi: 61000,
    })

    await tx.insert(vehicleMaintenanceLogs).values({
      vehicleId: dumpTruck!.id,
      performedAt: hours(-40 * 24),
      description: 'Oil change + air filter',
      costCents: 42000,
      odometerMi: 111200,
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

    // Prefill the geocode cache so demo cities never hit Nominatim.
    await tx.insert(geocodeCache).values(
      Object.entries(CITY_COORDS).map(([city, point]) => ({
        query: `${city}, id`,
        lat: point.lat,
        lng: point.lng,
        found: true,
      })),
    )

    const shipperId = shipper!.id
    const graniteId = granite!.id

    // 1. Draft load
    const [draftLoad] = await tx.insert(loads).values({
      shipperId,
      pickupAddress: '900 Supply Yard Rd',
      pickupCity: 'Boise',
      pickupState: 'ID',
      pickupLat: geo('boise').lat,
      pickupLng: geo('boise').lng,
      deliveryAddress: '77 Subdivision Loop',
      deliveryCity: 'Meridian',
      deliveryState: 'ID',
      deliveryLat: geo('meridian').lat,
      deliveryLng: geo('meridian').lng,
      materialType: 'sand',
      materialDescription: 'Washed masonry sand',
      weightLbs: 20000,
      quantity: '10 tons',
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

    // 2. Posted load, no bids yet — shows off the posting extras: location
    // name, job name, notes and a travel time allowance.
    const [postedLoad] = await tx.insert(loads).values({
      shipperId,
      pickupLocationName: 'Gate 3 — Rock Rd quarry',
      pickupAddress: 'Quarry Gate 3, 5500 Rock Rd',
      pickupCity: 'Nampa',
      pickupState: 'ID',
      pickupLat: geo('nampa').lat,
      pickupLng: geo('nampa').lng,
      jobName: 'Riverside Apartments — phase 2',
      deliveryAddress: '1420 Riverside Site Office',
      deliveryCity: 'Boise',
      deliveryState: 'ID',
      deliveryLat: geo('boise').lat,
      deliveryLng: geo('boise').lng,
      materialType: 'gravel',
      materialDescription: '3/4" crushed gravel',
      weightLbs: 40000,
      quantity: '20 tons',
      notes: 'Check in at the scale house first. Tarps required on the highway leg.',
      travelTimeAllowanceMin: 45,
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
      pickupLat: geo('boise').lat,
      pickupLng: geo('boise').lng,
      deliveryAddress: '88 Commercial Build Site',
      deliveryCity: 'Twin Falls',
      deliveryState: 'ID',
      deliveryLat: geo('twin falls').lat,
      deliveryLng: geo('twin falls').lng,
      materialType: 'lumber',
      materialDescription: 'Framing lumber, banded bundles',
      weightLbs: 26000,
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
      pickupLat: geo('boise').lat,
      pickupLng: geo('boise').lng,
      deliveryAddress: 'Bridge Project Staging, Hwy 55 MM 42',
      deliveryCity: 'Horseshoe Bend',
      deliveryState: 'ID',
      deliveryLat: geo('horseshoe bend').lat,
      deliveryLng: geo('horseshoe bend').lng,
      materialType: 'steel',
      materialDescription: 'W-beams, 40 ft',
      weightLbs: 44000,
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
      pickupLat: geo('caldwell').lat,
      pickupLng: geo('caldwell').lng,
      deliveryAddress: 'Foundation Pour, 15 Orchard St',
      deliveryCity: 'Boise',
      deliveryState: 'ID',
      deliveryLat: geo('boise').lat,
      deliveryLng: geo('boise').lng,
      materialType: 'aggregate',
      materialDescription: 'Road base, 1.5" minus',
      weightLbs: 36000,
      quantity: '18 tons',
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

    // 5b. Manual (off-platform) load — freight Granite booked outside the
    // marketplace, managed here: unassigned, so it lands in the day board's
    // "Unassigned" lane.
    const [manualLoad] = await tx.insert(loads).values({
      source: 'manual',
      shipperId: null,
      externalShipperName: 'Palouse Sand & Stone',
      externalShipperPhone: '+1 208 555 0400',
      pickupLocationName: 'Pit 4',
      pickupAddress: 'Pit 4, 900 Quarry Rd',
      pickupCity: 'Kuna',
      pickupState: 'ID',
      pickupLat: geo('kuna').lat,
      pickupLng: geo('kuna').lng,
      jobName: 'Palouse batch yard restock',
      deliveryAddress: 'Batch yard, 55 Industrial Ave',
      deliveryCity: 'Boise',
      deliveryState: 'ID',
      deliveryLat: geo('boise').lat,
      deliveryLng: geo('boise').lng,
      materialType: 'sand',
      materialDescription: 'Fill sand, repeat weekly run',
      weightLbs: 33000,
      quantity: '16 tons',
      notes: 'Loader on site from 6am. Take the haul road — no trucks past the office.',
      pickupWindowStart: hours(5),
      pickupWindowEnd: hours(9),
      askingPriceCents: 52000,
      finalPriceCents: 52000,
      status: 'awarded',
      assignedCompanyId: graniteId,
      awardedAt: hours(-1),
    }).returning()
    await tx.insert(loadEvents).values({
      loadId: manualLoad!.id,
      actorUserId: carrierAdmin!.id,
      eventType: 'created',
      toStatus: 'awarded',
      payload: { manual: true, externalShipperName: 'Palouse Sand & Stone' },
      createdAt: hours(-1),
    })

    // 5b. Unpriced two-truck internal move — price-less manual loads and the
    // "Truck n/2" badges in one demo (both land in the Unassigned lane).
    const yardMoveGroup = randomUUID()
    for (let seq = 1; seq <= 2; seq++) {
      const [internalLoad] = await tx.insert(loads).values({
        source: 'manual' as const,
        shipperId: null,
        externalShipperName: 'Granite Haulers (internal)',
        pickupLocationName: 'Old laydown yard',
        pickupAddress: '2200 Gravel Way',
        pickupCity: 'Caldwell',
        pickupState: 'ID',
        pickupLat: geo('caldwell').lat,
        pickupLng: geo('caldwell').lng,
        jobName: 'Yard consolidation',
        deliveryAddress: 'New yard, 90 Ridge Rd',
        deliveryCity: 'Nampa',
        deliveryState: 'ID',
        deliveryLat: geo('nampa').lat,
        deliveryLng: geo('nampa').lng,
        materialType: 'equipment' as const,
        materialDescription: 'Forms, jersey barriers, attachments',
        weightLbs: 24000,
        notes: 'No rate — internal equipment move between our yards.',
        truckGroupId: yardMoveGroup,
        truckSeq: seq,
        trucksTotal: 2,
        pickupWindowStart: hours(26),
        pickupWindowEnd: hours(32),
        askingPriceCents: null,
        finalPriceCents: null,
        status: 'awarded' as const,
        assignedCompanyId: graniteId,
        awardedAt: hours(-0.5),
      }).returning()
      await tx.insert(loadEvents).values({
        loadId: internalLoad!.id,
        actorUserId: carrierAdmin!.id,
        eventType: 'created',
        toStatus: 'awarded',
        payload: { manual: true, externalShipperName: 'Granite Haulers (internal)', truckSeq: seq, trucksTotal: 2 },
        createdAt: hours(-0.5),
      })
    }

    // 6. Delivered load awaiting shipper confirmation
    const [deliveredLoad] = await tx.insert(loads).values({
      shipperId,
      pickupAddress: 'Drywall Warehouse, 1200 Panel Pkwy',
      pickupCity: 'Meridian',
      pickupState: 'ID',
      pickupLat: geo('meridian').lat,
      pickupLng: geo('meridian').lng,
      deliveryAddress: 'Office Remodel, 400 Main St',
      deliveryCity: 'Boise',
      deliveryState: 'ID',
      deliveryLat: geo('boise').lat,
      deliveryLng: geo('boise').lng,
      materialType: 'drywall',
      materialDescription: '5/8" Type X sheets',
      weightLbs: 17500,
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
      deliveredTons: 8.7,
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
      { loadId: deliveredLoad!.id, actorUserId: driver1!.id, eventType: 'delivered', fromStatus: 'picked_up', toStatus: 'delivered', payload: { detentionMinutes: 0, detentionCents: 0, deliveredTons: 8.7 }, createdAt: hours(-42) },
    ])

    // The delivered load's scale ticket (a tiny placeholder PNG).
    const ticketPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    await tx.insert(loadAttachments).values({
      loadId: deliveredLoad!.id,
      kind: 'ticket',
      uploadedBy: driver1!.id,
      contentType: 'image/png',
      filename: 'scale-ticket.png',
      sizeBytes: ticketPng.length,
      data: ticketPng,
      createdAt: hours(-42),
    })

    // Both demo drivers are signed on: truck, clean pre-trip, begin mileage.
    const cleanPretrip = { lights: true, tires: true, brakes: true, steering: true, fluids: true, mirrors: true, horn: true, coupling: true, safety: true }
    await tx.insert(driverShifts).values([
      {
        driverId: driver1!.id,
        companyId: graniteId,
        vehicleId: flatbed!.id,
        startedAt: hours(-3),
        startOdometerMi: 90200,
        pretrip: cleanPretrip,
      },
      {
        driverId: driver2!.id,
        companyId: graniteId,
        vehicleId: dumpTruck!.id,
        startedAt: hours(-4),
        startOdometerMi: 113300,
        pretrip: { ...cleanPretrip, lights: false },
        pretripDefects: 'Right rear marker light out — bulb on order',
      },
    ])
  })

  return true
}
