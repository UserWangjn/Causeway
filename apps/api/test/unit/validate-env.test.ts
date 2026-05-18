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
});
