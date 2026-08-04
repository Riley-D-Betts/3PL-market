import { createError } from 'h3'

/** Sliding-window throttle: the posting forms need a handful of estimates,
 * not a cache-filling sweep of the coordinate space. */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 30
const recentByUser = new Map<string, number[]>()

/**
 * Drive-time/distance estimate for the posting forms: geocodes both stops
 * (or takes explicit pin coordinates) and asks OSRM. Everything is cached;
 * a null estimate simply means "no suggestion".
 */
export default defineEventHandler(async (event) => {
  const { user } = await requireAuth(event, ['shipper', 'carrier_admin'])
  const query = await getValidatedQuery(event, routeEstimateSchema.parse)

  const now = Date.now()
  const recent = (recentByUser.get(user.id) ?? []).filter(t => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) {
    throw createError({ statusCode: 429, statusMessage: 'Slow down — too many route estimates' })
  }
  recent.push(now)
  recentByUser.set(user.id, recent)

  const from = query.pickupLat != null && query.pickupLng != null
    ? { lat: query.pickupLat, lng: query.pickupLng }
    : await geocodeCityState(query.pickupCity, query.pickupState)
  const to = query.deliveryLat != null && query.deliveryLng != null
    ? { lat: query.deliveryLat, lng: query.deliveryLng }
    : await geocodeCityState(query.deliveryCity, query.deliveryState)
  if (!from || !to) return { estimate: null }

  const route = shapeRoute(await getDrivingRoute(from, to))
  return { estimate: route ? { durationMin: route.durationMin, miles: route.miles } : null }
})
