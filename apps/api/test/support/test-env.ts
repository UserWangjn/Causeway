const DEFAULT_TEST_DATABASE_URL = 'postgresql://causeway:causeway@127.0.0.1:5432/causeway_test?schema=public';

export function configureTestEnvironment(): void {
  process.env.NODE_ENV = 'test';
  process.env.TEST_DATABASE_URL ??= process.env.DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET ??= 'test-secret-change-me-32-characters';
  process.env.JWT_EXPIRES_IN ??= '1h';
  process.env.SUPPORTED_CHAIN_IDS ??= '137';
  process.env.INTERNAL_API_TOKEN ??= 'test-internal-token';
  process.env.API_CORS_ORIGINS ??= 'http://localhost:5173,http://127.0.0.1:5173';
  process.env.POLYMARKET_HTTP_TIMEOUT_MS ??= '1000';
  process.env.POLYMARKET_HTTP_RETRIES ??= '0';
  process.env.POLYMARKET_DATA_API_ENABLED = 'false';
  process.env.POLYMARKET_MARKET_SYNC_ENABLED = 'false';
  process.env.POLYMARKET_MARKET_SYNC_RUN_ON_STARTUP = 'false';
  process.env.LOG_LEVEL ??= 'warn';
  process.env.LOG_HTTP_REQUESTS ??= 'false';
}

configureTestEnvironment();
