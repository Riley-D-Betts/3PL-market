import type { MaterialType, VehicleType } from '../types'

/** Great-circle distance in kilometres. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/**
 * Which vehicle types typically haul which materials. Advisory only — shown
 * as a fit hint in the next-leg planner, never a hard filter.
 */
const MATERIAL_VEHICLE_FIT: Record<MaterialType, VehicleType[]> = {
  aggregate: ['dump_truck'],
  sand: ['dump_truck'],
  gravel: ['dump_truck'],
  concrete: ['mixer', 'flatbed'],
  lumber: ['flatbed', 'box_truck'],
  steel: ['flatbed', 'lowboy'],
  brick_block: ['flatbed', 'box_truck'],
  drywall: ['flatbed', 'box_truck'],
  pipe: ['flatbed', 'lowboy'],
  equipment: ['lowboy', 'flatbed'],
  other: [],
}

/** True when the vehicle type is a typical match (or the material is unopinionated). */
export function materialFitsVehicle(material: MaterialType, vehicleType: VehicleType): boolean {
  const fits = MATERIAL_VEHICLE_FIT[material]
  return fits.length === 0 || vehicleType === 'other' || fits.includes(vehicleType)
}
