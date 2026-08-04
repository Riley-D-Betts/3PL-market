import type { MaterialType, VehicleType } from '../types'

/** Great-circle distance in miles. */
export function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(bLat - aLat)
  const dLng = rad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.sqrt(h))
}

const FLOAT = String.raw`-?\d{1,3}(?:\.\d+)?`

/**
 * Pull coordinates out of text dropped or pasted into an address field —
 * a Google Maps pin dragged onto the input arrives as its share URL.
 * Handles, in order of specificity:
 *  - place URLs' pin position:  ...!3d43.615!4d-116.2...
 *  - query params:              ?q=43.615,-116.2  /  q=loc:...  /  ll=  /  query=
 *  - map-center URLs:           /@43.615,-116.2,12z
 *  - geo: URIs and raw "lat, lng" text
 */
export function parseLatLng(text: string): { lat: number, lng: number } | null {
  const t = text.trim()
  if (!t || t.length > 2000) return null
  const patterns = [
    new RegExp(String.raw`!3d(${FLOAT})!4d(${FLOAT})`),
    new RegExp(String.raw`[?&](?:q|ll|query|destination|center)=(?:loc:)?(${FLOAT})\s*,\s*(${FLOAT})`, 'i'),
    new RegExp(String.raw`/@(${FLOAT}),(${FLOAT})[,/]`),
    new RegExp(String.raw`^geo:(${FLOAT}),(${FLOAT})`, 'i'),
    new RegExp(String.raw`^(${FLOAT})\s*,\s*(${FLOAT})$`),
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (!m) continue
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)) {
      return { lat, lng }
    }
  }
  return null
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
