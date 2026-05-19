import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateEnv } from '../../src/config/validate-env';

describe('validateEnv', () => {
  const productionSecrets = {
    JWT_SECRET: 'prod-jwt-secret-32-characters-minimum',
    INTERNAL_API_TOKEN: 'prod-internal-token-32-characters-minimum',
  };

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
    expect(env.POLYMARKET_DATA_API_ENABLED).toBe('true');
    expect(env.POLYMARKET_MARKET_SYNC_INTERVAL_MS).toBe(900_000);
    expect(env.POLYMARKET_MARKET_SYNC_LIMIT).toBe(1000);
    expect(env.POLYMARKET_MARKET_SYNC_LOCK_TTL_MS).toBe(900_000);
    expect(env.POLYMARKET_MARKET_SYNC_RUN_ON_STARTUP).toBe('false');
    expect(env.POLYMARKET_CLOB_SIGNATURE_TYPE).toBe(2);
    expect(env.AI_HTTP_TIMEOUT_MS).toBe(30_000);
    expect(env.AI_MAX_OUTPUT_TOKENS).toBe(4_000);
  });

  it('requires Redis for production rate limiting', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
        ...productionSecrets,
      }),
    ).toThrow(/REDIS_URL/);
  });

  it('allows production without Redis only when rate limiting is disabled explicitly', () => {
    const env = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
      ...productionSecrets,
      RATE_LIMIT_ENABLED: 'false',
    });

    expect(env.RATE_LIMIT_ENABLED).toBe('false');
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('rejects placeholder and low-entropy production secrets', () => {
    const base = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
      RATE_LIMIT_ENABLED: 'false',
    };

    expect(() =>
      validateEnv({
        ...base,
        JWT_SECRET: 'change-me',
        INTERNAL_API_TOKEN: productionSecrets.INTERNAL_API_TOKEN,
      }),
    ).toThrow(/JWT_SECRET/);

    expect(() =>
      validateEnv({
        ...base,
        JWT_SECRET: '<generate-64-plus-random-characters>',
        INTERNAL_API_TOKEN: productionSecrets.INTERNAL_API_TOKEN,
      }),
    ).toThrow(/JWT_SECRET/);

    expect(() =>
      validateEnv({
        ...base,
        JWT_SECRET: 'x'.repeat(32),
        INTERNAL_API_TOKEN: productionSecrets.INTERNAL_API_TOKEN,
      }),
    ).toThrow(/JWT_SECRET/);

    expect(() =>
      validateEnv({
        ...base,
        JWT_SECRET: productionSecrets.JWT_SECRET,
        INTERNAL_API_TOKEN: 'internal-token',
      }),
    ).toThrow(/INTERNAL_API_TOKEN/);

    expect(() =>
      validateEnv({
        ...base,
        JWT_SECRET: 'dev-local-jwt-secret-change-before-production',
        INTERNAL_API_TOKEN: productionSecrets.INTERNAL_API_TOKEN,
      }),
    ).toThrow(/JWT_SECRET/);

    expect(() =>
      validateEnv({
        ...base,
        JWT_SECRET: productionSecrets.JWT_SECRET,
        INTERNAL_API_TOKEN: 'dev-local-internal-token-change-before-production',
      }),
    ).toThrow(/INTERNAL_API_TOKEN/);
  });

  it('rejects .env.example development secrets in production', () => {
    const exampleEnv = parseEnvExample(readFileSync('.env.example', 'utf8'));

    expect(() =>
      validateEnv({
        ...exampleEnv,
        NODE_ENV: 'production',
        RATE_LIMIT_ENABLED: 'false',
      }),
    ).toThrow(/JWT_SECRET|INTERNAL_API_TOKEN/);
  });

  it('rejects .env.production.example secret placeholders in production', () => {
    const productionTemplateEnv = parseEnvExample(readFileSync('.env.production.example', 'utf8'));
    delete productionTemplateEnv.REDIS_URL;

    expect(() =>
      validateEnv({
        ...productionTemplateEnv,
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
        RATE_LIMIT_ENABLED: 'false',
      }),
    ).toThrow(/JWT_SECRET|INTERNAL_API_TOKEN/);
  });

  it('rejects malformed supported chain ids', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
        JWT_SECRET: 'dev-secret',
        SUPPORTED_CHAIN_IDS: '137,abc',
      }),
    ).toThrow(/SUPPORTED_CHAIN_IDS/);

    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
        JWT_SECRET: 'dev-secret',
        SUPPORTED_CHAIN_IDS: '0',
      }),
    ).toThrow(/SUPPORTED_CHAIN_IDS/);

    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
        JWT_SECRET: 'dev-secret',
        SUPPORTED_CHAIN_IDS: '137,',
      }),
    ).toThrow(/SUPPORTED_CHAIN_IDS/);

    expect(() =>
      validateEnv({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
        JWT_SECRET: 'dev-secret',
        SUPPORTED_CHAIN_IDS: '137,,80002',
      }),
    ).toThrow(/SUPPORTED_CHAIN_IDS/);
  });

  it('allows empty AI provider settings but rejects unsafe AI base URLs', () => {
    const base = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
      JWT_SECRET: 'dev-secret',
      AI_API_KEY: 'provider-secret',
      AI_MODEL: 'gpt-test',
    };

    const env = validateEnv({
      ...base,
      AI_BASE_URL: '',
      AI_API_KEY: '',
      AI_MODEL: '',
      AI_THINKING_MODE: 'disabled',
    });

    expect(env.AI_BASE_URL).toBe('');
    expect(env.AI_THINKING_MODE).toBe('disabled');

    expect(() =>
      validateEnv({
        ...base,
        AI_BASE_URL: 'https://provider.test/v1',
        AI_THINKING_MODE: 'auto',
      }),
    ).toThrow(/AI_THINKING_MODE/);

    expect(() =>
      validateEnv({
        ...base,
        AI_BASE_URL: 'not-a-url',
      }),
    ).toThrow(/AI_BASE_URL|Invalid URL/);

    expect(() =>
      validateEnv({
        ...base,
        AI_BASE_URL: 'https://provider.test/v1?api_key=secret',
      }),
    ).toThrow(/AI_BASE_URL/);

    expect(() =>
      validateEnv({
        ...base,
        AI_BASE_URL: 'https://user:pass@provider.test/v1',
      }),
    ).toThrow(/AI_BASE_URL/);

    expect(() =>
      validateEnv({
        ...base,
        AI_BASE_URL: 'http://provider.test/v1',
      }),
    ).toThrow(/AI_BASE_URL/);
  });

  it('allows local HTTP AI providers outside production but requires HTTPS in production', () => {
    const base = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
      JWT_SECRET: 'dev-secret',
      AI_BASE_URL: 'http://127.0.0.1:11434/v1',
      AI_API_KEY: 'provider-secret',
      AI_MODEL: 'gpt-test',
    };

    expect(validateEnv(base).AI_BASE_URL).toBe('http://127.0.0.1:11434/v1');

    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: productionSecrets.JWT_SECRET,
        INTERNAL_API_TOKEN: productionSecrets.INTERNAL_API_TOKEN,
        RATE_LIMIT_ENABLED: 'false',
      }),
    ).toThrow(/AI_BASE_URL/);

    expect(
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: productionSecrets.JWT_SECRET,
        INTERNAL_API_TOKEN: productionSecrets.INTERNAL_API_TOKEN,
        RATE_LIMIT_ENABLED: 'false',
        AI_BASE_URL: 'https://provider.test/v1',
      }).AI_BASE_URL,
    ).toBe('https://provider.test/v1');
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

  it('requires CLOB API credentials only when real orders are enabled in production', () => {
    const base = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/causeway',
      RATE_LIMIT_ENABLED: 'false',
      ...productionSecrets,
      ENABLE_REAL_ORDERS: 'true',
    };

    expect(() => validateEnv(base)).toThrow(/POLYMARKET_CLOB_API_KEY/);

    const env = validateEnv({
      ...base,
      POLYMARKET_CLOB_API_KEY: 'api-key',
      POLYMARKET_CLOB_API_SECRET: 'api-secret',
      POLYMARKET_CLOB_API_PASSPHRASE: 'api-passphrase',
      POLYMARKET_CLOB_API_ADDRESS: '0x1111111111111111111111111111111111111111',
      POLYMARKET_CLOB_SIGNATURE_TYPE: '2',
    });

    expect(env.ENABLE_REAL_ORDERS).toBe('true');
    expect(env.POLYMARKET_CLOB_SIGNATURE_TYPE).toBe(2);
  });
});

function parseEnvExample(content: string): Record<string, string> {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}
