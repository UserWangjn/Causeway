# Causeway API Tests

## Unit Tests

Unit tests are deterministic and do not use the network or database.

```powershell
npm run test:api
```

## Integration Tests

Integration tests require a dedicated PostgreSQL database. The test setup defaults `TEST_DATABASE_URL` to `postgresql://causeway:causeway@127.0.0.1:5432/causeway_test?schema=public`; override it when local credentials differ. `NODE_ENV` must be `test`, and the database name must be exactly `causeway_test` or `causeway-test`; the helper rejects other names to reduce the chance of destructive cleanup against a development or production database.
Integration and e2e test files run serially because they share one test database and reset it between cases. If the suite grows enough to need parallel database tests, use one isolated schema or database per worker before enabling file parallelism.

Example local setup:

```powershell
Get-Content apps/api/.env.test.example | ForEach-Object {
  if ($_ -match "^[^#][^=]+=") {
    $name, $value = $_ -split "=", 2
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}
npm run db:deploy
npm run test:api:integration
```

The integration fixture creates:

- two users for ownership checks;
- one event;
- binary, multi-outcome, closed, and not-tradable markets;
- outcomes with deterministic CLOB token IDs;
- one inference run, causal script, script market, and selections;
- one preview-ready dry-run order intent and idempotent submission.

Polymarket sync integration coverage uses mocked Gamma payloads against the real test database to verify idempotent market/outcome upserts, outcome index alignment, completed `SyncRun` records, and failed `SyncRun` records when retrieval fails.

## Contract Tests

Contract tests boot the Nest application against the same deterministic test database and pin the documented response shapes that the frontend depends on: market reads, inference/script reads, dry-run orders, portfolio reads, disabled positions sync capability, internal sync run read models, and internal monitor refresh boundaries.

```powershell
npm run test:api:contract
```

## E2E Tests

E2E tests should boot the Nest application through `test/support/e2e-app.ts` and mock external clients by default.
Current e2e coverage includes wallet auth plus the local core workflow: market reads, mock inference, script reads/selection patch, order preview, dry-run submit, idempotent submit replay/conflict handling, preview expiration, production readiness, and rate limiting.

```powershell
npm run test:api:e2e
```

## CI Coverage

`.github/workflows/ci.yml` runs two lanes:

- `quality`: install, Prisma client generation, Prisma schema validation, lint, unit tests, build, and dependency audit.
- `database-tests`: PostgreSQL service, Prisma migrations, integration tests, contract tests, and e2e tests.

The CI database URL uses `causeway_test`, matching the safety check in `test/support/prisma-test-client.ts`.

CI sets `LOG_LEVEL=log` and enables HTTP request logging by default. Local test env files can set
`LOG_LEVEL=warn` and `LOG_HTTP_REQUESTS=false` to reduce noise while keeping the same structured logger path.

## External Smoke Checks

External smoke checks are not CI tests. They require explicit environment opt-in and can call real provider endpoints:

```powershell
$env:SMOKE_POLYMARKET_ENABLED="true"
npm run smoke:api:polymarket

$env:SMOKE_AI_ENABLED="true"
npm run smoke:api:ai
```

Unit tests cover the default skipped path for all smoke commands so routine test runs never touch external providers. Do not enable `smoke:api:real-orders` until the real CLOB signing/submission Spike is approved; even with opt-in, it currently fails closed before any order path is available.
