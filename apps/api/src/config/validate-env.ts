import { z } from 'zod';
import { AUTH_DURATION_PATTERN } from '../common/utils/duration.util';

const MIN_PRODUCTION_SECRET_LENGTH = 32;
const PLACEHOLDER_SECRET_VALUES = new Set([
  'change-me',
  'changeme',
  'replace-me',
  'replace-me-in-production',
  'dev-secret',
  'development-secret',
  'test-secret',
  'jwt-secret',
  'internal-token',
  'secret',
  'password',
  '<generate-64-plus-random-characters>',
  'dev-local-jwt-secret-change-before-production',
  'dev-local-internal-token-change-before-production',
]);
const PLACEHOLDER_SECRET_FRAGMENTS = [
  'before-production',
  'change-before-production',
  'change-me',
  'changeme',
  'dev-local',
  'development-only',
  'generate-64-plus-random-characters',
  'local-development',
  'placeholder',
  'replace-me',
  'replace-with',
];
const aiBaseUrlSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim() : value),
  z
    .union([
      z.literal(''),
      z.string().url().refine(hasNoUnsafeUrlParts, {
        message: 'AI_BASE_URL must not include credentials, query parameters, or fragments',
      }).refine(hasSupportedAiBaseUrlProtocol, {
        message: 'AI_BASE_URL must use https, or http only for local loopback development',
      }),
    ])
    .optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().default(8000),
    API_PREFIX: z.string().default('/api/v1'),
    API_TRUST_PROXY: z.enum(['true', 'false']).default('false'),
    API_CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    JWT_EXPIRES_IN: z.string().regex(AUTH_DURATION_PATTERN).default('7d'),
    SUPPORTED_CHAIN_IDS: z.string().default('137').refine(isValidSupportedChainIds, {
      message: 'SUPPORTED_CHAIN_IDS must be a comma-separated list of positive integer chain ids',
    }),
    POLYMARKET_GAMMA_BASE_URL: z.string().url().default('https://gamma-api.polymarket.com'),
    POLYMARKET_CLOB_BASE_URL: z.string().url().default('https://clob.polymarket.com'),
    POLYMARKET_CLOB_API_KEY: z.string().optional(),
    POLYMARKET_CLOB_API_SECRET: z.string().optional(),
    POLYMARKET_CLOB_API_PASSPHRASE: z.string().optional(),
    POLYMARKET_CLOB_API_ADDRESS: z.string().optional().refine((value) => value == null || isEthereumAddress(value), {
      message: 'POLYMARKET_CLOB_API_ADDRESS must be an Ethereum address',
    }),
    POLYMARKET_CLOB_SIGNATURE_TYPE: z.coerce.number().int().min(0).max(3).default(2),
    POLYMARKET_CLOB_FUNDER_ADDRESS: z.string().optional().refine((value) => value == null || isEthereumAddress(value), {
      message: 'POLYMARKET_CLOB_FUNDER_ADDRESS must be an Ethereum address',
    }),
    POLYMARKET_DATA_BASE_URL: z.string().url().default('https://data-api.polymarket.com'),
    POLYMARKET_DATA_API_ENABLED: z.enum(['true', 'false']).default('true'),
    POLYMARKET_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    POLYMARKET_HTTP_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    POLYMARKET_MARKET_SYNC_ENABLED: z.enum(['true', 'false']).default('false'),
    POLYMARKET_MARKET_SYNC_INTERVAL_MS: z.coerce.number().int().min(60_000).default(900_000),
    POLYMARKET_MARKET_SYNC_LIMIT: z.coerce.number().int().min(1).max(1000).default(1000),
    POLYMARKET_MARKET_SYNC_LOCK_TTL_MS: z.coerce.number().int().min(60_000).default(900_000),
    POLYMARKET_MARKET_SYNC_RUN_ON_STARTUP: z.enum(['true', 'false']).default('false'),
    AI_BASE_URL: aiBaseUrlSchema,
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
    AI_THINKING_MODE: z.union([z.literal(''), z.enum(['enabled', 'disabled'])]).optional(),
    AI_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().max(16_000).default(4_000),
    ENABLE_REAL_ORDERS: z.enum(['true', 'false']).default('false'),
    DRY_RUN: z.enum(['true', 'false']).default('true'),
    INTERNAL_API_TOKEN: z.string().optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'log', 'debug', 'verbose', 'silent']).default('log'),
    LOG_HTTP_REQUESTS: z.enum(['true', 'false']).default('true'),
    REDIS_URL: z.string().url().optional(),
    RATE_LIMIT_ENABLED: z.enum(['true', 'false']).default('true'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
    RATE_LIMIT_INTERNAL_MAX: z.coerce.number().int().positive().default(300),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') {
      return;
    }

    addProductionSecretIssues('JWT_SECRET', value.JWT_SECRET, ctx);

    if (!value.INTERNAL_API_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['INTERNAL_API_TOKEN'],
        message: 'INTERNAL_API_TOKEN is required in production',
      });
    } else {
      addProductionSecretIssues('INTERNAL_API_TOKEN', value.INTERNAL_API_TOKEN, ctx);
    }

    if (value.RATE_LIMIT_ENABLED !== 'false' && !value.REDIS_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'REDIS_URL is required for production rate limiting',
      });
    }

    if (value.AI_BASE_URL && !isHttpsUrl(value.AI_BASE_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_BASE_URL'],
        message: 'AI_BASE_URL must use https in production',
      });
    }

    if (value.ENABLE_REAL_ORDERS === 'true') {
      for (const key of [
        'POLYMARKET_CLOB_API_KEY',
        'POLYMARKET_CLOB_API_SECRET',
        'POLYMARKET_CLOB_API_PASSPHRASE',
        'POLYMARKET_CLOB_API_ADDRESS',
      ] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} is required when ENABLE_REAL_ORDERS=true`,
          });
        }
      }
    }
  });

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}

function addProductionSecretIssues(
  path: 'JWT_SECRET' | 'INTERNAL_API_TOKEN',
  value: string,
  ctx: z.RefinementCtx,
): void {
  if (value.length < MIN_PRODUCTION_SECRET_LENGTH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: `${path} must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
    });
    return;
  }

  if (isPlaceholderSecret(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: `${path} must not use a placeholder value in production`,
    });
    return;
  }

  if (isLowEntropySecret(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [path],
      message: `${path} must not use a low-entropy repeated value in production`,
    });
  }
}

function isPlaceholderSecret(value: string): boolean {
  const normalized = normalizeSecret(value);
  return (
    isTemplatePlaceholder(value) ||
    PLACEHOLDER_SECRET_VALUES.has(normalized) ||
    PLACEHOLDER_SECRET_FRAGMENTS.some((fragment) => normalized.includes(fragment))
  );
}

function isTemplatePlaceholder(value: string): boolean {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith('<') && trimmed.endsWith('>')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  );
}

function isLowEntropySecret(value: string): boolean {
  const trimmed = value.trim();
  return new Set(trimmed).size < 8 || /^(.)(\1)+$/.test(trimmed);
}

function normalizeSecret(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function isValidSupportedChainIds(value: string): boolean {
  const parts = value.split(',').map((part) => part.trim());
  return parts.length > 0 && parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const chainId = Number(part);
    return Number.isSafeInteger(chainId) && chainId > 0;
  });
}

function hasNoUnsafeUrlParts(value: string): boolean {
  const url = new URL(value);
  return !url.username && !url.password && !url.search && !url.hash;
}

function hasSupportedAiBaseUrlProtocol(value: string): boolean {
  const url = new URL(value);
  return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHostname(url.hostname));
}

function isHttpsUrl(value: string): boolean {
  return new URL(value).protocol === 'https:';
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

function isEthereumAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}
