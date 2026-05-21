export const configuration = () => ({
  api: {
    host: process.env.API_HOST ?? '0.0.0.0',
    port: Number(process.env.API_PORT ?? 8000),
    prefix: process.env.API_PREFIX ?? '/api/v1',
    trustProxy: process.env.API_TRUST_PROXY === 'true',
    corsOrigins: (process.env.API_CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    supportedChainIds: (process.env.SUPPORTED_CHAIN_IDS ?? '137')
      .split(',')
      .map((chainId) => Number(chainId.trim()))
      .filter((chainId) => Number.isInteger(chainId) && chainId > 0),
    siweUri: process.env.AUTH_SIWE_URI,
    siweStatement: process.env.AUTH_SIWE_STATEMENT ?? 'Sign in to Causeway.',
    polygonRpcUrl: process.env.AUTH_POLYGON_RPC_URL,
  },
  polymarket: {
    gammaBaseUrl: process.env.POLYMARKET_GAMMA_BASE_URL ?? 'https://gamma-api.polymarket.com',
    clobBaseUrl: process.env.POLYMARKET_CLOB_BASE_URL ?? 'https://clob.polymarket.com',
    relayerBaseUrl: process.env.POLYMARKET_RELAYER_BASE_URL ?? 'https://relayer-v2.polymarket.com',
    clobApi: {
      key: process.env.POLYMARKET_CLOB_API_KEY,
      secret: process.env.POLYMARKET_CLOB_API_SECRET,
      passphrase: process.env.POLYMARKET_CLOB_API_PASSPHRASE,
      address: process.env.POLYMARKET_CLOB_API_ADDRESS,
      signatureType: Number(process.env.POLYMARKET_CLOB_SIGNATURE_TYPE ?? 2),
      funderAddress: process.env.POLYMARKET_CLOB_FUNDER_ADDRESS,
    },
    builder: {
      apiKey: process.env.POLYMARKET_BUILDER_API_KEY,
      secret: process.env.POLYMARKET_BUILDER_API_SECRET,
      passphrase: process.env.POLYMARKET_BUILDER_API_PASSPHRASE,
      code: process.env.POLYMARKET_BUILDER_CODE,
    },
    dataBaseUrl: process.env.POLYMARKET_DATA_BASE_URL ?? 'https://data-api.polymarket.com',
    dataApi: {
      enabled: process.env.POLYMARKET_DATA_API_ENABLED !== 'false',
    },
    httpTimeoutMs: Number(process.env.POLYMARKET_HTTP_TIMEOUT_MS ?? 10_000),
    httpRetries: Number(process.env.POLYMARKET_HTTP_RETRIES ?? 2),
    marketSync: {
      enabled: process.env.POLYMARKET_MARKET_SYNC_ENABLED === 'true',
      mode: process.env.POLYMARKET_MARKET_SYNC_MODE ?? 'incremental',
      intervalMs: Number(process.env.POLYMARKET_MARKET_SYNC_INTERVAL_MS ?? 900_000),
      limit: Number(process.env.POLYMARKET_MARKET_SYNC_LIMIT ?? 1000),
      lockTtlMs: Number(process.env.POLYMARKET_MARKET_SYNC_LOCK_TTL_MS ?? 900_000),
      runOnStartup: process.env.POLYMARKET_MARKET_SYNC_RUN_ON_STARTUP === 'true',
      hotEnabled: process.env.POLYMARKET_HOT_MARKET_SYNC_ENABLED !== 'false',
      hotIntervalMs: Number(process.env.POLYMARKET_HOT_MARKET_SYNC_INTERVAL_MS ?? 300_000),
      hotLimit: Number(process.env.POLYMARKET_HOT_MARKET_SYNC_LIMIT ?? 250),
      hotEventLimit: Number(process.env.POLYMARKET_HOT_MARKET_SYNC_EVENT_LIMIT ?? 50),
    },
  },
  ai: {
    baseUrl: process.env.AI_BASE_URL,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
    allowedModels: process.env.AI_ALLOWED_MODELS,
    thinkingMode: process.env.AI_THINKING_MODE,
    httpTimeoutMs: Number(process.env.AI_HTTP_TIMEOUT_MS ?? 30_000),
    maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 4_000),
  },
  orders: {
    enableRealOrders: process.env.ENABLE_REAL_ORDERS === 'true',
    dryRun: process.env.DRY_RUN !== 'false',
  },
  security: {
    credentialEncryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY,
  },
  internal: {
    apiToken: process.env.INTERNAL_API_TOKEN,
  },
  logging: {
    level: process.env.LOG_LEVEL ?? 'log',
    httpRequests: process.env.LOG_HTTP_REQUESTS !== 'false',
  },
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 120),
    authMax: Number(process.env.RATE_LIMIT_AUTH_MAX ?? 20),
    internalMax: Number(process.env.RATE_LIMIT_INTERNAL_MAX ?? 300),
    redisUrl: process.env.REDIS_URL,
  },
});
