import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { ApiException } from '../../src/common/errors/api.exception';
import type { RateLimitStore } from '../../src/common/rate-limit/rate-limit.store';
import type { PrismaService } from '../../src/database/prisma.service';
import { HealthController } from '../../src/modules/health/health.controller';

describe('HealthController', () => {
  it('returns a public liveness response without touching the database', () => {
    const queryRaw = vi.fn();
    const controller = createController({
      $queryRaw: queryRaw,
    });

    const result = controller.health();

    expect(result).toMatchObject({
      ok: true,
      service: 'causeway-api',
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns readiness when the database responds', async () => {
    const rateLimitHealthCheck = vi.fn().mockResolvedValue(undefined);
    const controller = createController({
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    }, {
      healthCheck: rateLimitHealthCheck,
    });

    await expect(controller.readiness()).resolves.toMatchObject({
      ok: true,
      service: 'causeway-api',
      checks: {
        database: 'ok',
        rateLimit: 'ok',
      },
    });
    expect(rateLimitHealthCheck).toHaveBeenCalledOnce();
  });

  it('skips the rate limit readiness dependency when rate limiting is disabled', async () => {
    const rateLimitHealthCheck = vi.fn().mockResolvedValue(undefined);
    const controller = createController(
      {
        $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      },
      {
        healthCheck: rateLimitHealthCheck,
      },
      { rateLimitEnabled: false },
    );

    await expect(controller.readiness()).resolves.toMatchObject({
      checks: {
        database: 'ok',
      },
    });
    expect(rateLimitHealthCheck).not.toHaveBeenCalled();
  });

  it('fails readiness without leaking database error details', async () => {
    const controller = createController({
      $queryRaw: vi.fn().mockRejectedValue(new Error('postgres://user:secret@localhost/db')),
    });

    await expect(controller.readiness()).rejects.toBeInstanceOf(ApiException);
    await expect(controller.readiness()).rejects.toThrow('Database readiness check failed');
  });

  it('fails readiness without leaking rate limit store error details', async () => {
    const controller = createController({
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    }, {
      healthCheck: vi.fn().mockRejectedValue(new Error('redis://:secret@localhost:6379')),
    });

    await expect(controller.readiness()).rejects.toBeInstanceOf(ApiException);
    await expect(controller.readiness()).rejects.toThrow('Rate limit readiness check failed');
  });
});

function createController(
  prisma: Partial<PrismaService>,
  rateLimitStore: Partial<RateLimitStore> = {
    healthCheck: vi.fn().mockResolvedValue(undefined),
  },
  options: { rateLimitEnabled?: boolean } = {},
): HealthController {
  return new HealthController(
    prisma as PrismaService,
    {
      get: vi.fn((key: string, defaultValue?: unknown) => {
        if (key === 'rateLimit.enabled') return options.rateLimitEnabled ?? true;
        return defaultValue;
      }),
    } as unknown as ConfigService,
    rateLimitStore as RateLimitStore,
  );
}
