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

All demo passwords are `Password123!`.

| Role | Email | What to try |
|---|---|---|
| Shipper | `shipper@demo.test` | Post a load, review bids, award, confirm delivery |
| Carrier admin | `carrier@demo.test` | Browse the board, accept/bid, manage fleet & drivers, assign loads |
| Driver | `driver1@demo.test` / `driver2@demo.test` | See assigned loads, mark picked up / delivered |
| Superadmin | `admin@3plmarket.test` | Approve "Pending Freight Co", manage users/companies |
| Pending carrier | `pending-carrier@demo.test` | See the awaiting-approval experience |

### Configuration

Copy `.env.example` to `.env` (compose has safe dev defaults built in):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `NUXT_SESSION_PASSWORD` | Secret sealing session cookies — **set your own 32+ char value in production** |
| `NUXT_SEED_DEMO_DATA` | `true` to seed demo data on boot (idempotent — skipped when data exists) |
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
- **Instant accept** is race-safe: a conditional `UPDATE … WHERE status = 'posted'` decides ties — the second of two simultaneous accepts gets a clean 409.
- **Award** runs in one transaction (`SELECT … FOR UPDATE` on load and bid): winner accepted, all other pending bids rejected, load assigned to the winning company at the bid price.
- Cancelling/unposting a load rejects its pending bids atomically.

### Roles & authorization

| Role | Can |
|---|---|
| `shipper` | CRUD own loads, post/unpost/cancel, award bids, confirm delivery |
| `carrier_admin` | Browse board, accept/bid/withdraw, manage company fleet + driver accounts, assign drivers, pre-pickup backout |
| `driver` | See own assigned loads, mark picked up / delivered |
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
pnpm test              # unit tests (state machine) — no database needed
pnpm test:integration  # bidding/award race tests — needs the compose postgres
pnpm test:all
pnpm typecheck
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
