import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAiSmoke } from '../../scripts/smoke/ai';
import { runPolymarketSmoke } from '../../scripts/smoke/polymarket';
import { runRealOrdersSmoke } from '../../scripts/smoke/real-orders';

const SMOKE_ENV_KEYS = [
  'SMOKE_POLYMARKET_ENABLED',
  'SMOKE_AI_ENABLED',
  'SMOKE_REAL_ORDERS_ENABLED',
  'SMOKE_REAL_ORDERS_ACKNOWLEDGE_RISK',
  'ENABLE_REAL_ORDERS',
  'POLYMARKET_CLOB_API_KEY',
  'POLYMARKET_CLOB_API_SECRET',
  'POLYMARKET_CLOB_API_PASSPHRASE',
  'POLYMARKET_CLOB_API_ADDRESS',
  'POLYMARKET_CLOB_SIGNATURE_TYPE',
] as const;

describe('smoke script safety boundaries', () => {
  const originalEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of SMOKE_ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    for (const key of SMOKE_ENV_KEYS) {
      const original = originalEnv.get(key);
      if (original == null) {
        delete process.env[key];
      } else {
        process.env[key] = original;
      }
    }
    originalEnv.clear();
    vi.unstubAllGlobals();
  });

  it('skips Polymarket smoke checks by default without touching the network', async () => {
    const result = await runPolymarketSmoke();

    expect(result).toMatchObject({
      name: 'polymarket-readonly',
      status: 'skipped',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('skips AI smoke checks by default without touching the network', async () => {
    const result = await runAiSmoke();

    expect(result).toMatchObject({
      name: 'ai-provider',
      status: 'skipped',
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('skips real order smoke checks by default without enabling any order path', () => {
    const result = runRealOrdersSmoke();

    expect(result).toMatchObject({
      name: 'real-orders',
      status: 'skipped',
    });
  });

  it('requires explicit risk acknowledgement before real order smoke checks can run', () => {
    process.env.SMOKE_REAL_ORDERS_ENABLED = 'true';

    expect(() => runRealOrdersSmoke()).toThrow('SMOKE_REAL_ORDERS_ACKNOWLEDGE_RISK=true is required');
  });

  it('requires real order configuration after acknowledgement without submitting an order', () => {
    process.env.SMOKE_REAL_ORDERS_ENABLED = 'true';
    process.env.SMOKE_REAL_ORDERS_ACKNOWLEDGE_RISK = 'true';

    expect(() => runRealOrdersSmoke()).toThrow('Real order preflight is missing required configuration');
  });

  it('passes real order smoke preflight without touching the network', () => {
    process.env.SMOKE_REAL_ORDERS_ENABLED = 'true';
    process.env.SMOKE_REAL_ORDERS_ACKNOWLEDGE_RISK = 'true';
    process.env.ENABLE_REAL_ORDERS = 'true';
    process.env.POLYMARKET_CLOB_API_KEY = 'api-key';
    process.env.POLYMARKET_CLOB_API_SECRET = 'api-secret';
    process.env.POLYMARKET_CLOB_API_PASSPHRASE = 'api-passphrase';
    process.env.POLYMARKET_CLOB_API_ADDRESS = '0x1111111111111111111111111111111111111111';
    process.env.POLYMARKET_CLOB_SIGNATURE_TYPE = '2';

    expect(runRealOrdersSmoke()).toEqual({
      name: 'real-orders',
      status: 'passed',
      details: {
        mode: 'preflight_only',
        noOrderSubmitted: true,
        signatureType: 2,
      },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
