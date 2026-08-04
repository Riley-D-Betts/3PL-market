import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  bigserial,
  boolean,
  char,
  check,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

/** Raw binary column — used for uploaded scale-ticket photos. */
const bytea = customType<{ data: Buffer, notNull: false, default: false }>({
  dataType() {
    return 'bytea'
  },
})
import {
  BID_STATUSES,
  COMPANY_STATUSES,
  LOAD_EVENT_TYPES,
  LOAD_SOURCES,
  LOAD_STATUSES,
  MATERIAL_TYPES,
  ROLES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
} from '../../shared/types'

export const userRoleEnum = pgEnum('user_role', ROLES)
export const companyStatusEnum = pgEnum('company_status', COMPANY_STATUSES)
export const vehicleTypeEnum = pgEnum('vehicle_type', VEHICLE_TYPES)
export const vehicleStatusEnum = pgEnum('vehicle_status', VEHICLE_STATUSES)
export const materialTypeEnum = pgEnum('material_type', MATERIAL_TYPES)
export const loadStatusEnum = pgEnum('load_status', LOAD_STATUSES)
export const bidStatusEnum = pgEnum('bid_status', BID_STATUSES)
export const loadEventTypeEnum = pgEnum('load_event_type', LOAD_EVENT_TYPES)
export const loadSourceEnum = pgEnum('load_source', LOAD_SOURCES)

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

/** Carrier (3PL) companies. Shippers are bare users without a company. */
export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  contactEmail: text('contact_email').notNull(),
  contactPhone: text('contact_phone'),
  mcNumber: text('mc_number'),
  address: text('address'),
  status: companyStatusEnum('status').notNull().default('pending'),
  suspendedReason: text('suspended_reason'),
  ...timestamps,
})

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    phone: text('phone'),
    role: userRoleEnum('role').notNull(),
    companyId: uuid('company_id').references(() => companies.id),
    isActive: boolean('is_active').notNull().default(true),
    /** Bumped on password change — invalidates outstanding sealed-cookie sessions. */
    sessionVersion: integer('session_version').notNull().default(0),
    /** Shippers: where carriers should send invoices. Falls back to email when null. */
    billingEmail: text('billing_email'),
    /** Drivers: where the truck lives — shown on dispatch maps to pick nearby drivers. */
    homeBaseCity: text('home_base_city'),
    homeBaseState: text('home_base_state'),
    homeBaseLat: doublePrecision('home_base_lat'),
    homeBaseLng: doublePrecision('home_base_lng'),
    ...timestamps,
  },
  table => [
    uniqueIndex('users_email_lower_unique').on(sql`lower(${table.email})`),
    index('users_company_id_idx').on(table.companyId),
    check(
      'users_company_role_check',
      sql`(${table.role} IN ('carrier_admin', 'driver')) = (${table.companyId} IS NOT NULL)`,
    ),
  ],
)

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    type: vehicleTypeEnum('type').notNull(),
    plate: text('plate').notNull(),
    capacityLbs: integer('capacity_lbs').notNull(),
    status: vehicleStatusEnum('status').notNull().default('active'),
    notes: text('notes'),
    // Ops tracking — all optional.
    insurancePolicy: text('insurance_policy'),
    insuranceExpiresAt: timestamp('insurance_expires_at', { withTimezone: true }),
    nextServiceDueAt: timestamp('next_service_due_at', { withTimezone: true }),
    odometerMi: integer('odometer_mi'),
    ...timestamps,
  },
  table => [
    uniqueIndex('vehicles_company_plate_unique').on(table.companyId, table.plate),
  ],
)

/** Maintenance history per vehicle — services, repairs, inspections. */
export const vehicleMaintenanceLogs = pgTable(
  'vehicle_maintenance_logs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    performedAt: timestamp('performed_at', { withTimezone: true }).notNull(),
    description: text('description').notNull(),
    costCents: integer('cost_cents'),
    odometerMi: integer('odometer_mi'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('vehicle_maintenance_vehicle_idx').on(table.vehicleId, table.performedAt)],
)

export const loads = pgTable(
  'loads',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** Short human-referenceable number, shown as L-<n> to both parties. */
    loadNumber: bigserial('load_number', { mode: 'number' }).notNull(),
    /** Marketplace loads have a shipper account; manual (off-platform) loads don't. */
    source: loadSourceEnum('source').notNull().default('marketplace'),
    shipperId: uuid('shipper_id').references(() => users.id),
    /** Manual loads: who the freight is for, free text. */
    externalShipperName: text('external_shipper_name'),
    externalShipperPhone: text('external_shipper_phone'),

    /** What the pickup spot is called on site — "Pit 4", "North yard". */
    pickupLocationName: text('pickup_location_name'),
    pickupAddress: text('pickup_address').notNull(),
    pickupCity: text('pickup_city').notNull(),
    pickupState: text('pickup_state').notNull(),
    pickupLat: doublePrecision('pickup_lat'),
    pickupLng: doublePrecision('pickup_lng'),

    /** The job/project the delivery belongs to — "Costco site, Meridian". */
    jobName: text('job_name'),
    deliveryAddress: text('delivery_address').notNull(),
    deliveryCity: text('delivery_city').notNull(),
    deliveryState: text('delivery_state').notNull(),
    deliveryLat: doublePrecision('delivery_lat'),
    deliveryLng: doublePrecision('delivery_lng'),

    /** Free-form instructions for the carrier/driver — gates, tarps, scale tickets. */
    notes: text('notes'),

    // On-site contacts — visible to the assigned carrier and driver only.
    pickupContactName: text('pickup_contact_name'),
    pickupContactPhone: text('pickup_contact_phone'),
    deliveryContactName: text('delivery_contact_name'),
    deliveryContactPhone: text('delivery_contact_phone'),

    materialType: materialTypeEnum('material_type').notNull(),
    materialDescription: text('material_description'),
    weightLbs: integer('weight_lbs').notNull(),
    quantity: text('quantity'),

    pickupWindowStart: timestamp('pickup_window_start', { withTimezone: true }).notNull(),
    pickupWindowEnd: timestamp('pickup_window_end', { withTimezone: true }).notNull(),

    /** Paid travel time built into the rate, shown to both parties. */
    travelTimeAllowanceMin: integer('travel_time_allowance_min'),

    /**
     * Multi-truck requests: posting with N trucks creates N sibling loads
     * (one per truck) sharing a group id, shown as "Truck seq of total".
     */
    truckGroupId: uuid('truck_group_id'),
    truckSeq: integer('truck_seq'),
    trucksTotal: integer('trucks_total'),

    /** Null only on manual loads a carrier tracks without pricing. */
    askingPriceCents: integer('asking_price_cents'),
    finalPriceCents: integer('final_price_cents'),
    currency: char('currency', { length: 3 }).notNull().default('USD'),

    status: loadStatusEnum('status').notNull().default('draft'),

    awardedBidId: uuid('awarded_bid_id').references((): AnyPgColumn => bids.id),
    assignedCompanyId: uuid('assigned_company_id').references(() => companies.id),
    assignedDriverId: uuid('assigned_driver_id').references(() => users.id),
    assignedVehicleId: uuid('assigned_vehicle_id').references(() => vehicles.id),

    postedAt: timestamp('posted_at', { withTimezone: true }),
    awardedAt: timestamp('awarded_at', { withTimezone: true }),
    pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),

    /** Actual hauled tonnage (short tons) the driver reports at delivery. */
    deliveredTons: doublePrecision('delivered_tons'),

    // Detention: terms copied from the winning bid at award; arrival stamps
    // recorded by the driver; fees frozen at the departure transitions.
    detentionFreeMinutes: integer('detention_free_minutes'),
    detentionRatePerHourCents: integer('detention_rate_per_hour_cents'),
    arrivedPickupAt: timestamp('arrived_pickup_at', { withTimezone: true }),
    arrivedDeliveryAt: timestamp('arrived_delivery_at', { withTimezone: true }),
    pickupDetentionCents: integer('pickup_detention_cents'),
    deliveryDetentionCents: integer('delivery_detention_cents'),

    ...timestamps,
  },
  table => [
    uniqueIndex('loads_load_number_unique').on(table.loadNumber),
    index('loads_status_pickup_idx').on(table.status, table.pickupWindowStart),
    index('loads_shipper_idx').on(table.shipperId),
    index('loads_assigned_company_idx').on(table.assignedCompanyId),
    index('loads_assigned_driver_idx').on(table.assignedDriverId),
    index('loads_truck_group_idx').on(table.truckGroupId),
    check('loads_pickup_window_check', sql`${table.pickupWindowStart} <= ${table.pickupWindowEnd}`),
    // NULL-safe: a bare `price > 0 OR ...` yields NULL for a priceless
    // marketplace row, and Postgres CHECKs treat NULL as satisfied.
    check('loads_asking_price_check', sql`(${table.askingPriceCents} IS NULL OR ${table.askingPriceCents} > 0) AND (${table.askingPriceCents} IS NOT NULL OR ${table.source} = 'manual')`),
    check('loads_truck_group_check', sql`(${table.truckGroupId} IS NULL) = (${table.truckSeq} IS NULL) AND (${table.truckGroupId} IS NULL) = (${table.trucksTotal} IS NULL)`),
    check('loads_weight_check', sql`${table.weightLbs} > 0`),
    check('loads_manual_shipper_check', sql`(${table.source} = 'manual') = (${table.shipperId} IS NULL)`),
  ],
)

export const bids = pgTable(
  'bids',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    loadId: uuid('load_id')
      .notNull()
      .references(() => loads.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    amountCents: integer('amount_cents').notNull(),
    note: text('note'),
    status: bidStatusEnum('status').notNull().default('pending'),
    /** Detention terms proposed by the carrier with this bid; copied to the load on award. */
    detentionFreeMinutes: integer('detention_free_minutes').notNull().default(120),
    detentionRatePerHourCents: integer('detention_rate_per_hour_cents').notNull().default(7500),
    ...timestamps,
  },
  table => [
    // One live bid per company per load; makes re-bidding an upsert target.
    uniqueIndex('bids_live_per_company_unique')
      .on(table.loadId, table.companyId)
      .where(sql`${table.status} = 'pending'`),
    index('bids_load_idx').on(table.loadId),
    index('bids_company_idx').on(table.companyId),
    check('bids_amount_check', sql`${table.amountCents} > 0`),
    check('bids_detention_free_check', sql`${table.detentionFreeMinutes} >= 0`),
    check('bids_detention_rate_check', sql`${table.detentionRatePerHourCents} >= 0`),
  ],
)

/**
 * Append-only history of everything that happens to a load.
 * lat/lng are unused today; future GPS: driver pickup/deliver events carry a
 * position with zero schema change, and a vehicle_positions table can join in.
 */
export const loadEvents = pgTable(
  'load_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    /** Monotonic insert order — createdAt ties within one transaction. */
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    loadId: uuid('load_id')
      .notNull()
      .references(() => loads.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    eventType: loadEventTypeEnum('event_type').notNull(),
    fromStatus: loadStatusEnum('from_status'),
    toStatus: loadStatusEnum('to_status'),
    payload: jsonb('payload'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('load_events_load_seq_idx').on(table.loadId, table.seq)],
)

/**
 * City-level geocoding cache (Nominatim results). Lookups are keyed on the
 * normalized "city, state" query; found=false rows suppress refetching
 * unresolvable places.
 */
export const geocodeCache = pgTable(
  'geocode_cache',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    query: text('query').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    found: boolean('found').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('geocode_cache_query_unique').on(table.query)],
)

/** Carriers a shipper refuses to work with — hidden board, no bids/accepts. */
export const shipperCarrierBlocks = pgTable(
  'shipper_carrier_blocks',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    shipperId: uuid('shipper_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('shipper_carrier_blocks_pair_unique').on(table.shipperId, table.companyId),
    index('shipper_carrier_blocks_company_idx').on(table.companyId),
  ],
)

/**
 * A driver's working day: truck, pre-trip inspection and begin mileage at
 * sign-on; ending mileage and fuel burn at sign-off. Load actions (arrive,
 * pickup, deliver) require an active shift.
 */
export const driverShifts = pgTable(
  'driver_shifts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    startOdometerMi: integer('start_odometer_mi').notNull(),
    /** Checklist results keyed by PRETRIP_ITEMS: { lights: true, ... }. */
    pretrip: jsonb('pretrip').notNull(),
    pretripDefects: text('pretrip_defects'),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    endOdometerMi: integer('end_odometer_mi'),
    fuelGallons: doublePrecision('fuel_gallons'),
  },
  table => [
    // One active (un-ended) shift per driver.
    uniqueIndex('driver_shifts_active_unique').on(table.driverId).where(sql`${table.endedAt} IS NULL`),
    index('driver_shifts_company_idx').on(table.companyId, table.startedAt),
    check('driver_shifts_start_odometer_check', sql`${table.startOdometerMi} >= 0`),
    check('driver_shifts_end_odometer_check', sql`${table.endOdometerMi} IS NULL OR ${table.endOdometerMi} >= ${table.startOdometerMi}`),
    check('driver_shifts_fuel_check', sql`${table.fuelGallons} IS NULL OR ${table.fuelGallons} >= 0`),
    // Ending data arrives together — mileage AND fuel are sign-off requirements.
    check('driver_shifts_ended_check', sql`((${table.endedAt} IS NULL) = (${table.endOdometerMi} IS NULL)) AND ((${table.endedAt} IS NULL) = (${table.fuelGallons} IS NULL))`),
  ],
)

/** Uploaded files attached to a load — today: delivery scale-ticket photos. */
export const loadAttachments = pgTable(
  'load_attachments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    loadId: uuid('load_id')
      .notNull()
      .references(() => loads.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('ticket'),
    uploadedBy: uuid('uploaded_by')
      .notNull()
      .references(() => users.id),
    contentType: text('content_type').notNull(),
    filename: text('filename'),
    sizeBytes: integer('size_bytes').notNull(),
    data: bytea('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('load_attachments_load_idx').on(table.loadId)],
)

export type Company = typeof companies.$inferSelect
export type User = typeof users.$inferSelect
export type Vehicle = typeof vehicles.$inferSelect
export type Load = typeof loads.$inferSelect
export type Bid = typeof bids.$inferSelect
export type LoadEvent = typeof loadEvents.$inferSelect
export type ShipperCarrierBlock = typeof shipperCarrierBlocks.$inferSelect
export type VehicleMaintenanceLog = typeof vehicleMaintenanceLogs.$inferSelect
export type DriverShift = typeof driverShifts.$inferSelect
export type LoadAttachment = typeof loadAttachments.$inferSelect
