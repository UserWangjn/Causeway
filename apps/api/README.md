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

## Frontend Local Integration

Prepare a local API with deterministic demo data:

```powershell
Copy-Item apps/api/.env.example apps/api/.env -Force
npm run db:deploy
npm run db:seed:demo
npm run dev:api
```

The API base URL is `http://127.0.0.1:8000/api/v1`.

Demo data for the primary frontend flow:

- Root market slug: `demo-fed-rate-cut-2026`
- Root market id: `demo_market_rate_cut_2026`
- Root outcome id: `demo_outcome_rate_cut_yes`
- Mock inference model: `mock-causeway-v1`

Recommended local flow:

1. Read markets with `GET /markets?active=true`.
2. Resolve the root market with `GET /markets/by-slug/demo-fed-rate-cut-2026`.
3. Sign in through `POST /auth/nonce` and `POST /auth/verify`.
4. Create a mock inference run with `POST /inference-runs`.
5. Read the generated script with `GET /scripts/:scriptId`.
6. Patch selections with `PATCH /scripts/:scriptId/outcome-selections/:selectionId`.
7. Run `POST /orders/preview`, `POST /orders/prepare-signature`, and `POST /orders/submit` with `executionMode="dry_run"`.
8. Read local order state with `GET /portfolio/orders` and `GET /portfolio/trades`.

For local wallet testing, the e2e suite uses the standard Anvil private key
`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`, whose address is
`0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266`.

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

The AI inference path supports OpenAI-compatible `POST /chat/completions` providers when `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` are configured. `AI_BASE_URL` must be a plain base URL without credentials, query parameters, or fragments; production requires HTTPS, while development/test may use HTTP only for localhost or loopback providers. Non-mock inference requests must use the configured `AI_MODEL`; otherwise the API returns `503 CAPABILITY_UNAVAILABLE`. `AI_HTTP_TIMEOUT_MS` and `AI_MAX_OUTPUT_TOKENS` control provider request bounds.

For providers that expose an OpenAI-compatible thinking toggle, set `AI_THINKING_MODE=disabled` or `AI_THINKING_MODE=enabled`. DeepSeek V4 should use `AI_THINKING_MODE=disabled` for Causeway structured JSON inference so the provider returns final `message.content` reliably.

Portfolio position sync uses the public Polymarket Data API when `POLYMARKET_DATA_API_ENABLED=true`. Set `POLYMARKET_DATA_API_ENABLED=false` to keep portfolio reads local-only and make position sync return `503 CAPABILITY_UNAVAILABLE`; upstream Data API errors only expose the redacted endpoint path in API responses.

Real CLOB submission is safety-gated. Keep `ENABLE_REAL_ORDERS=false` for normal frontend integration. To enable `executionMode="real"`, configure `POLYMARKET_CLOB_API_KEY`, `POLYMARKET_CLOB_API_SECRET`, `POLYMARKET_CLOB_API_PASSPHRASE`, `POLYMARKET_CLOB_API_ADDRESS`, and `POLYMARKET_CLOB_SIGNATURE_TYPE=2`; frontend `prepare-signature` requests must include the user's Gnosis Safe / proxy `funderAddress`. `npm run smoke:api:real-orders` performs preflight validation only and does not submit an order.

The Polymarket market sync scheduler is disabled by default. Enable it explicitly with
`POLYMARKET_MARKET_SYNC_ENABLED=true`. `POLYMARKET_MARKET_SYNC_MODE=incremental`
uses `/markets` with `POLYMARKET_MARKET_SYNC_LIMIT`; `POLYMARKET_MARKET_SYNC_MODE=full`
uses `/events` discovery and stores all active/open markets returned under active/open events.
Full sync clears stale flags on seen rows and soft-stales active/open rows not seen in the completed
discovery so public market APIs and order previews exclude them. Do not run full discovery every
15 minutes; use a multi-hour interval such as 21600000 ms (6 hours), and use order-book refreshes
for trading-time freshness. Multiple API instances coordinate through the `SchedulerLock` table so
only one instance runs the market sync at a time; expired running `SyncRun` rows are recovered on
startup and before each scheduled run.
