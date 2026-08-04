import { z } from 'zod'
import { LOAD_STATUSES, MATERIAL_TYPES, PRETRIP_ITEMS, VEHICLE_STATUSES, VEHICLE_TYPES } from '../../shared/types'

const email = z.email().max(320).transform(v => v.toLowerCase())
const password = z.string().min(8).max(200)
const name = z.string().trim().min(1).max(200)
const phone = z.string().trim().max(50).optional()

// Strict date input: z.coerce.date() alone turns null into 1970-01-01 —
// restrict inputs to non-empty strings or Date before coercing.
const dateInput = z.union([z.string().min(1), z.date()]).pipe(z.coerce.date())

const contactName = z.string().trim().min(1).max(200)
const contactPhone = z.string().trim().min(1).max(50)

const latitude = z.number().min(-90).max(90)
const longitude = z.number().min(-180).max(180)

/** Fields shared by shipper-posted and carrier-entered (manual) loads. */
const loadCommonFields = {
  pickupLocationName: z.string().trim().min(1).max(200).optional(),
  pickupAddress: z.string().trim().min(1).max(500),
  pickupCity: z.string().trim().min(1).max(100),
  pickupState: z.string().trim().min(1).max(50),
  jobName: z.string().trim().min(1).max(200).optional(),
  deliveryAddress: z.string().trim().min(1).max(500),
  deliveryCity: z.string().trim().min(1).max(100),
  deliveryState: z.string().trim().min(1).max(50),
  // Explicit pin coordinates (e.g. a dropped Google Maps pin) win over geocoding.
  pickupLat: latitude.optional(),
  pickupLng: longitude.optional(),
  deliveryLat: latitude.optional(),
  deliveryLng: longitude.optional(),
  materialType: z.enum(MATERIAL_TYPES),
  materialDescription: z.string().trim().max(2000).optional(),
  weightLbs: z.number().int().positive(),
  quantity: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(4000).optional(),
  travelTimeAllowanceMin: z.number().int().min(0).max(1440).optional(),
  /** Posting with N trucks creates N sibling loads, one per truck. */
  trucksRequested: z.number().int().min(1).max(50).default(1),
  pickupWindowStart: dateInput,
  pickupWindowEnd: dateInput,
  pickupContactName: contactName.optional(),
  pickupContactPhone: contactPhone.optional(),
  deliveryContactName: contactName.optional(),
  deliveryContactPhone: contactPhone.optional(),
}

/** Detention terms a carrier proposes with its bid / instant accept. */
const detentionTerms = {
  detentionFreeMinutes: z.number().int().min(0).max(1440).default(120),
  detentionRatePerHourCents: z.number().int().min(0).max(100_000).default(7500),
}

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
})

export const registerShipperSchema = z.object({
  name,
  email,
  password,
  phone,
  billingEmail: email.optional(),
})

export const shipperProfileSchema = z.object({
  billingEmail: email.nullable(),
})

export const registerCarrierSchema = z.object({
  companyName: name,
  contactPhone: phone,
  mcNumber: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
  name,
  email,
  password,
  phone,
})

export const loadInputSchema = z.object({
  ...loadCommonFields,
  askingPriceCents: z.number().int().positive(),
  post: z.boolean().optional().default(false),
}).refine(v => v.pickupWindowStart <= v.pickupWindowEnd, {
  message: 'First load time must be before the last load time',
  path: ['pickupWindowEnd'],
})

export const loadPatchSchema = z.object({
  pickupLocationName: z.string().trim().min(1).max(200).nullable().optional(),
  pickupAddress: z.string().trim().min(1).max(500).optional(),
  pickupCity: z.string().trim().min(1).max(100).optional(),
  pickupState: z.string().trim().min(1).max(50).optional(),
  jobName: z.string().trim().min(1).max(200).nullable().optional(),
  deliveryAddress: z.string().trim().min(1).max(500).optional(),
  deliveryCity: z.string().trim().min(1).max(100).optional(),
  deliveryState: z.string().trim().min(1).max(50).optional(),
  pickupLat: latitude.optional(),
  pickupLng: longitude.optional(),
  deliveryLat: latitude.optional(),
  deliveryLng: longitude.optional(),
  materialType: z.enum(MATERIAL_TYPES).optional(),
  materialDescription: z.string().trim().max(2000).nullable().optional(),
  weightLbs: z.number().int().positive().optional(),
  quantity: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(4000).nullable().optional(),
  travelTimeAllowanceMin: z.number().int().min(0).max(1440).nullable().optional(),
  pickupWindowStart: dateInput.optional(),
  pickupWindowEnd: dateInput.optional(),
  askingPriceCents: z.number().int().positive().optional(),
  pickupContactName: contactName.nullable().optional(),
  pickupContactPhone: contactPhone.nullable().optional(),
  deliveryContactName: contactName.nullable().optional(),
  deliveryContactPhone: contactPhone.nullable().optional(),
}).refine(v => (v.pickupLat === undefined) === (v.pickupLng === undefined), {
  message: 'pickupLat and pickupLng must be sent together',
  path: ['pickupLng'],
}).refine(v => (v.deliveryLat === undefined) === (v.deliveryLng === undefined), {
  message: 'deliveryLat and deliveryLng must be sent together',
  path: ['deliveryLng'],
})

export const bidInputSchema = z.object({
  amountCents: z.number().int().positive(),
  note: z.string().trim().max(1000).optional(),
  ...detentionTerms,
})

/** Instant accept — body may be entirely absent; defaults apply. */
export const acceptSchema = z.object({
  ...detentionTerms,
})

export const blockInputSchema = z.object({
  companyId: z.uuid(),
  reason: z.string().trim().max(500).optional(),
})

export const demoLoginSchema = z.object({
  userId: z.uuid(),
})

export const reportsQuerySchema = z.object({
  from: dateInput.optional(),
  to: dateInput.optional(),
})

/** Off-platform load a carrier manages through the system. Price is optional — internal work needs no rate. */
export const manualLoadSchema = z.object({
  ...loadCommonFields,
  priceCents: z.number().int().positive().optional(),
  externalShipperName: z.string().trim().min(1).max(200),
  externalShipperPhone: z.string().trim().max(50).optional(),
  driverId: z.uuid().optional(),
  vehicleId: z.uuid().optional(),
}).refine(v => v.pickupWindowStart <= v.pickupWindowEnd, {
  message: 'First load time must be before the last load time',
  path: ['pickupWindowEnd'],
})

export const nextLoadsQuerySchema = z.object({
  fromLoadId: z.uuid(),
  vehicleId: z.uuid().optional(),
})

export const awardSchema = z.object({
  bidId: z.uuid(),
})

export const vehicleInputSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  plate: z.string().trim().min(1).max(20),
  capacityLbs: z.number().int().positive(),
  status: z.enum(VEHICLE_STATUSES).optional().default('active'),
  notes: z.string().trim().max(1000).optional(),
  insurancePolicy: z.string().trim().max(100).optional(),
  insuranceExpiresAt: dateInput.optional(),
  nextServiceDueAt: dateInput.optional(),
  odometerMi: z.number().int().min(0).max(2_000_000).optional(),
})

export const vehiclePatchSchema = z.object({
  type: z.enum(VEHICLE_TYPES).optional(),
  plate: z.string().trim().min(1).max(20).optional(),
  capacityLbs: z.number().int().positive().optional(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  insurancePolicy: z.string().trim().max(100).nullable().optional(),
  insuranceExpiresAt: dateInput.nullable().optional(),
  nextServiceDueAt: dateInput.nullable().optional(),
  odometerMi: z.number().int().min(0).max(2_000_000).nullable().optional(),
})

export const maintenanceLogSchema = z.object({
  performedAt: dateInput,
  description: z.string().trim().min(1).max(1000),
  costCents: z.number().int().min(0).optional(),
  odometerMi: z.number().int().min(0).max(2_000_000).optional(),
})

export const driverCreateSchema = z.object({
  name,
  email,
  password,
  phone,
  homeBaseCity: z.string().trim().min(1).max(100).optional(),
  homeBaseState: z.string().trim().min(1).max(50).optional(),
})

export const driverPatchSchema = z.object({
  name: name.optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  password: password.optional(),
  isActive: z.boolean().optional(),
  homeBaseCity: z.string().trim().min(1).max(100).nullable().optional(),
  homeBaseState: z.string().trim().min(1).max(50).nullable().optional(),
})

export const assignSchema = z.object({
  driverId: z.uuid(),
  vehicleId: z.uuid().nullable().optional(),
})

export const suspendSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const loadsQuerySchema = z.object({
  status: z.enum(LOAD_STATUSES).optional(),
})

/** Sign-on: truck, begin mileage and the full pre-trip inspection. */
export const shiftStartSchema = z.object({
  vehicleId: z.uuid(),
  startOdometerMi: z.number().int().min(0).max(2_000_000),
  checklist: z.object(
    Object.fromEntries(Object.keys(PRETRIP_ITEMS).map(k => [k, z.boolean()])) as Record<keyof typeof PRETRIP_ITEMS, z.ZodBoolean>,
  ),
  defects: z.string().trim().max(2000).optional(),
}).refine(v => Object.values(v.checklist).every(Boolean) || (v.defects && v.defects.length > 0), {
  message: 'Describe the defects for any unchecked inspection item',
  path: ['defects'],
})

/** Sign-off: ending mileage and fuel burned. */
export const shiftEndSchema = z.object({
  endOdometerMi: z.number().int().min(0).max(2_000_000),
  fuelGallons: z.number().min(0).max(1000),
})

/** Driver's delivery confirmation — actual hauled tonnage (short tons). */
export const deliverSchema = z.object({
  deliveredTons: z.number().positive().max(100),
})

export const boardQuerySchema = z.object({
  materialType: z.enum(MATERIAL_TYPES).optional(),
  pickupState: z.string().trim().max(50).optional(),
  q: z.string().trim().max(100).optional(),
  maxWeightLbs: z.coerce.number().int().positive().optional(),
})

