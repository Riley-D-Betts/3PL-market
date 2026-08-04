import { z } from 'zod'
import { LOAD_STATUSES, MATERIAL_TYPES, VEHICLE_STATUSES, VEHICLE_TYPES } from '../../shared/types'

const email = z.email().max(320).transform(v => v.toLowerCase())
const password = z.string().min(8).max(200)
const name = z.string().trim().min(1).max(200)
const phone = z.string().trim().max(50).optional()

// Strict date input: z.coerce.date() alone turns null into 1970-01-01 —
// restrict inputs to non-empty strings or Date before coercing.
const dateInput = z.union([z.string().min(1), z.date()]).pipe(z.coerce.date())

const contactName = z.string().trim().min(1).max(200)
const contactPhone = z.string().trim().min(1).max(50)

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
  pickupAddress: z.string().trim().min(1).max(500),
  pickupCity: z.string().trim().min(1).max(100),
  pickupState: z.string().trim().min(1).max(50),
  deliveryAddress: z.string().trim().min(1).max(500),
  deliveryCity: z.string().trim().min(1).max(100),
  deliveryState: z.string().trim().min(1).max(50),
  materialType: z.enum(MATERIAL_TYPES),
  materialDescription: z.string().trim().max(2000).optional(),
  weightKg: z.number().int().positive(),
  quantity: z.string().trim().max(200).optional(),
  pickupWindowStart: dateInput,
  pickupWindowEnd: dateInput,
  askingPriceCents: z.number().int().positive(),
  pickupContactName: contactName.optional(),
  pickupContactPhone: contactPhone.optional(),
  deliveryContactName: contactName.optional(),
  deliveryContactPhone: contactPhone.optional(),
  post: z.boolean().optional().default(false),
}).refine(v => v.pickupWindowStart <= v.pickupWindowEnd, {
  message: 'Pickup window start must be before its end',
  path: ['pickupWindowEnd'],
})

export const loadPatchSchema = z.object({
  pickupAddress: z.string().trim().min(1).max(500).optional(),
  pickupCity: z.string().trim().min(1).max(100).optional(),
  pickupState: z.string().trim().min(1).max(50).optional(),
  deliveryAddress: z.string().trim().min(1).max(500).optional(),
  deliveryCity: z.string().trim().min(1).max(100).optional(),
  deliveryState: z.string().trim().min(1).max(50).optional(),
  materialType: z.enum(MATERIAL_TYPES).optional(),
  materialDescription: z.string().trim().max(2000).nullable().optional(),
  weightKg: z.number().int().positive().optional(),
  quantity: z.string().trim().max(200).nullable().optional(),
  pickupWindowStart: dateInput.optional(),
  pickupWindowEnd: dateInput.optional(),
  askingPriceCents: z.number().int().positive().optional(),
  pickupContactName: contactName.nullable().optional(),
  pickupContactPhone: contactPhone.nullable().optional(),
  deliveryContactName: contactName.nullable().optional(),
  deliveryContactPhone: contactPhone.nullable().optional(),
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

export const awardSchema = z.object({
  bidId: z.uuid(),
})

export const vehicleInputSchema = z.object({
  type: z.enum(VEHICLE_TYPES),
  plate: z.string().trim().min(1).max(20),
  capacityKg: z.number().int().positive(),
  status: z.enum(VEHICLE_STATUSES).optional().default('active'),
  notes: z.string().trim().max(1000).optional(),
})

export const vehiclePatchSchema = z.object({
  type: z.enum(VEHICLE_TYPES).optional(),
  plate: z.string().trim().min(1).max(20).optional(),
  capacityKg: z.number().int().positive().optional(),
  status: z.enum(VEHICLE_STATUSES).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
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

export const boardQuerySchema = z.object({
  materialType: z.enum(MATERIAL_TYPES).optional(),
  pickupState: z.string().trim().max(50).optional(),
  q: z.string().trim().max(100).optional(),
  maxWeightKg: z.coerce.number().int().positive().optional(),
})

