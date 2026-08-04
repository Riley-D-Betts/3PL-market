import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  bigserial,
  boolean,
  check,
  char,
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
import {
  BID_STATUSES,
  COMPANY_STATUSES,
  LOAD_EVENT_TYPES,
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
    capacityKg: integer('capacity_kg').notNull(),
    status: vehicleStatusEnum('status').notNull().default('active'),
    notes: text('notes'),
    ...timestamps,
  },
  table => [
    uniqueIndex('vehicles_company_plate_unique').on(table.companyId, table.plate),
  ],
)

export const loads = pgTable(
  'loads',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    shipperId: uuid('shipper_id')
      .notNull()
      .references(() => users.id),

    pickupAddress: text('pickup_address').notNull(),
    pickupCity: text('pickup_city').notNull(),
    pickupState: text('pickup_state').notNull(),
    pickupLat: doublePrecision('pickup_lat'),
    pickupLng: doublePrecision('pickup_lng'),

    deliveryAddress: text('delivery_address').notNull(),
    deliveryCity: text('delivery_city').notNull(),
    deliveryState: text('delivery_state').notNull(),
    deliveryLat: doublePrecision('delivery_lat'),
    deliveryLng: doublePrecision('delivery_lng'),

    materialType: materialTypeEnum('material_type').notNull(),
    materialDescription: text('material_description'),
    weightKg: integer('weight_kg').notNull(),
    quantity: text('quantity'),

    pickupWindowStart: timestamp('pickup_window_start', { withTimezone: true }).notNull(),
    pickupWindowEnd: timestamp('pickup_window_end', { withTimezone: true }).notNull(),

    askingPriceCents: integer('asking_price_cents').notNull(),
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

    ...timestamps,
  },
  table => [
    index('loads_status_pickup_idx').on(table.status, table.pickupWindowStart),
    index('loads_shipper_idx').on(table.shipperId),
    index('loads_assigned_company_idx').on(table.assignedCompanyId),
    index('loads_assigned_driver_idx').on(table.assignedDriverId),
    check('loads_pickup_window_check', sql`${table.pickupWindowStart} <= ${table.pickupWindowEnd}`),
    check('loads_asking_price_check', sql`${table.askingPriceCents} > 0`),
    check('loads_weight_check', sql`${table.weightKg} > 0`),
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

export type Company = typeof companies.$inferSelect
export type User = typeof users.$inferSelect
export type Vehicle = typeof vehicles.$inferSelect
export type Load = typeof loads.$inferSelect
export type Bid = typeof bids.$inferSelect
export type LoadEvent = typeof loadEvents.$inferSelect
