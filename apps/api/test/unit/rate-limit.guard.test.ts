import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { IS_INTERNAL_ROUTE } from '../../src/common/decorators/internal-route.decorator';
import { RATE_LIMIT_POLICY, SKIP_RATE_LIMIT } from '../../src/common/decorators/rate-limit.decorator';
import { ApiException } from '../../src/common/errors/api.exception';
import { InMemoryRateLimitStore } from '../../src/common/rate-limit/in-memory-rate-limit.store';
import { RateLimitGuard } from '../../src/common/rate-limit/rate-limit.guard';
import { createRateLimitStore } from '../../src/common/rate-limit/rate-limit.module';

type TestRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  method?: string;
  path?: string;
  route?: {
    path?: string;
  };
  user?: {
    id: string;
  };
};

type TestResponse = {
  headers: Record<string, string>;
  setHeader: (name: string, value: string) => void;
};

type GuardOptions = {
  enabled?: boolean;
  max?: number;
  authMax?: number;
  internalMax?: number;
  windowMs?: number;
  metadata?: Record<string, unknown>;
};

describe('RateLimitGuard', () => {
  it('allows requests inside the configured limit and writes rate limit headers', async () => {
    const guard = createGuard({ max: 2, windowMs: 60_000 });
    const { context, response } = createContext({
      ip: '203.0.113.10',
      method: 'GET',
      path: '/markets',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(response.headers['X-RateLimit-Limit']).toBe('2');
    expect(response.headers['X-RateLimit-Remaining']).toBe('1');
    expect(response.headers['X-RateLimit-Reset']).toBeDefined();
  });

  it('returns RATE_LIMITED after the configured route bucket is exhausted', async () => {
    const guard = createGuard({ max: 1, windowMs: 60_000 });
    const first = createContext({
      ip: '203.0.113.10',
      method: 'GET',
      path: '/markets',
    });
    const second = createContext({
      ip: '203.0.113.10',
      method: 'GET',
      path: '/markets',
    });

    await expect(guard.canActivate(first.context)).resolves.toBe(true);

    let error: unknown;
    try {
      await guard.canActivate(second.context);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((error as ApiException).getResponse()).toMatchObject({
      code: 'RATE_LIMITED',
      details: {
        limit: 1,
        windowMs: 60_000,
      },
    });
    expect(second.response.headers['Retry-After']).toBe('60');
  });

  it('uses the auth-specific limit for auth routes', async () => {
    const guard = createGuard({ max: 100, authMax: 1, windowMs: 60_000 });
    const request = {
      ip: '203.0.113.20',
      method: 'POST',
      path: '/api/v1/auth/nonce',
    };

    await expect(guard.canActivate(createContext(request).context)).resolves.toBe(true);
    await expect(guard.canActivate(createContext(request).context)).rejects.toBeInstanceOf(ApiException);
  });

  it('does not trust forwarded IP headers directly', async () => {
    const guard = createGuard({ max: 1, windowMs: 60_000 });

    await expect(
      guard.canActivate(
        createContext({
          ip: '203.0.113.60',
          headers: {
            'x-forwarded-for': '198.51.100.1',
          },
          method: 'GET',
          path: '/markets',
        }).context,
      ),
    ).resolves.toBe(true);

    await expect(
      guard.canActivate(
        createContext({
          ip: '203.0.113.60',
          headers: {
            'x-forwarded-for': '198.51.100.2',
          },
          method: 'GET',
          path: '/markets',
        }).context,
      ),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('does not use unverified bearer tokens as a rate limit identity', async () => {
    const guard = createGuard({ max: 1, windowMs: 60_000 });

    await expect(
      guard.canActivate(
        createContext({
          ip: '203.0.113.70',
          headers: {
            authorization: 'Bearer invalid-token-a',
          },
          method: 'GET',
          path: '/portfolio/summary',
        }).context,
      ),
    ).resolves.toBe(true);

    await expect(
      guard.canActivate(
        createContext({
          ip: '203.0.113.70',
          headers: {
            authorization: 'Bearer invalid-token-b',
          },
          method: 'GET',
          path: '/portfolio/summary',
        }).context,
      ),
    ).rejects.toBeInstanceOf(ApiException);
  });

  it('uses the internal route limit when internal metadata is present', async () => {
    const guard = createGuard({
      max: 100,
      internalMax: 1,
      windowMs: 60_000,
      metadata: {
        [IS_INTERNAL_ROUTE]: true,
      },
    });
    const request = {
      headers: {
        'x-internal-api-token': 'token',
      },
      method: 'POST',
      path: '/internal/sync/polymarket',
    };

    await expect(guard.canActivate(createContext(request).context)).resolves.toBe(true);
    await expect(guard.canActivate(createContext(request).context)).rejects.toBeInstanceOf(ApiException);
  });

  it('honors custom rate limit metadata', async () => {
    const guard = createGuard({
      max: 100,
      windowMs: 60_000,
      metadata: {
        [RATE_LIMIT_POLICY]: {
          limit: 1,
          windowMs: 30_000,
          keyPrefix: 'custom',
        },
      },
    });
    const request = {
      ip: '203.0.113.30',
      method: 'GET',
      path: '/custom',
    };

    await expect(guard.canActivate(createContext(request).context)).resolves.toBe(true);

    let error: unknown;
    try {
      await guard.canActivate(createContext(request).context);
    } catch (caught) {
      error = caught;
    }

    expect((error as ApiException).getResponse()).toMatchObject({
      details: {
        limit: 1,
        windowMs: 30_000,
      },
    });
  });

  it('skips limiting when skip metadata is present', async () => {
    const guard = createGuard({
      max: 1,
      windowMs: 60_000,
      metadata: {
        [SKIP_RATE_LIMIT]: true,
      },
    });
    const request = {
      ip: '203.0.113.40',
      method: 'GET',
      path: '/health',
    };

    await expect(guard.canActivate(createContext(request).context)).resolves.toBe(true);
    await expect(guard.canActivate(createContext(request).context)).resolves.toBe(true);
  });

  it('does not limit requests when rate limiting is disabled', async () => {
    const guard = createGuard({ enabled: false, max: 1, windowMs: 60_000 });
    const request = {
      ip: '203.0.113.50',
      method: 'GET',
      path: '/markets',
    };

    await expect(guard.canActivate(createContext(request).context)).resolves.toBe(true);
    await expect(guard.canActivate(createContext(request).context)).resolves.toBe(true);
  });

  it('does not instantiate a Redis-backed store when rate limiting is disabled', () => {
    const config = {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        if (key === 'rateLimit.enabled') return false;
        if (key === 'rateLimit.redisUrl') return 'redis://127.0.0.1:6379';
        return defaultValue;
      }),
    } as unknown as ConfigService;

    expect(createRateLimitStore(config)).toBeInstanceOf(InMemoryRateLimitStore);
  });
});

function createGuard(options: GuardOptions = {}): RateLimitGuard {
  const values: Record<string, unknown> = {
    'rateLimit.enabled': options.enabled ?? true,
    'rateLimit.windowMs': options.windowMs ?? 60_000,
    'rateLimit.max': options.max ?? 120,
    'rateLimit.authMax': options.authMax ?? 20,
    'rateLimit.internalMax': options.internalMax ?? 300,
  };
  const config = {
    get: vi.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
  } as unknown as ConfigService;

  return new RateLimitGuard(createReflector(options.metadata), config, new InMemoryRateLimitStore());
}

function createReflector(metadata: Record<string, unknown> = {}): Reflector {
  return {
    getAllAndOverride: vi.fn((key: string) => metadata[key]),
  } as unknown as Reflector;
}

function createContext(request: Partial<TestRequest>): { context: ExecutionContext; response: TestResponse } {
  const response: TestResponse = {
    headers: {},
    setHeader(name: string, value: string): void {
      this.headers[name] = value;
    },
  };
  const normalizedRequest: TestRequest = {
    headers: {},
    ...request,
  };
  const handler = () => undefined;
  class TestController {}

  return {
    context: {
      switchToHttp: () => ({
        getRequest: () => normalizedRequest,
        getResponse: () => response,
      }),
      getHandler: () => handler,
      getClass: () => TestController,
    } as unknown as ExecutionContext,
    response,
  };
}
