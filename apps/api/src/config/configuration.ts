export const configuration = () => ({
  api: {
    host: process.env.API_HOST ?? '0.0.0.0',
    port: Number(process.env.API_PORT ?? 8000),
    prefix: process.env.API_PREFIX ?? '/api/v1',
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
  },
  polymarket: {
    gammaBaseUrl: process.env.POLYMARKET_GAMMA_BASE_URL ?? 'https://gamma-api.polymarket.com',
    clobBaseUrl: process.env.POLYMARKET_CLOB_BASE_URL ?? 'https://clob.polymarket.com',
    dataBaseUrl: process.env.POLYMARKET_DATA_BASE_URL ?? 'https://data-api.polymarket.com',
    httpTimeoutMs: Number(process.env.POLYMARKET_HTTP_TIMEOUT_MS ?? 10_000),
    httpRetries: Number(process.env.POLYMARKET_HTTP_RETRIES ?? 2),
  },
  ai: {
    baseUrl: process.env.AI_BASE_URL,
    apiKey: process.env.AI_API_KEY,
    model: process.env.AI_MODEL,
  },
  orders: {
    enableRealOrders: process.env.ENABLE_REAL_ORDERS === 'true',
    dryRun: process.env.DRY_RUN !== 'false',
  },
  internal: {
    apiToken: process.env.INTERNAL_API_TOKEN,
  },
});
