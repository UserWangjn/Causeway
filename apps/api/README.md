# Causeway API

This is the production backend foundation for Causeway. The legacy Python demo under `backend/` is intentionally left untouched and should not be extended for the production backend.

## Stack

- NestJS + TypeScript
- PostgreSQL + Prisma
- JWT wallet-session auth with one-time signed nonces
- Polymarket Gamma sync, local market reads, dry-run order lifecycle, and capability-gated real order flow
- Worker-ready module layout for inference, order status refresh, and monitoring jobs

## Directory Map

```text
apps/api
|-- prisma/                  Prisma schema and future migrations
|-- src/
|   |-- common/              request id, response envelope, filters, guards
|   |-- config/              environment validation and configuration
|   |-- database/            Prisma module/service
|   |-- integrations/        external AI and Polymarket clients
|   |-- jobs/                queue and scheduled job boundaries
|   `-- modules/             product modules from docs/causeway
`-- test/                    contract-focused unit tests
```

## Implementation Order

1. Database migration and deployment environment.
2. Wallet auth and protected API calls.
3. Polymarket market sync and normalized Event / Market / Outcome storage.
4. Markets and market-network read APIs.
5. Dry-run order preview / submit with idempotency.
6. Inference worker, script generation, and cache.
7. Portfolio and monitor read models.
8. Real CLOB signing/submission once the official flow is verified.

## Commands

Run from the repository root:

```powershell
npm install
npm run db:generate
npm run dev:api
npm run build:api
npm run lint:api
npm run test:api
npm run quality:api
```

Copy `apps/api/.env.example` to `apps/api/.env` before running the API locally.
The local example disables rate limiting so a fresh machine does not need Redis. Production should keep rate limiting enabled and set `REDIS_URL`; production env validation rejects enabled rate limiting without Redis.
Use `apps/api/.env.production.example` as the production deployment checklist, but replace every secret placeholder with a strong random value before starting the API with `NODE_ENV=production`.

Integration tests require a dedicated PostgreSQL database. See `apps/api/test/README.md`.

Run the full backend release gate when a change touches database behavior, HTTP contracts, auth, orders, portfolio, monitoring, or production configuration:

```powershell
$env:TEST_DATABASE_URL="postgresql://causeway:causeway@127.0.0.1:5432/causeway_test?schema=public"
$env:DATABASE_URL=$env:TEST_DATABASE_URL
npm run quality:api:full
```

Production deployment and operations are documented in `docs/causeway/causeway-backend-operations.md`.

External smoke checks are explicit opt-in commands and are not part of the default test suite:

```powershell
$env:SMOKE_POLYMARKET_ENABLED="true"
npm run smoke:api:polymarket

$env:SMOKE_AI_ENABLED="true"
$env:AI_BASE_URL="https://provider.example.com/v1"
$env:AI_API_KEY="<provider-key>"
$env:AI_MODEL="<model>"
npm run smoke:api:ai
```

`npm run smoke:api:real-orders` is intentionally safety-gated and will not submit real orders until the real CLOB Spike is approved and implemented.

The Polymarket market sync scheduler is disabled by default. Enable it explicitly with
`POLYMARKET_MARKET_SYNC_ENABLED=true`; it runs incremental market syncs using
`POLYMARKET_MARKET_SYNC_INTERVAL_MS`, `POLYMARKET_MARKET_SYNC_LIMIT`,
`POLYMARKET_MARKET_SYNC_LOCK_TTL_MS`, and optional `POLYMARKET_MARKET_SYNC_RUN_ON_STARTUP=true`.
Multiple API instances coordinate through the `SchedulerLock` table so only one instance runs the market sync at a time.
