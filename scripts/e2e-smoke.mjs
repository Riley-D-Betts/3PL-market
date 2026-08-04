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
    const isForm = body instanceof FormData
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body && !isForm ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
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

const CLEAN_PRETRIP = { lights: true, tires: true, brakes: true, steering: true, fluids: true, mirrors: true, horn: true, coupling: true, safety: true }
const TICKET_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

function ticketForm() {
  const form = new FormData()
  form.append('file', new Blob([TICKET_PNG], { type: 'image/png' }), 'e2e-ticket.png')
  return form
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
    pickupLocationName: 'E2E Gate 3',
    pickupAddress: 'E2E Quarry Gate', pickupCity: 'Boise', pickupState: 'ID',
    jobName: 'E2E Tower Job',
    deliveryAddress: 'E2E Jobsite', deliveryCity: 'Meridian', deliveryState: 'ID',
    // Explicit pin (a dropped Google Maps pin) for the pickup end.
    pickupLat: 43.6101, pickupLng: -116.2101,
    materialType: 'gravel', weightLbs: 30000,
    notes: 'E2E: tarp required, scale tickets to the office',
    travelTimeAllowanceMin: 30,
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
check('dropped pin wins over geocoding (pickup)', created.load.pickupLat === 43.6101 && created.load.pickupLng === -116.2101)
check('load geocoded from the seeded cache (Meridian delivery)', Math.abs((created.load.deliveryLat ?? 0) - 43.6121) < 0.01)
check('posting extras round-trip', created.load.pickupLocationName === 'E2E Gate 3'
  && created.load.jobName === 'E2E Tower Job'
  && created.load.notes.startsWith('E2E: tarp')
  && created.load.travelTimeAllowanceMin === 30)

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

// ── 5. Carrier2 creates a driver + truck and assigns them ───────────────────
console.log('\n5. driver assignment')
const driverEmail = `e2e-driver-${Date.now()}@demo.test`
const { data: driverRes } = await carrier2('/api/fleet/drivers', {
  method: 'POST',
  expect: 201,
  body: { name: 'E2E Driver', email: driverEmail, password: PASSWORD },
})
const { data: truckRes } = await carrier2('/api/fleet/vehicles', {
  method: 'POST',
  expect: 201,
  body: { type: 'dump_truck', plate: `E2E-${Date.now()}`, capacityLbs: 44000, odometerMi: 120000 },
})
const truckId = truckRes.vehicle.id
await carrier2(`/api/loads/${loadId}/assign`, { method: 'POST', expect: 200, body: { driverId: driverRes.driver.id } })
const driver = await login(driverEmail)

// ── 6. Shift-gated, arrival-gated pickup/delivery with paperwork ────────────
console.log('\n6. shift + arrival flow')
const { status: offDuty } = await driver(`/api/driver/loads/${loadId}/arrive-pickup`, { method: 'POST' })
check('load actions are refused off shift with 409', offDuty === 409)

const { data: shiftInfo } = await driver('/api/driver/shift', { expect: 200 })
check('driver sees company trucks for sign-on', shiftInfo.shift === null && shiftInfo.fleet.some(v => v.id === truckId))

const { status: badPretrip } = await driver('/api/driver/shift/start', {
  method: 'POST',
  body: { vehicleId: truckId, startOdometerMi: 120000, checklist: { ...CLEAN_PRETRIP, brakes: false } },
})
check('failed pre-trip item without a defects note is refused', badPretrip === 400)

await driver('/api/driver/shift/start', {
  method: 'POST',
  expect: 201,
  body: { vehicleId: truckId, startOdometerMi: 120000, checklist: CLEAN_PRETRIP },
})
const { status: dupShift } = await driver('/api/driver/shift/start', {
  method: 'POST',
  body: { vehicleId: truckId, startOdometerMi: 120000, checklist: CLEAN_PRETRIP },
})
check('a second active shift is refused with 409', dupShift === 409)

const { status: premature } = await driver(`/api/driver/loads/${loadId}/pickup`, { method: 'POST' })
check('pickup before arrival is refused with 409', premature === 409)

await driver(`/api/driver/loads/${loadId}/arrive-pickup`, { method: 'POST', expect: 200 })
const { status: doubleArrive } = await driver(`/api/driver/loads/${loadId}/arrive-pickup`, { method: 'POST' })
check('double arrival is refused with 409', doubleArrive === 409)

const { data: pickedUp } = await driver(`/api/driver/loads/${loadId}/pickup`, { method: 'POST', expect: 200 })
check('pickup freezes detention (0 — no meaningful wait)', pickedUp.load.pickupDetentionCents === 0)

// The ticket gate is checked before the arrival gate — assert it first,
// then upload so the arrival 409 below is genuinely the arrival guard.
const { status: noTicket } = await driver(`/api/driver/loads/${loadId}/deliver`, { method: 'POST', body: { deliveredTons: 9.9 } })
check('deliver without a scale-ticket photo is refused with 409', noTicket === 409)

const { data: uploaded } = await driver(`/api/driver/loads/${loadId}/ticket`, { method: 'POST', body: ticketForm(), expect: 201 })
check('ticket photo uploads', uploaded.attachment.contentType === 'image/png')
const { status: imgStatus } = await carrier2(`/api/loads/${loadId}/attachments/${uploaded.attachment.id}`)
check('assigned carrier can fetch the ticket image', imgStatus === 200)
const granitePeek = await login('carrier@demo.test')
const { status: foreignImg } = await granitePeek(`/api/loads/${loadId}/attachments/${uploaded.attachment.id}`)
check('non-assigned carrier cannot fetch the ticket image', foreignImg === 403)

const { status: prematureDeliver } = await driver(`/api/driver/loads/${loadId}/deliver`, { method: 'POST', body: { deliveredTons: 9.9 } })
check('deliver before delivery arrival is refused with 409', prematureDeliver === 409)

await driver(`/api/driver/loads/${loadId}/arrive-delivery`, { method: 'POST', expect: 200 })

const { status: noTons } = await driver(`/api/driver/loads/${loadId}/deliver`, { method: 'POST', body: {} })
check('deliver without tonnage is refused', noTons === 400)

const { data: delivered } = await driver(`/api/driver/loads/${loadId}/deliver`, { method: 'POST', expect: 200, body: { deliveredTons: 9.9 } })
check('delivery freezes detention (0)', delivered.load.deliveryDetentionCents === 0)
check('delivery records the hauled tonnage', delivered.load.deliveredTons === 9.9)

const { status: badEnd } = await driver('/api/driver/shift/end', { method: 'POST', body: { endOdometerMi: 119000, fuelGallons: 30 } })
check('ending mileage below beginning mileage is refused', badEnd === 422)
await driver('/api/driver/shift/end', { method: 'POST', expect: 200, body: { endOdometerMi: 120180, fuelGallons: 32.5 } })
const { data: fleetAfter } = await carrier2('/api/fleet/vehicles', { expect: 200 })
check('ending mileage advances the truck odometer', fleetAfter.vehicles.find(v => v.id === truckId)?.odometerMi === 120180)

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
// Marketplace loads only: re-runs leave behind 8d's manual loads whose
// throwaway driver has no home base, which would poison this check.
const withDriver = graniteWon.loads.find(l => l.assignedDriverId && l.source !== 'manual')
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

console.log('\n8c. load numbers')
check('created loads carry a load number', typeof created.load.loadNumber === 'number' && created.load.loadNumber > 0)

console.log('\n8d. manual (off-platform) load lifecycle')
{
  const manualDriverEmail = `e2e-ext-driver-${Date.now()}@demo.test`
  const { data: extDriver } = await granite('/api/fleet/drivers', {
    method: 'POST',
    expect: 201,
    body: { name: 'E2E Ext Driver', email: manualDriverEmail, password: PASSWORD },
  })
  const { data: manual } = await granite('/api/carrier/loads', {
    method: 'POST',
    expect: 201,
    body: {
      externalShipperName: 'E2E Offline Customer',
      pickupAddress: 'X', pickupCity: 'Boise', pickupState: 'ID',
      deliveryAddress: 'Y', deliveryCity: 'Meridian', deliveryState: 'ID',
      materialType: 'sand', weightLbs: 20000,
      pickupWindowStart: new Date(Date.now() + 3600_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + 7200_000).toISOString(),
      // No priceCents: internal work needs no rate.
      trucksRequested: 2,
      driverId: extDriver.driver.id,
    },
  })
  check('manual load starts awarded with source=manual', manual.load.status === 'awarded' && manual.load.source === 'manual')
  check('manual load geocoded from cache', typeof manual.load.pickupLat === 'number')
  check('price-less internal load has no charges', manual.load.askingPriceCents === null && manual.load.finalPriceCents === null)
  check('two trucks create two sibling loads', manual.loads.length === 2
    && manual.loads[0].truckSeq === 1 && manual.loads[1].truckSeq === 2
    && manual.loads[0].trucksTotal === 2
    && manual.loads[0].truckGroupId === manual.loads[1].truckGroupId)
  check('driver rides truck 1 only', manual.loads[0].assignedDriverId === extDriver.driver.id && manual.loads[1].assignedDriverId === null)

  const { data: c2board } = await carrier2('/api/board', { expect: 200 })
  check('manual load never appears on the board', !c2board.loads.some(l => l.id === manual.load.id))

  const extDriverClient = await login(manualDriverEmail)
  const { data: extShiftInfo } = await extDriverClient('/api/driver/shift', { expect: 200 })
  const extTruck = extShiftInfo.fleet[0]
  await extDriverClient('/api/driver/shift/start', {
    method: 'POST',
    expect: 201,
    body: { vehicleId: extTruck.id, startOdometerMi: extTruck.odometerMi ?? 0, checklist: CLEAN_PRETRIP },
  })
  await extDriverClient(`/api/driver/loads/${manual.load.id}/arrive-pickup`, { method: 'POST', expect: 200 })
  const { data: manualPicked } = await extDriverClient(`/api/driver/loads/${manual.load.id}/pickup`, { method: 'POST', expect: 200 })
  check('pickup adopts the shift truck when dispatch left it open', manualPicked.load.assignedVehicleId === extTruck.id)
  await extDriverClient(`/api/driver/loads/${manual.load.id}/arrive-delivery`, { method: 'POST', expect: 200 })
  await extDriverClient(`/api/driver/loads/${manual.load.id}/ticket`, { method: 'POST', body: ticketForm(), expect: 201 })
  await extDriverClient(`/api/driver/loads/${manual.load.id}/deliver`, { method: 'POST', expect: 200, body: { deliveredTons: 10 } })
  const { data: confirmed } = await granite(`/api/loads/${manual.load.id}/confirm`, { method: 'POST', expect: 200 })
  check('carrier admin confirms the manual load to completed', confirmed.load.status === 'completed')
  // Sign the throwaway driver off so re-runs don't accumulate open shifts.
  await extDriverClient('/api/driver/shift/end', { method: 'POST', expect: 200, body: { endOdometerMi: (extTruck.odometerMi ?? 0) + 40, fuelGallons: 6 } })
}

console.log('\n8e. next-leg planner')
{
  const { data: won } = await granite('/api/carrier/loads', { expect: 200 })
  const ref = won.loads.find(l => l.status === 'awarded' && l.source !== 'manual') ?? won.loads[0]
  const { data: plan } = await granite(`/api/carrier/next-loads?fromLoadId=${ref.id}`, { expect: 200 })
  check('planner returns suggestions with distances', plan.suggestions.length >= 1 && typeof plan.suggestions[0].distanceMiles === 'number')
  const dists = plan.suggestions.map(s => s.distanceMiles ?? Number.POSITIVE_INFINITY)
  check('suggestions sorted nearest first', dists.every((d, i) => i === 0 || d >= dists[i - 1]))
}

console.log('\n8f. multi-truck marketplace request')
{
  const { data: fleetPost } = await shipper('/api/loads', {
    method: 'POST',
    expect: 201,
    body: {
      pickupAddress: 'E2E Pit', pickupCity: 'Nampa', pickupState: 'ID',
      jobName: 'E2E Three-Truck Job',
      deliveryAddress: 'E2E Pad', deliveryCity: 'Boise', deliveryState: 'ID',
      materialType: 'aggregate', weightLbs: 44000,
      pickupWindowStart: new Date(Date.now() + 86400_000).toISOString(),
      pickupWindowEnd: new Date(Date.now() + 2 * 86400_000).toISOString(),
      askingPriceCents: 60000,
      trucksRequested: 3,
      post: true,
    },
  })
  check('three trucks post three sibling loads', fleetPost.loads.length === 3
    && fleetPost.loads.map(l => l.truckSeq).join(',') === '1,2,3'
    && fleetPost.loads.every(l => l.trucksTotal === 3 && l.truckGroupId === fleetPost.loads[0].truckGroupId))
  const { data: boardNow } = await carrier2('/api/board', { expect: 200 })
  check('every sibling is individually on the board', fleetPost.loads.every(l => boardNow.loads.some(b => b.id === l.id)))
  for (const l of fleetPost.loads) {
    await shipper(`/api/loads/${l.id}/cancel`, { method: 'POST', expect: 200 })
  }
}

console.log('\n8g. directions & invoicing')
{
  // Drive-time estimate — network-dependent (public OSRM), so tolerate absence.
  const { data: est } = await shipper('/api/route-estimate?pickupCity=Boise&pickupState=ID&deliveryCity=Nampa&deliveryState=ID', { expect: 200 })
  if (est.estimate) {
    check('route estimate returns drive time and road miles', est.estimate.durationMin > 5 && est.estimate.miles > 10)
  }
  else {
    console.log('  --   OSRM unreachable — drive-time estimate skipped')
  }

  // The section-7 load is completed with carrier2 assigned.
  const { status: foreignInvoice } = await granite(`/api/loads/${loadId}/invoice`, { method: 'POST' })
  check('non-assigned carrier cannot mark invoiced', foreignInvoice === 404)

  const { data: graniteLoads } = await granite('/api/carrier/loads', { expect: 200 })
  const unfinished = graniteLoads.loads.find(l => l.status === 'awarded')
  if (unfinished) {
    const { status: early } = await granite(`/api/loads/${unfinished.id}/invoice`, { method: 'POST' })
    check('unfinished load cannot be invoiced (409)', early === 409)
  }

  const { data: marked } = await carrier2(`/api/loads/${loadId}/invoice`, { method: 'POST', expect: 200 })
  check('assigned carrier marks the completed load invoiced', marked.load.invoicedAt !== null)
  const { status: dup } = await carrier2(`/api/loads/${loadId}/invoice`, { method: 'POST' })
  check('double-marking is refused with 409', dup === 409)

  const { data: shipperView } = await shipper(`/api/loads/${loadId}`, { expect: 200 })
  check('shipper sees the invoiced marking and timeline event',
    shipperView.load.invoicedAt !== null && shipperView.events.some(e => e.eventType === 'invoiced'))

  await carrier2(`/api/loads/${loadId}/invoice`, { method: 'DELETE', expect: 200 })
  const { data: unmarked } = await carrier2(`/api/loads/${loadId}`, { expect: 200 })
  check('invoiced marking can be undone', unmarked.load.invoicedAt === null)
  await carrier2(`/api/loads/${loadId}/invoice`, { method: 'POST', expect: 200 })
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
