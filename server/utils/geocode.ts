import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { geocodeCache } from '../database/schema'

export interface GeoPoint {
  lat: number
  lng: number
}

function normalizeQuery(city: string, state: string): string {
  return `${city.trim().toLowerCase()}, ${state.trim().toLowerCase()}`
}

/**
 * Best-effort city-level geocoding via Nominatim (OpenStreetMap), backed by a
 * DB cache. Unresolvable places are negative-cached; transient network
 * failures are NOT cached and simply return null — map pins degrade
 * gracefully when coordinates are missing.
 */
export async function geocodeCityState(city: string, state: string): Promise<GeoPoint | null> {
  const query = normalizeQuery(city, state)

  const cached = await db.query.geocodeCache.findFirst({ where: eq(geocodeCache.query, query) })
  if (cached) {
    return cached.found && cached.lat !== null && cached.lng !== null
      ? { lat: cached.lat, lng: cached.lng }
      : null
  }

  let point: GeoPoint | null = null
  try {
    const params = new URLSearchParams({ format: 'json', limit: '1', q: `${city.trim()}, ${state.trim()}` })
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'user-agent': '3pl-market/1.0 (self-hosted construction logistics marketplace)' },
      signal: AbortSignal.timeout(4000),
    })
    if (!res.ok) return null
    const results = await res.json() as Array<{ lat: string, lon: string }>
    if (results[0]) {
      const lat = Number.parseFloat(results[0].lat)
      const lng = Number.parseFloat(results[0].lon)
      if (Number.isFinite(lat) && Number.isFinite(lng)) point = { lat, lng }
    }
  }
  catch {
    return null
  }

  await db.insert(geocodeCache)
    .values({ query, lat: point?.lat ?? null, lng: point?.lng ?? null, found: point !== null })
    .onConflictDoNothing({ target: geocodeCache.query })
  return point
}
