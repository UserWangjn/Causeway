import { z } from 'zod';
import { AUTH_DURATION_PATTERN } from '../common/utils/duration.util';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().default(8000),
    API_PREFIX: z.string().default('/api/v1'),
    API_CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    JWT_EXPIRES_IN: z.string().regex(AUTH_DURATION_PATTERN).default('7d'),
    SUPPORTED_CHAIN_IDS: z.string().default('137'),
    POLYMARKET_GAMMA_BASE_URL: z.string().url().default('https://gamma-api.polymarket.com'),
    POLYMARKET_CLOB_BASE_URL: z.string().url().default('https://clob.polymarket.com'),
    POLYMARKET_DATA_BASE_URL: z.string().url().default('https://data-api.polymarket.com'),
    POLYMARKET_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    POLYMARKET_HTTP_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
    AI_BASE_URL: z.string().optional(),
    AI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),
    ENABLE_REAL_ORDERS: z.enum(['true', 'false']).default('false'),
    DRY_RUN: z.enum(['true', 'false']).default('true'),
    INTERNAL_API_TOKEN: z.string().optional(),
    REDIS_URL: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.JWT_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be at least 32 characters in production',
      });
    }

    if (value.NODE_ENV === 'production' && !value.INTERNAL_API_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['INTERNAL_API_TOKEN'],
        message: 'INTERNAL_API_TOKEN is required in production',
      });
    }
  });

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
