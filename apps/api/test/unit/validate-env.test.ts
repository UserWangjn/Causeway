import { describe, expect, it } from 'vitest';
import { validateEnv } from '../../src/config/validate-env';

describe('validateEnv', () => {
  it('accepts a minimal development configuration and applies defaults', () => {
    const env = validateEnv({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
      JWT_SECRET: 'dev-secret',
    });

    expect(env.NODE_ENV).toBe('development');
    expect(env.RATE_LIMIT_ENABLED).toBe('true');
    expect(env.RATE_LIMIT_MAX).toBe(120);
    expect(env.LOG_LEVEL).toBe('log');
    expect(env.LOG_HTTP_REQUESTS).toBe('true');
    expect(env.POLYMARKET_MARKET_SYNC_ENABLED).toBe('false');
    expect(env.POLYMARKET_MARKET_SYNC_INTERVAL_MS).toBe(300_000);
    expect(env.POLYMARKET_MARKET_SYNC_LIMIT).toBe(1000);
    expect(env.POLYMARKET_MARKET_SYNC_LOCK_TTL_MS).toBe(900_000);
    expect(env.POLYMARKET_MARKET_SYNC_RUN_ON_STARTUP).toBe('false');
  });

  it('requires Redis for production rate limiting', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
        JWT_SECRET: 'x'.repeat(32),
        INTERNAL_API_TOKEN: 'internal-token',
      }),
    ).toThrow(/REDIS_URL/);
  });

  it('allows production without Redis only when rate limiting is disabled explicitly', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
      JWT_SECRET: 'x'.repeat(32),
      INTERNAL_API_TOKEN: 'internal-token',
      RATE_LIMIT_ENABLED: 'false',
    });

    expect(env.RATE_LIMIT_ENABLED).toBe('false');
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('rejects unsafe market sync scheduler settings', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
        JWT_SECRET: 'dev-secret',
        POLYMARKET_MARKET_SYNC_ENABLED: 'true',
        POLYMARKET_MARKET_SYNC_INTERVAL_MS: '1000',
      }),
    ).toThrow(/POLYMARKET_MARKET_SYNC_INTERVAL_MS/);

    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
        JWT_SECRET: 'dev-secret',
        POLYMARKET_MARKET_SYNC_LIMIT: '5000',
      }),
    ).toThrow(/POLYMARKET_MARKET_SYNC_LIMIT/);

    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
        JWT_SECRET: 'dev-secret',
        POLYMARKET_MARKET_SYNC_LOCK_TTL_MS: '1000',
      }),
    ).toThrow(/POLYMARKET_MARKET_SYNC_LOCK_TTL_MS/);
  });
});
