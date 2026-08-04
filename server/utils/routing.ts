import { eq, lt, sql } from 'drizzle-orm'
import { db } from '../database/client'
import { routeCache } from '../database/schema'
import type { GeoPoint } from './geocode'

export interface DrivingRoute {
  durationSec: number
  distanceMeters: number
  /** GeoJSON LineString coordinates — [lng, lat] pairs. */
  geometry: [number, number][]
}

/** ~11 m precision — keys nearby requests to the same cache row. */
const round = (n: number) => n.toFixed(4)
const cacheKey = (from: GeoPoint, to: GeoPoint) =>
  `${round(from.lat)},${round(from.lng)}|${round(to.lat)},${round(to.lng)}`

/** Cached routes go stale eventually (roads change); refetch after 30 days. */
const CACHE_TTL_MS = 30 * 86400_000

/**
 * Circuit breaker: when OSRM errors or times out, stop asking for a minute —
 * otherwise an outage adds a 5s stall to every uncached load view.
 */
let osrmDownUntil = 0
/** Single-flight: N concurrent views of a cold lane share one OSRM request. */
const inflight = new Map<string, Promise<DrivingRoute | null>>()

/**
 * Best-effort driving route via the public OSRM server (OpenStreetMap data),
 * backed by a DB cache. Unroutable pairs are negative-cached; transient
 * network failures trip the circuit breaker but are never persisted — the UI
 * falls back to straight-line distance and no drive-time estimate.
 */
export async function getDrivingRoute(from: GeoPoint, to: GeoPoint): Promise<DrivingRoute | null> {
  const key = cacheKey(from, to)

  const cached = await db.query.routeCache.findFirst({ where: eq(routeCache.key, key) })
  if (cached && Date.now() - cached.createdAt.getTime() < CACHE_TTL_MS) {
    return cached.found && cached.durationSec !== null && cached.distanceMeters !== null
      ? {
          durationSec: cached.durationSec,
          distanceMeters: cached.distanceMeters,
          geometry: (cached.geometry ?? []) as [number, number][],
        }
      : null
  }

  if (Date.now() < osrmDownUntil) return null
  const existing = inflight.get(key)
  if (existing) return existing

  const request = fetchRoute(from, to, key)
  inflight.set(key, request)
  try {
    return await request
  }
  finally {
    inflight.delete(key)
  }
}

async function fetchRoute(from: GeoPoint, to: GeoPoint, key: string): Promise<DrivingRoute | null> {
  let route: DrivingRoute | null = null
  let routable = false
  try {
    const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`
    // overview=simplified: visually identical at whole-route zoom, ~50x smaller.
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=simplified&geometries=geojson`, {
      headers: { 'user-agent': '3pl-market/1.0 (self-hosted construction logistics marketplace)' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      osrmDownUntil = Date.now() + 60_000
      return null
    }
    const body = await res.json() as {
      code: string
      routes?: Array<{ duration: number, distance: number, geometry: { coordinates: [number, number][] } }>
    }
    // "Ok" with no route and explicit NoRoute both mean the pair is unroutable
    // — a stable fact worth negative-caching. Other codes are treated as
    // transient and not cached.
    if (body.code === 'Ok' || body.code === 'NoRoute') {
      routable = true
      const best = body.routes?.[0]
      if (best) {
        route = {
          durationSec: Math.round(best.duration),
          distanceMeters: Math.round(best.distance),
          geometry: best.geometry.coordinates,
        }
      }
    }
  }
  catch {
    osrmDownUntil = Date.now() + 60_000
    return null
  }
  if (!routable) {
    osrmDownUntil = Date.now() + 60_000
    return null
  }

  // Opportunistic pruning keeps the cache from growing without bound.
  await db.delete(routeCache).where(lt(routeCache.createdAt, new Date(Date.now() - CACHE_TTL_MS)))
  await db.insert(routeCache)
    .values({
      key,
      durationSec: route?.durationSec ?? null,
      distanceMeters: route?.distanceMeters ?? null,
      geometry: route?.geometry ?? null,
      found: route !== null,
    })
    .onConflictDoUpdate({
      target: routeCache.key,
      set: {
        durationSec: route?.durationSec ?? null,
        distanceMeters: route?.distanceMeters ?? null,
        geometry: route?.geometry ?? null,
        found: route !== null,
        createdAt: sql`now()`,
      },
    })
  return route
}

const METERS_PER_MILE = 1609.344

/** Response shape shared by the load detail and the form estimate endpoint. */
export function shapeRoute(route: DrivingRoute | null) {
  if (!route) return null
  return {
    durationMin: Math.round(route.durationSec / 60),
    miles: Math.round((route.distanceMeters / METERS_PER_MILE) * 10) / 10,
    geometry: route.geometry,
  }
}
