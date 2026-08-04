/**
 * End-to-end smoke test against a running instance (default http://localhost:3000).
 *
 *   docker compose up -d   # or pnpm dev
 *   pnpm e2e
 *
 * Drives the full marketplace journey including blacklist enforcement,
 * detention terms, contacts visibility and the arrival/departure log flow.
 * Exits non-zero on the first failed assertion.
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const PASSWORD = 'Password123!'

let failures = 0
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${label}`)
  }
  else {
    failures++
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Minimal cookie-jar fetch client per logged-in user. */
function client() {
  let cookie = ''
  return async function request(path, { method = 'GET', body, expect } = {}) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    let data = null
    try {
      data = await res.json()
    }
    catch { /* non-JSON */ }
    if (expect !== undefined && res.status !== expect) {
      throw new Error(`${method} ${path} → ${res.status} (expected ${expect}): ${JSON.stringify(data)?.slice(0, 300)}`)
    }
    return { status: res.status, data }
  }
}

async function login(email) {
  const c = client()
  await c('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD }, expect: 200 })
  return c
}

console.log(`E2E smoke against ${BASE}`)

const shipper = await login('shipper@demo.test')
const carrier2 = await login('carrier2@demo.test')
const blockedCarrier = await login('blocked-carrier@demo.test')

// ── 1. Shipper posts a load with on-site contacts ───────────────────────────
console.log('\n1. shipper posts a load with contacts')
const { data: created } = await shipper('/api/loads', {
  method: 'POST',
  expect: 201,
  body: {
    pickupAddress: 'E2E Quarry Gate', pickupCity: 'Boise', pickupState: 'ID',
    deliveryAddress: 'E2E Jobsite', deliveryCity: 'Meridian', deliveryState: 'ID',
    materialType: 'gravel', weightKg: 14000,
    pickupWindowStart: new Date(Date.now() + 86400_000).toISOString(),
    pickupWindowEnd: new Date(Date.now() + 2 * 86400_000).toISOString(),
    askingPriceCents: 70000,
    pickupContactName: 'E2E Gate — Sam', pickupContactPhone: '+1 208 555 0301',
    deliveryContactName: 'E2E Super — Lee', deliveryContactPhone: '+1 208 555 0302',
    post: true,
  },
})
const loadId = created.load.id
check('load created and posted', created.load.status === 'posted')
check('load geocoded from the seeded cache (Boise pickup)', Math.abs((created.load.pickupLat ?? 0) - 43.615) < 0.01)
check('load geocoded from the seeded cache (Meridian delivery)', Math.abs((created.load.deliveryLat ?? 0) - 43.6121) < 0.01)

// ── 2. Board visibility ─────────────────────────────────────────────────────
console.log('\n2. board visibility')
const { data: board2 } = await carrier2('/api/board', { expect: 200 })
const boardRow = board2.loads.find(l => l.id === loadId)
check('carrier2 sees the load on the board', Boolean(boardRow))
check('board hides on-site contacts', boardRow && boardRow.pickupContactName === undefined && boardRow.deliveryContactPhone === undefined)

const { data: boardBlocked } = await blockedCarrier('/api/board', { expect: 200 })
check('blocked carrier does not see the load', !boardBlocked.loads.some(l => l.id === loadId))

const { status: blockedBid } = await blockedCarrier(`/api/loads/${loadId}/bids`, {
  method: 'POST',
  body: { amountCents: 50000 },
})
check('blocked carrier bid is refused with 403', blockedBid === 403)
const { status: blockedAccept } = await blockedCarrier(`/api/loads/${loadId}/accept`, { method: 'POST', body: {} })
check('blocked carrier instant accept is refused with 403', blockedAccept === 403)

const { data: carrierDetail } = await carrier2(`/api/loads/${loadId}`, { expect: 200 })
check('posted-load detail hides contacts from bidders', carrierDetail.load.pickupContactName === null)
check('posted-load detail hides the invoice email from bidders', carrierDetail.invoiceEmail === null)

// ── 3. Carrier2 bids with detention terms; shipper awards ───────────────────
console.log('\n3. bid with terms → award')
await carrier2(`/api/loads/${loadId}/bids`, {
  method: 'POST',
  expect: 201,
  body: { amountCents: 65000, detentionFreeMinutes: 45, detentionRatePerHourCents: 9000, note: 'E2E terms bid' },
})
const { data: shipperBids } = await shipper(`/api/loads/${loadId}/bids`, { expect: 200 })
const bid = shipperBids.bids.find(b => b.status === 'pending')
check('shipper sees the bid with its terms', bid?.detentionFreeMinutes === 45 && bid?.detentionRatePerHourCents === 9000)

const { data: awarded } = await shipper(`/api/loads/${loadId}/award`, { method: 'POST', expect: 200, body: { bidId: bid.id } })
check('award copies the winning terms onto the load', awarded.load.detentionFreeMinutes === 45 && awarded.load.detentionRatePerHourCents === 9000)
check('award assigns the company at the bid price', awarded.load.finalPriceCents === 65000)

// ── 4. Assigned carrier sees contacts + invoice email ───────────────────────
console.log('\n4. assigned-carrier visibility')
const { data: wonDetail } = await carrier2(`/api/loads/${loadId}`, { expect: 200 })
check('assigned carrier sees contacts', wonDetail.load.pickupContactName === 'E2E Gate — Sam')
check('assigned carrier sees the invoice email', wonDetail.invoiceEmail === 'ap@boisebuilders.test')

// ── 5. Carrier2 creates a driver and assigns them ───────────────────────────
console.log('\n5. driver assignment')
const driverEmail = `e2e-driver-${Date.now()}@demo.test`
const { data: driverRes } = await carrier2('/api/fleet/drivers', {
  method: 'POST',
  expect: 201,
  body: { name: 'E2E Driver', email: driverEmail, password: PASSWORD },
})
await carrier2(`/api/loads/${loadId}/assign`, { method: 'POST', expect: 200, body: { driverId: driverRes.driver.id } })
const driver = await login(driverEmail)

// ── 6. Arrival-gated pickup/delivery with logs ──────────────────────────────
console.log('\n6. arrival flow')
const { status: premature } = await driver(`/api/driver/loads/${loadId}/pickup`, { method: 'POST' })
check('pickup before arrival is refused with 409', premature === 409)

await driver(`/api/driver/loads/${loadId}/arrive-pickup`, { method: 'POST', expect: 200 })
const { status: doubleArrive } = await driver(`/api/driver/loads/${loadId}/arrive-pickup`, { method: 'POST' })
check('double arrival is refused with 409', doubleArrive === 409)

const { data: pickedUp } = await driver(`/api/driver/loads/${loadId}/pickup`, { method: 'POST', expect: 200 })
check('pickup freezes detention (0 — no meaningful wait)', pickedUp.load.pickupDetentionCents === 0)

const { status: prematureDeliver } = await driver(`/api/driver/loads/${loadId}/deliver`, { method: 'POST' })
check('deliver before delivery arrival is refused with 409', prematureDeliver === 409)

await driver(`/api/driver/loads/${loadId}/arrive-delivery`, { method: 'POST', expect: 200 })
const { data: delivered } = await driver(`/api/driver/loads/${loadId}/deliver`, { method: 'POST', expect: 200 })
check('delivery freezes detention (0)', delivered.load.deliveryDetentionCents === 0)

// ── 7. Shipper confirms; timeline shows the full journey ────────────────────
console.log('\n7. confirm + timeline')
await shipper(`/api/loads/${loadId}/confirm`, { method: 'POST', expect: 200 })
const { data: final } = await shipper(`/api/loads/${loadId}`, { expect: 200 })
check('load is completed', final.load.status === 'completed')
const eventTypes = final.events.map(e => e.eventType)
for (const expected of ['created', 'posted', 'bid_placed', 'awarded', 'driver_assigned', 'arrived_pickup', 'picked_up', 'arrived_delivery', 'delivered', 'completed']) {
  check(`timeline contains ${expected}`, eventTypes.includes(expected))
}

// ── 8. Block flow round-trip ────────────────────────────────────────────────
console.log('\n8. maps & home base data')
const granite = await login('carrier@demo.test')
const { data: fleetDrivers } = await granite('/api/fleet/drivers', { expect: 200 })
const dale = fleetDrivers.drivers.find(d => d.email === 'driver1@demo.test')
check('seeded driver has a geocoded home base', dale?.homeBaseCity === 'Boise' && typeof dale?.homeBaseLat === 'number')
const { data: graniteWon } = await granite('/api/carrier/loads', { expect: 200 })
const withDriver = graniteWon.loads.find(l => l.assignedDriverId)
if (withDriver) {
  const { data: dispatch } = await granite(`/api/loads/${withDriver.id}`, { expect: 200 })
  check('dispatch view exposes the assigned driver home base', typeof dispatch.assignedDriver?.homeBaseLat === 'number')
}

console.log('\n8b. fleet reports')
{
  const { data: report } = await granite('/api/carrier/reports', { expect: 200 })
  check('report has totals and driver rows', typeof report.totals.totalLoads === 'number' && report.byDriver.length >= 1)
  const dale2 = report.byDriver.find(r => r.driverName === 'Dale Rocker')
  check('seeded delivered load contributes revenue incl. detention', (dale2?.revenueCents ?? 0) >= 36000 + 8750)
  check('vehicle rows aggregate', report.byVehicle.length >= 1)
}

console.log('\n9. demo mode (skipped when the flag is off)')
{
  const probe = client()
  const { status: listStatus, data: accounts } = await probe('/api/auth/demo-accounts')
  if (listStatus === 404) {
    console.log('  --   demo mode off — endpoints correctly 404')
  }
  else {
    check('demo-accounts lists the seeded shipper', accounts.accounts.some(a => a.email === 'shipper@demo.test'))
    const target = accounts.accounts.find(a => a.email === 'shipper@demo.test')
    await probe('/api/auth/demo-login', { method: 'POST', body: { userId: target.id }, expect: 200 })
    const { data: me } = await probe('/api/auth/me', { expect: 200 })
    check('demo-login yields a working session', me.user.email === 'shipper@demo.test')
  }
}

console.log('\n10. block / unblock round-trip')
const { data: companies } = await shipper('/api/shipper/blocks', { expect: 200 })
const alreadyBlocked = companies.blocks.length
await shipper('/api/shipper/blocks', { method: 'POST', expect: 201, body: { companyId: wonDetail.load.assignedCompanyId, reason: 'E2E test block' } })
const { data: afterBlock } = await shipper('/api/shipper/blocks', { expect: 200 })
check('block created', afterBlock.blocks.length === alreadyBlocked + 1)
await shipper(`/api/shipper/blocks/${wonDetail.load.assignedCompanyId}`, { method: 'DELETE', expect: 200 })
const { data: afterUnblock } = await shipper('/api/shipper/blocks', { expect: 200 })
check('block removed', afterUnblock.blocks.length === alreadyBlocked)

console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
