import { formatUnknownError, isEnabled, printSummary } from './shared';

const SMOKE_NAME = 'real-orders';
const ENABLED_ENV = 'SMOKE_REAL_ORDERS_ENABLED';
const ACK_ENV = 'SMOKE_REAL_ORDERS_ACKNOWLEDGE_RISK';

function main(): void {
  if (!isEnabled(ENABLED_ENV)) {
    printSummary({
      name: SMOKE_NAME,
      status: 'skipped',
      details: {
        reason: `Set ${ENABLED_ENV}=true and ${ACK_ENV}=true only after the real order Spike is approved`,
      },
    });
    return;
  }

  if (!isEnabled(ACK_ENV)) {
    throw new Error(`${ACK_ENV}=true is required before any real order smoke check can run`);
  }

  throw new Error(
    'Real order smoke checks are intentionally unavailable until the CLOB signing/submission Spike is approved and implemented',
  );
}

try {
  main();
} catch (error: unknown) {
  console.error(JSON.stringify({ name: SMOKE_NAME, status: 'failed', error: formatUnknownError(error) }, null, 2));
  process.exitCode = 1;
}
