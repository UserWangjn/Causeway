import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../src/common/errors/api.exception';
import type { PrismaService } from '../../src/database/prisma.service';
import { HealthController } from '../../src/modules/health/health.controller';

describe('HealthController', () => {
  it('returns a public liveness response without touching the database', () => {
    const queryRaw = vi.fn();
    const controller = new HealthController({
      $queryRaw: queryRaw,
    } as unknown as PrismaService);

    const result = controller.health();

    expect(result).toMatchObject({
      ok: true,
      service: 'causeway-api',
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns readiness when the database responds', async () => {
    const controller = new HealthController({
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as PrismaService);

    await expect(controller.readiness()).resolves.toMatchObject({
      ok: true,
      service: 'causeway-api',
      checks: {
        database: 'ok',
      },
    });
  });

  it('fails readiness without leaking database error details', async () => {
    const controller = new HealthController({
      $queryRaw: vi.fn().mockRejectedValue(new Error('postgres://user:secret@localhost/db')),
    } as unknown as PrismaService);

    await expect(controller.readiness()).rejects.toBeInstanceOf(ApiException);
    await expect(controller.readiness()).rejects.toThrow('Database readiness check failed');
  });
});
