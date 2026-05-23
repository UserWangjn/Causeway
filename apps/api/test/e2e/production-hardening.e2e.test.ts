import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REQUEST_ID_HEADER } from '../../src/common/constants/api.constants';
import { configureApp } from '../../src/configure-app';
import { PrismaService } from '../../src/database/prisma.service';
import { createE2eApp } from '../support/e2e-app';
import { configureTestEnvironment } from '../support/test-env';

type ApiResponse<T> = {
  data: T;
  requestId: string;
};

type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

type HealthResponse = {
  ok: boolean;
  service: string;
  timestamp: string;
};

type ReadinessResponse = HealthResponse & {
  checks: {
    database: string;
    rateLimit?: string;
  };
};

const RATE_LIMIT_ENV_KEYS = ['RATE_LIMIT_ENABLED', 'RATE_LIMIT_MAX', 'RATE_LIMIT_WINDOW_MS'] as const;

describe('production hardening e2e', () => {
  let app: INestApplication;
  let httpServer: SupertestApp;
  let originalEnv: Partial<Record<(typeof RATE_LIMIT_ENV_KEYS)[number], string>>;

  beforeAll(async () => {
    originalEnv = readProcessEnv(RATE_LIMIT_ENV_KEYS);
    process.env.RATE_LIMIT_ENABLED = 'true';
    process.env.RATE_LIMIT_MAX = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    app = await createE2eApp();
    httpServer = app.getHttpServer() as SupertestApp;
  });

  afterAll(async () => {
    await app?.close();
    restoreProcessEnv(originalEnv);
  });

  it('serves public liveness with the standard response envelope and request id header', async () => {
    const response = await request(httpServer).get('/api/v1/health').expect(200);
    const body = response.body as ApiResponse<HealthResponse>;

    expect(response.headers[REQUEST_ID_HEADER]).toBeTruthy();
    expect(body.requestId).toBe(response.headers[REQUEST_ID_HEADER]);
    expect(body.data).toMatchObject({
      ok: true,
      service: 'causeway-api',
    });
    expect(body.data.timestamp).toBeTruthy();
    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('serves readiness with database and rate limit store checks outside rate limiting', async () => {
    const response = await request(httpServer).get('/api/v1/health/ready').expect(200);
    const body = response.body as ApiResponse<ReadinessResponse>;

    expect(body.data).toMatchObject({
      ok: true,
      service: 'causeway-api',
      checks: {
        database: 'ok',
        rateLimit: 'ok',
      },
    });
    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('rate limits non-health routes by IP before invalid bearer tokens reach auth', async () => {
    await request(httpServer)
      .get('/api/v1/portfolio/summary')
      .set('Authorization', 'Bearer invalid-token-a')
      .expect(401);

    const response = await request(httpServer)
      .get('/api/v1/portfolio/summary')
      .set('Authorization', 'Bearer invalid-token-b')
      .expect(429);
    const body = response.body as ApiErrorResponse;

    expect(response.headers['retry-after']).toBeTruthy();
    expect(response.headers['x-ratelimit-limit']).toBe('1');
    expect(body.error).toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded',
      details: {
        limit: 1,
        windowMs: 60000,
      },
    });
    expect(body.requestId).toBe(response.headers[REQUEST_ID_HEADER]);
  });
});

describe('readiness hardening e2e', () => {
  let app: INestApplication;
  let httpServer: SupertestApp;

  beforeAll(async () => {
    app = await createReadinessFailureApp();
    httpServer = app.getHttpServer() as SupertestApp;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns READINESS_FAILED without leaking database connection details', async () => {
    const response = await request(httpServer).get('/api/v1/health/ready').expect(503);
    const body = response.body as ApiErrorResponse;

    expect(body.error).toEqual({
      code: 'READINESS_FAILED',
      message: 'Database readiness check failed',
    });
    expect(JSON.stringify(body)).not.toContain('postgres://user:secret@localhost/db');
    expect(body.requestId).toBe(response.headers[REQUEST_ID_HEADER]);
  });
});

async function createReadinessFailureApp(): Promise<INestApplication> {
  configureTestEnvironment();
  const previousCleanupEnabled = process.env.MAINTENANCE_CLEANUP_ENABLED;
  process.env.MAINTENANCE_CLEANUP_ENABLED = 'false';
  try {
    const { AppModule } = await import('../../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: () => Promise.resolve(),
        $disconnect: () => Promise.resolve(),
        $queryRaw: () => Promise.reject(new Error('postgres://user:secret@localhost/db')),
      })
      .compile();

    const app = moduleRef.createNestApplication();
    configureApp(app, app.get(ConfigService));
    await app.init();
    return app;
  } finally {
    if (previousCleanupEnabled == null) {
      delete process.env.MAINTENANCE_CLEANUP_ENABLED;
    } else {
      process.env.MAINTENANCE_CLEANUP_ENABLED = previousCleanupEnabled;
    }
  }
}

function readProcessEnv<T extends readonly string[]>(keys: T): Partial<Record<T[number], string>> {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]])) as Partial<Record<T[number], string>>;
}

function restoreProcessEnv(values: Partial<Record<string, string>>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value == null) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}
