# 3PL Market

An online marketplace that matches **construction-materials shippers** with **third-party logistics (3PL) trucking companies**.

Shippers post loads with an asking price. Carriers either **accept instantly** at that price or **counter-bid**; the shipper awards the load. The carrier's dispatcher assigns a driver (and truck), the driver marks the load **picked up** and **delivered** from their own account, and the shipper confirms completion. A platform **superadmin** approves carrier companies and manages users.

Built with **Nuxt 4** (single full-stack deployable), **PostgreSQL**, **Drizzle ORM**, **Nuxt UI**, and **nuxt-auth-utils** — fully Docker-hostable.

## Quick start (Docker)

```bash
docker compose up --build
```

Then open <http://localhost:3000>. On first boot the app runs its database migrations and (with `NUXT_SEED_DEMO_DATA=true`, the compose default) seeds demo data.

### Demo accounts

With the compose defaults, **demo mode** is on: the login page lists every account — just click one to explore that role. The passwords below only matter when demo mode is off; they are all `Password123!`.

| Role | Email | What to try |
|---|---|---|
| Shipper | `shipper@demo.test` | Post a load, review bids (with detention terms), award, block carriers, confirm delivery |
| Carrier admin | `carrier@demo.test` | Browse the board, accept/bid with detention terms, manage fleet & drivers, assign loads |
| Second carrier | `carrier2@demo.test` | Competing bids — compare terms side by side on the lumber load |
| Blocked carrier | `blocked-carrier@demo.test` | Blocked by the demo shipper — their loads are invisible to it |
| Driver | `driver1@demo.test` / `driver2@demo.test` | Arrive → load → depart flow; driver2 is mid-detention at a delivery |
| Superadmin | `admin@3plmarket.test` | Approve "Pending Freight Co", manage users/companies |
| Pending carrier | `pending-carrier@demo.test` | See the awaiting-approval experience |

### Configuration

Copy `.env.example` to `.env` (compose has safe dev defaults built in):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `NUXT_SESSION_PASSWORD` | Secret sealing session cookies — **set your own 32+ char value in production** |
| `NUXT_SEED_DEMO_DATA` | `true` to seed demo data on boot (idempotent — skipped when data exists) |
| `NUXT_PUBLIC_DEMO_MODE` | `true` turns the login page into a one-click account picker (no passwords). Compose defaults it on for instant demos — **never enable on a real deployment** |
| `POSTGRES_PASSWORD` | Compose-only: password for the bundled Postgres |
| `NUXT_MIGRATIONS_DIR` | Migrations folder override (preset in the Docker image) |

Building behind a TLS-intercepting corporate proxy? Drop the proxy CA at `.build-ca.crt` next to the Dockerfile before `docker compose build` — it is picked up automatically and ignored otherwise.

## How it works

### Marketplace flow

```
shipper posts load (asking price)
        │
        ├── carrier accepts instantly at asking price ──┐
        └── carriers counter-bid → shipper awards one ──┤
                                                        ▼
                        carrier admin assigns driver + vehicle
                                                        ▼
                driver marks picked up → driver marks delivered
                                                        ▼
                        shipper confirms → load completed
```

Load state machine: `draft → posted → awarded → picked_up → delivered → completed`, with `cancelled` reachable pre-pickup (shipper anytime before pickup, assigned carrier pre-pickup backout) and `posted → draft` ("unpost"). Every transition is recorded in an append-only `load_events` history shown as a timeline in the UI.

### Bidding rules

- One **live bid per company per load** (enforced by a partial unique index); re-bidding replaces your bid.
- Every bid (and instant accept) carries the carrier's **detention terms**: free wait time + hourly rate. The shipper compares terms alongside prices; awarding copies the agreed terms onto the load.
- **Instant accept** is race-safe: a conditional `UPDATE … WHERE status = 'posted'` decides ties — the second of two simultaneous accepts gets a clean 409.
- **Award** runs in one transaction (`SELECT … FOR UPDATE` on load and bid): winner accepted, all other pending bids rejected, load assigned to the winning company at the bid price.
- Cancelling/unposting a load rejects its pending bids atomically.

### Arrival logs & detention fees

The driver's flow is **arrive → load → depart** at each stop: "Arrived at pickup" starts the wait clock (a `load_events` entry both parties see on the timeline), and marking the load picked up/delivered closes it. Waiting beyond the bid's free window accrues detention at the agreed hourly rate, prorated per minute; the fee is **frozen in the same transaction as the departure** and shown as line items (line haul + pickup/delivery detention = total due) to both shipper and carrier. Mid-wait, both dashboards show a live "accruing" estimate. Pickup/delivery cannot be marked without the matching arrival log.

### Dispatch calendar, day board, reports & maps

- **Calendar** (`/carrier/calendar`): month grid of the carrier's won loads placed on their pickup windows, status-colored, with "needs driver" warnings; clicking a day lists its pickups with times, drivers and links for scheduling the day.
- **Day board** (Day toggle on the calendar): a per-driver timeline of the selected day — one lane per active driver plus an "Unassigned" lane, load blocks positioned on an hour axis by pickup window (overlaps stack), a now-line on today, each block linking to dispatch.
- **Reports** (`/carrier/reports`): date-range report grouped by driver and by vehicle — loads, completions, weight hauled, revenue (line haul + detention, delivered/confirmed only) — with summary tiles and CSV export.
- **Next-leg planner** (dispatch view): open board loads ranked by distance (km) from where the current run ends, with capacity and material-fit hints for the selected vehicle — advisory badges, never a hard filter.

### Fleet ops

- **Load numbers**: every load gets a short reference (`L-1042`) shown to shippers, carriers, drivers and admins across lists, details and the day board.
- **External loads**: carriers can enter freight booked outside the marketplace ("Add external load") — free-text customer, an *optional* agreed price (internal work needs no rate), optional immediate dispatch. It gets a load number and flows through the calendar, day board, driver arrive/pickup/deliver flow and reports exactly like a won load, but never appears on the board; the carrier admin confirms completion. This lets a 3PL run its whole operation here before the shipper side fills in.
- **Insurance & maintenance**: vehicles track policy number, insurance expiry, next service due and odometer (mi) with expiring/overdue badges on the fleet page, plus a per-vehicle maintenance log (date, work, cost, odometer).
- **Units**: all measures are imperial — weights in lbs (displayed in short tons), distances and odometers in miles.
- **Maps**: every load detail page shows a Leaflet/OpenStreetMap route map with pickup and delivery pins; the carrier dispatch view also pins the assigned driver's **home base** (set per driver in the Drivers page) to help pick who's closest.
- Coordinates come from best-effort **Nominatim geocoding** at load/driver save time, cached city-level in the database (the demo seed prefills real Idaho coordinates, so maps work offline). Missing coordinates degrade gracefully — the map simply doesn't render.

### Posting a load, the jobsite way

- **Location name & job name**: the pickup spot ("Pit 4 — Locust Grove yard") and the destination project ("Costco site — Meridian") get names alongside their street addresses; the job name headlines lists and detail pages.
- **Notes / instructions**: a free-form field for gates, tarps, scale tickets and site rules, shown to carriers on the board and front-and-center for the driver.
- **Google pins**: drag a Google Maps pin (or paste its share link, a `geo:` URI, or raw `lat, lng`) into either address field — the exact coordinates are captured, win over city-level geocoding, and drive the route map.
- **Trucks requested**: a load is one truckload; asking for N trucks posts N sibling loads (badged "Truck 2/5") that carriers accept or bid on individually — same for carrier-entered external work, where the picked driver takes truck 1 and the rest land in the day board's Unassigned lane.
- **First / last load time**: the pickup window is phrased the way dirt jobs run — first truck loads at, last truck loads by.
- **Travel time allowance**: an optional paid-travel-time figure both parties see with the rate.

### Blacklist, contacts & invoicing

- A shipper can **block a carrier company** (from any bid row, managed in Settings): blocked carriers don't see that shipper's loads on the board, can't bid or accept (server-enforced inside the same transactions that decide races), and their pending bids are rejected on block.
- Loads carry optional **pickup/delivery contacts** (name + phone) — visible to the assigned carrier and driver only after award, never to board browsers.
- Shippers set an **invoicing email** (Settings or registration); the winning carrier sees "send invoices to …" on the load (falls back to the account email). The platform does not send emails itself yet.

### Roles & authorization

| Role | Can |
|---|---|
| `shipper` | CRUD own loads, post/unpost/cancel, award bids, block carriers, set invoicing email, confirm delivery |
| `carrier_admin` | Browse board, accept/bid with detention terms, manage company fleet + driver accounts, assign drivers, pre-pickup backout |
| `driver` | See own assigned loads, log arrivals, mark picked up / delivered |
| `superadmin` | Approve/suspend carrier companies, activate/deactivate users, view everything |

Carrier companies register as `pending` and must be approved by the superadmin before they can bid or accept (they can set up fleet and drivers while waiting). Sessions are sealed cookies (`nuxt-auth-utils`); the server re-reads the user row on every request, so deactivating a user or suspending a company takes effect immediately.

## Development

```bash
corepack enable
pnpm install
docker compose up -d postgres   # just the database
cp .env.example .env
pnpm dev                        # migrates + seeds on boot
```

### Tests

```bash
pnpm test              # unit tests (state machine, detention math) — no database needed
pnpm test:integration  # bidding/award races, blacklist, detention freeze — needs the compose postgres
pnpm test:all
pnpm typecheck
pnpm e2e               # full-journey smoke against a running instance (dev or compose)
```

### Database workflow

Schema lives in `server/database/schema.ts`. After changing it:

```bash
pnpm db:generate   # writes SQL migration to server/database/migrations/
```

Migrations run automatically on app boot (dev and Docker) via `server/plugins/01.migrations.ts`.

## Project structure

```
app/                    # Nuxt app (pages, layouts, components, middleware)
  pages/shipper/        # shipper: my loads, post load, load detail (bids/award)
  pages/carrier/        # carrier admin: board, won loads, bids, fleet, drivers
  pages/driver/         # driver: assigned loads, pickup/deliver actions
  pages/admin/          # superadmin: companies, users, loads
server/
  api/                  # Nitro API routes (auth, loads, board, bids, fleet, admin)
  database/             # Drizzle schema, client, migrations, demo seed
  utils/                # authz helpers, zod schemas, state machine, transactional load actions
shared/                 # types + formatting utils shared by app & server
tests/                  # vitest unit + integration suites
```

## Known limitations

- User deactivation is a single flag: a carrier admin can re-activate a driver that the platform superadmin deactivated. Distinguishing platform-level bans from company-level deactivation needs a separate field (planned alongside proper account moderation).
- The demo compose file ships working demo credentials and a default session secret for one-command evaluation — the app logs a security warning on boot; change both before exposing an instance.

## Roadmap: vehicle GPS tracking

The schema is ready for live tracking without migrations to existing tables:

- `load_events` already carries nullable `lat`/`lng` — driver pickup/delivery events can attach a position as soon as the driver app sends one.
- A `vehicle_positions (vehicle_id, lat, lng, heading, speed, recorded_at)` append-only table can be added alongside the existing `vehicles` table, with a WebSocket/SSE feed for live maps.
