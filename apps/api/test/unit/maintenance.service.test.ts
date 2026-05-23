import type { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { OrderIntentStatus } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../src/database/prisma.service';
import { MaintenanceService } from '../../src/modules/maintenance/maintenance.service';

type IdRow = { id: string };

type ModelMock = {
  findMany: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
};

type MaintenancePrismaMock = {
  walletSession: ModelMock;
  polymarketAuthChallenge: ModelMock;
  orderIntent: ModelMock;
  auditEvent: ModelMock;
};

describe('MaintenanceService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses retention windows and only targets disposable operational records', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T00:00:00.000Z'));
    const { service, prisma } = createService();

    const result = await service.runCleanup('manual');

    expect(result).toMatchObject({
      status: 'completed',
      walletSessions: 0,
      polymarketAuthChallenges: 0,
      orderPreviews: 0,
      auditEvents: 0,
    });
    expect(prisma.walletSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          {
            verifiedAt: null,
            nonceExpiresAt: { lt: new Date('2026-04-23T00:00:00.000Z') },
          },
          {
            sessionExpiresAt: { not: null, lt: new Date('2026-04-23T00:00:00.000Z') },
          },
        ],
      },
      take: 500,
    }));
    expect(prisma.polymarketAuthChallenge.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { expiresAt: { lt: new Date('2026-05-16T00:00:00.000Z') } },
          { usedAt: { not: null, lt: new Date('2026-05-16T00:00:00.000Z') } },
        ],
      },
    }));
    expect(prisma.orderIntent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          {
            status: { in: [OrderIntentStatus.preview_ready, OrderIntentStatus.user_confirming] },
            previewExpiresAt: { lt: new Date('2026-05-23T00:00:00.000Z') },
            updatedAt: { lt: new Date('2026-05-16T00:00:00.000Z') },
          },
          {
            status: OrderIntentStatus.draft,
            updatedAt: { lt: new Date('2026-05-16T00:00:00.000Z') },
          },
        ],
      },
    }));
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: { lt: new Date('2026-02-22T00:00:00.000Z') } },
    }));
  });

  it('deletes rows in bounded batches until a model is drained', async () => {
    const firstBatch = Array.from({ length: 500 }, (_value, index) => ({ id: `wallet_${index}` }));
    const secondBatch = [{ id: 'wallet_500' }];
    const { service, prisma } = createService({}, {
      walletSession: modelMock([firstBatch, secondBatch, []], [500, 1]),
    });

    const result = await service.runCleanup('manual');

    expect(result).toMatchObject({ status: 'completed', walletSessions: 501 });
    expect(prisma.walletSession.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.walletSession.deleteMany).toHaveBeenCalledTimes(2);
    expect(prisma.walletSession.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: firstBatch.map((row) => row.id) } },
    });
    expect(prisma.walletSession.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ['wallet_500'] } },
    });
  });

  it('does not register or run cleanup when disabled', () => {
    const { service, prisma, registry } = createService({ 'maintenance.cleanupEnabled': false });

    service.onModuleInit();

    expect(registry.doesExist('interval', 'maintenance-cleanup')).toBe(false);
    expect(prisma.walletSession.findMany).not.toHaveBeenCalled();
    expect(prisma.polymarketAuthChallenge.findMany).not.toHaveBeenCalled();
    expect(prisma.orderIntent.findMany).not.toHaveBeenCalled();
    expect(prisma.auditEvent.findMany).not.toHaveBeenCalled();
  });

  it('skips a concurrent cleanup run while another run is still active', async () => {
    let releaseFirstFind: (() => void) | null = null;
    const walletSession = modelMock([], []);
    walletSession.findMany.mockImplementationOnce(() => new Promise<IdRow[]>((resolve) => {
      releaseFirstFind = () => resolve([]);
    }));
    const { service } = createService({}, { walletSession });

    const firstRun = service.runCleanup('manual');
    const secondRun = await service.runCleanup('manual');

    expect(secondRun).toEqual({ status: 'skipped', reason: 'already_running' });
    expect(releaseFirstFind).toBeTypeOf('function');
    releaseFirstFind?.();
    await expect(firstRun).resolves.toMatchObject({ status: 'completed' });
  });
});

function createService(
  configValues: Record<string, unknown> = {},
  prismaOverrides: Partial<MaintenancePrismaMock> = {},
) {
  const config = {
    get: vi.fn((key: string, defaultValue?: unknown) =>
      Object.prototype.hasOwnProperty.call(configValues, key) ? configValues[key] : defaultValue,
    ),
  } as unknown as ConfigService;
  const prisma: MaintenancePrismaMock = {
    walletSession: modelMock(),
    polymarketAuthChallenge: modelMock(),
    orderIntent: modelMock(),
    auditEvent: modelMock(),
    ...prismaOverrides,
  };
  const registry = new SchedulerRegistry();
  const service = new MaintenanceService(config, prisma as unknown as PrismaService, registry);

  return { config, prisma, registry, service };
}

function modelMock(findManyResults: IdRow[][] = [[]], deleteCounts: number[] = [0]): ModelMock {
  const findMany = vi.fn();
  for (const result of findManyResults) {
    findMany.mockResolvedValueOnce(result);
  }
  findMany.mockResolvedValue([]);

  const deleteMany = vi.fn();
  for (const count of deleteCounts) {
    deleteMany.mockResolvedValueOnce({ count });
  }
  deleteMany.mockResolvedValue({ count: 0 });

  return { findMany, deleteMany };
}
