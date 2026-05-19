import { formatUnknownError, isEnabled, printSummary, type SmokeSummary } from './shared';

const SMOKE_NAME = 'real-orders';
const ENABLED_ENV = 'SMOKE_REAL_ORDERS_ENABLED';
const ACK_ENV = 'SMOKE_REAL_ORDERS_ACKNOWLEDGE_RISK';
const REQUIRED_REAL_ORDER_ENV = [
  'ENABLE_REAL_ORDERS',
  'POLYMARKET_CLOB_API_KEY',
  'POLYMARKET_CLOB_API_SECRET',
  'POLYMARKET_CLOB_API_PASSPHRASE',
  'POLYMARKET_CLOB_API_ADDRESS',
] as const;

export function runRealOrdersSmoke(): SmokeSummary {
  if (!isEnabled(ENABLED_ENV)) {
    return {
      name: SMOKE_NAME,
      status: 'skipped',
      details: {
        reason: `Set ${ENABLED_ENV}=true and ${ACK_ENV}=true only after the real order Spike is approved`,
      },
    };
  }

  if (!isEnabled(ACK_ENV)) {
    throw new Error(`${ACK_ENV}=true is required before any real order smoke check can run`);
  }

  const missing = REQUIRED_REAL_ORDER_ENV.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Real order preflight is missing required configuration: ${missing.join(', ')}`);
  }
  if (process.env.ENABLE_REAL_ORDERS !== 'true') {
    throw new Error('ENABLE_REAL_ORDERS=true is required before any real order smoke check can run');
  }

  return {
    name: SMOKE_NAME,
    status: 'passed',
    details: {
      mode: 'preflight_only',
      noOrderSubmitted: true,
      signatureType: Number(process.env.POLYMARKET_CLOB_SIGNATURE_TYPE ?? 2),
    },
  };
}

function main(): void {
  printSummary(runRealOrdersSmoke());
}

if (require.main === module) {
  try {
    main();
  } catch (error: unknown) {
    console.error(JSON.stringify({ name: SMOKE_NAME, status: 'failed', error: formatUnknownError(error) }, null, 2));
    process.exitCode = 1;
  }
}
