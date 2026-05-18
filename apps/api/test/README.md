# Causeway API Tests

## Unit Tests

Unit tests are deterministic and do not use the network or database.

```powershell
npm run test:api
```

## Integration Tests

Integration tests require a dedicated PostgreSQL database. `NODE_ENV` must be `test`, and the database name must be exactly `causeway_test` or `causeway-test`; the helper rejects other names to reduce the chance of destructive cleanup against a development or production database.

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

## E2E Tests

E2E tests should boot the Nest application through `test/support/e2e-app.ts` and mock external clients by default.

```powershell
npm run test:api:e2e
```
