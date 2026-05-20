import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../src/common/errors/api.exception';
import type { PrismaService } from '../../src/database/prisma.service';
import type { PolymarketSyncService } from '../../src/modules/polymarket-sync/polymarket-sync.service';
import {
  POLYMARKET_HOT_MARKET_SYNC_INTERVAL,
  POLYMARKET_MARKET_SYNC_INTERVAL,
  PolymarketSyncScheduler,
} from '../../src/modules/polymarket-sync/polymarket-sync.scheduler';

describe('PolymarketSyncScheduler', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not register an interval when market sync is disabled', async () => {
    const { registry, scheduler, syncPolymarket, syncRunUpdateMany } = createScheduler({
      'polymarket.marketSync.enabled': false,
    });

    await scheduler.onModuleInit();

    expect(registry.doesExist('interval', POLYMARKET_MARKET_SYNC_INTERVAL)).toBe(false);
    expect(syncRunUpdateMany).not.toHaveBeenCalled();
    expect(syncPolymarket).not.toHaveBeenCalled();
  });

  it('registers and removes the configured market sync interval', async () => {
    const { registry, scheduler } = createScheduler({
      'polymarket.marketSync.enabled': true,
      'polymarket.marketSync.intervalMs': 60_000,
      'polymarket.marketSync.runOnStartup': false,
    });

    await scheduler.onModuleInit();
    expect(registry.doesExist('interval', POLYMARKET_MARKET_SYNC_INTERVAL)).toBe(true);
    expect(registry.doesExist('interval', POLYMARKET_HOT_MARKET_SYNC_INTERVAL)).toBe(true);

    scheduler.onModuleDestroy();
    expect(registry.doesExist('interval', POLYMARKET_MARKET_SYNC_INTERVAL)).toBe(false);
    expect(registry.doesExist('interval', POLYMARKET_HOT_MARKET_SYNC_INTERVAL)).toBe(false);
  });

  it('marks interrupted market sync runs as failed during scheduler startup', async () => {
    const { scheduler, syncRunUpdateMany } = createScheduler(
      {
        'polymarket.marketSync.enabled': true,
        'polymarket.marketSync.intervalMs': 60_000,
        'polymarket.marketSync.runOnStartup': false,
        'polymarket.marketSync.lockTtlMs': 60_000,
      },
      {},
      {
        syncRun: {
          updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      },
    );

    await scheduler.onModuleInit();

    expect(syncRunUpdateMany).toHaveBeenCalledWith({
      where: {
        jobType: 'polymarket_sync',
        scope: 'markets',
        status: 'running',
        startedAt: {
          lt: expect.any(Date) as Date,
        },
      },
      data: {
        status: 'failed',
        finishedAt: expect.any(Date) as Date,
        error: 'Polymarket market sync was interrupted before completion',
      },
    });
  });

  it('runs an incremental market sync with the configured limit', async () => {
    const { scheduler, schedulerLockUpsert, syncPolymarket } = createScheduler({
      'polymarket.marketSync.limit': 250,
    });

    const result = await scheduler.runOnce('test');

    expect(schedulerLockUpsert).toHaveBeenCalledWith({
      where: { name: POLYMARKET_MARKET_SYNC_INTERVAL },
      create: {
        name: POLYMARKET_MARKET_SYNC_INTERVAL,
        ownerId: expect.stringMatching(/^api:\d+:/) as string,
        lockedUntil: expect.any(Date) as Date,
      },
      update: {},
    });
    expect(syncPolymarket).toHaveBeenCalledWith(
      {
        scope: 'markets',
        mode: 'incremental',
        limit: 250,
      },
      {
        abortSignal: expect.any(AbortSignal) as AbortSignal,
      },
    );
    expect(result).toEqual({
      status: 'completed',
      trigger: 'test',
      runId: 'sync_run_1',
    });
  });

  it('runs a full market discovery sync without applying the incremental limit', async () => {
    const { scheduler, syncPolymarket } = createScheduler({
      'polymarket.marketSync.mode': 'full',
      'polymarket.marketSync.limit': 250,
    });

    const result = await scheduler.runOnce('test');

    expect(syncPolymarket).toHaveBeenCalledWith(
      {
        scope: 'markets',
        mode: 'full',
      },
      {
        abortSignal: expect.any(AbortSignal) as AbortSignal,
      },
    );
    expect(result).toEqual({
      status: 'completed',
      trigger: 'test',
      runId: 'sync_run_1',
    });
  });

  it('runs hot market sync with its own cadence and limits', async () => {
    const { scheduler, syncPolymarket } = createScheduler({
      'polymarket.marketSync.hotLimit': 300,
      'polymarket.marketSync.hotEventLimit': 40,
    });

    const result = await scheduler.runHotOnce('hot_test');

    expect(syncPolymarket).toHaveBeenCalledWith(
      {
        scope: 'markets',
        mode: 'hot',
        limit: 300,
        hotEventLimit: 40,
      },
      {
        abortSignal: expect.any(AbortSignal) as AbortSignal,
      },
    );
    expect(result).toEqual({
      status: 'completed',
      trigger: 'hot_test',
      runId: 'sync_run_1',
    });
  });

  it('runs a manual market sync through the shared distributed lock and returns the sync result', async () => {
    const syncResult = {
      runId: 'sync_run_manual',
      scope: 'markets',
      mode: 'hot',
      status: 'completed',
      fetchedCount: 5,
      upsertedCount: 5,
      skippedCount: 0,
    };
    const syncPolymarket = vi.fn().mockResolvedValue(syncResult);
    const { scheduler, syncPolymarket: syncMock } = createScheduler(
      {},
      {
        syncPolymarket,
      },
    );

    await expect(scheduler.runManual({ scope: 'markets', mode: 'hot', limit: 5, hotEventLimit: 2 })).resolves.toBe(syncResult);
    expect(syncMock).toHaveBeenCalledWith(
      {
        scope: 'markets',
        mode: 'hot',
        limit: 5,
        hotEventLimit: 2,
      },
      {
        abortSignal: expect.any(AbortSignal) as AbortSignal,
      },
    );
  });

  it('rejects a manual market sync when the shared distributed lock is unavailable', async () => {
    const { scheduler, syncPolymarket } = createScheduler(
      {},
      {},
      {
        schedulerLock: {
          upsert: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      },
    );

    await expect(scheduler.runManual({ scope: 'markets', mode: 'full' })).rejects.toBeInstanceOf(ApiException);
    expect(syncPolymarket).not.toHaveBeenCalled();
  });

  it('rejects overlapping manual market syncs in the same process', async () => {
    let resolveSync: ((value: { runId: string }) => void) | undefined;
    const pendingSync = new Promise<{ runId: string }>((resolve) => {
      resolveSync = resolve;
    });
    const { scheduler } = createScheduler(
      {},
      {
        syncPolymarket: vi.fn().mockReturnValue(pendingSync),
      },
    );

    const firstRun = scheduler.runManual({ scope: 'markets', mode: 'incremental', limit: 1 });
    await flushPromises();
    await expect(scheduler.runManual({ scope: 'markets', mode: 'hot', limit: 1 })).rejects.toBeInstanceOf(ApiException);

    resolveSync?.({ runId: 'sync_run_1' });
    await expect(firstRun).resolves.toEqual({ runId: 'sync_run_1' });
  });

  it('does not recover running sync runs while another instance holds an active lock', async () => {
    const { scheduler, syncRunUpdateMany } = createScheduler(
      {
        'polymarket.marketSync.enabled': true,
        'polymarket.marketSync.intervalMs': 60_000,
        'polymarket.marketSync.runOnStartup': false,
      },
      {},
      {
        schedulerLock: {
          findUnique: vi.fn().mockResolvedValue({ lockedUntil: new Date(Date.now() + 60_000) }),
        },
      },
    );

    await scheduler.onModuleInit();

    expect(syncRunUpdateMany).not.toHaveBeenCalled();
  });

  it('renews the distributed lock while a sync is running', async () => {
    vi.useFakeTimers();
    try {
      let resolveSync: ((value: { runId: string }) => void) | undefined;
      const pendingSync = new Promise<{ runId: string }>((resolve) => {
        resolveSync = resolve;
      });
      const syncPolymarket = vi.fn().mockReturnValue(pendingSync);
      const { scheduler, schedulerLockUpdateMany } = createScheduler(
        {
          'polymarket.marketSync.lockTtlMs': 60_000,
        },
        {
          syncPolymarket,
        },
      );

      const run = scheduler.runOnce('test');
      await flushPromises();
      expect(syncPolymarket).toHaveBeenCalledTimes(1);

      schedulerLockUpdateMany.mockClear();
      await vi.advanceTimersByTimeAsync(20_000);

      expect(schedulerLockUpdateMany).toHaveBeenCalledWith({
        where: {
          name: POLYMARKET_MARKET_SYNC_INTERVAL,
          ownerId: expect.stringMatching(/^api:\d+:/) as string,
        },
        data: {
          lockedUntil: expect.any(Date) as Date,
        },
      });

      resolveSync?.({ runId: 'sync_run_1' });
      await expect(run).resolves.toMatchObject({
        status: 'completed',
        trigger: 'test',
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits for an in-flight lock heartbeat before releasing the lock', async () => {
    vi.useFakeTimers();
    try {
      let resolveSync: ((value: { runId: string }) => void) | undefined;
      let resolveHeartbeat: ((value: { count: number }) => void) | undefined;
      const pendingSync = new Promise<{ runId: string }>((resolve) => {
        resolveSync = resolve;
      });
      const pendingHeartbeat = new Promise<{ count: number }>((resolve) => {
        resolveHeartbeat = resolve;
      });
      const syncPolymarket = vi.fn().mockReturnValue(pendingSync);
      const updateMany = vi
        .fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockReturnValueOnce(pendingHeartbeat)
        .mockResolvedValue({ count: 1 });
      const { scheduler, schedulerLockUpdateMany } = createScheduler(
        {
          'polymarket.marketSync.lockTtlMs': 60_000,
        },
        {
          syncPolymarket,
        },
        {
          schedulerLock: {
            updateMany,
          },
        },
      );

      const run = scheduler.runOnce('test');
      await flushPromises();
      await vi.advanceTimersByTimeAsync(20_000);
      expect(schedulerLockUpdateMany).toHaveBeenCalledTimes(2);

      resolveSync?.({ runId: 'sync_run_1' });
      await flushPromises();
      expect(schedulerLockUpdateMany).toHaveBeenCalledTimes(2);

      resolveHeartbeat?.({ count: 1 });
      await expect(run).resolves.toMatchObject({
        status: 'completed',
        trigger: 'test',
      });
      expect(schedulerLockUpdateMany).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts a running sync when distributed lock ownership is lost', async () => {
    vi.useFakeTimers();
    try {
      let abortSignal: AbortSignal | undefined;
      const syncPolymarket = vi.fn((_dto: unknown, options: { abortSignal?: AbortSignal }) => {
        abortSignal = options.abortSignal;
        return new Promise<{ runId: string }>((_resolve, reject) => {
          options.abortSignal?.addEventListener(
            'abort',
            () => {
              const reason: unknown = options.abortSignal?.reason;
              reject(reason instanceof Error ? reason : new Error(typeof reason === 'string' ? reason : 'aborted'));
            },
            { once: true },
          );
        });
      });
      const updateMany = vi
        .fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValue({ count: 0 });
      const { scheduler } = createScheduler(
        {
          'polymarket.marketSync.lockTtlMs': 60_000,
        },
        {
          syncPolymarket,
        },
        {
          schedulerLock: {
            updateMany,
          },
        },
      );

      const run = scheduler.runOnce('test');
      await flushPromises();
      await vi.advanceTimersByTimeAsync(20_000);

      await expect(run).resolves.toEqual({
        status: 'failed',
        trigger: 'test',
        reason: 'Polymarket market sync lock ownership was lost',
      });
      expect(abortSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('skips overlapping scheduled runs', async () => {
    let resolveSync: ((value: { runId: string }) => void) | undefined;
    const pendingSync = new Promise<{ runId: string }>((resolve) => {
      resolveSync = resolve;
    });
    const syncPolymarket = vi.fn().mockReturnValue(pendingSync);
    const { scheduler } = createScheduler(
      {},
      {
        syncPolymarket,
      },
    );

    const firstRun = scheduler.runOnce('first');
    const secondRun = await scheduler.runOnce('second');
    resolveSync?.({ runId: 'sync_run_1' });

    await expect(firstRun).resolves.toMatchObject({
      status: 'completed',
      trigger: 'first',
    });
    expect(secondRun).toEqual({
      status: 'skipped',
      trigger: 'second',
      reason: 'already_running',
    });
    expect(syncPolymarket).toHaveBeenCalledTimes(1);
  });

  it('skips a scheduled run when another instance owns the distributed lock', async () => {
    const { scheduler, syncPolymarket } = createScheduler(
      {},
      {},
      {
        schedulerLock: {
          upsert: vi.fn().mockResolvedValue({}),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      },
    );

    await expect(scheduler.runOnce('test')).resolves.toEqual({
      status: 'skipped',
      trigger: 'test',
      reason: 'distributed_lock_unavailable',
    });
    expect(syncPolymarket).not.toHaveBeenCalled();
  });

  it('converts sync failures into a failed scheduler result', async () => {
    const syncPolymarket = vi.fn().mockRejectedValue(new Error('gamma unavailable'));
    const { scheduler, schedulerLockUpdateMany } = createScheduler(
      {},
      {
        syncPolymarket,
      },
    );

    await expect(scheduler.runOnce('test')).resolves.toEqual({
      status: 'failed',
      trigger: 'test',
      reason: 'gamma unavailable',
    });
    expect(schedulerLockUpdateMany).toHaveBeenLastCalledWith({
      where: {
        name: POLYMARKET_MARKET_SYNC_INTERVAL,
        ownerId: expect.stringMatching(/^api:\d+:/) as string,
      },
      data: {
        lockedUntil: expect.any(Date) as Date,
      },
    });
  });
});

function createScheduler(
  configValues: Record<string, unknown>,
  syncOverrides: { syncPolymarket?: ReturnType<typeof vi.fn> } = {},
  prismaOverrides: { schedulerLock?: Partial<SchedulerLockMock>; syncRun?: Partial<SyncRunMock> } = {},
) {
  const config = {
    get: vi.fn((key: string, defaultValue?: unknown) =>
      Object.prototype.hasOwnProperty.call(configValues, key) ? configValues[key] : defaultValue,
    ),
  } as unknown as ConfigService;
  const schedulerLock = {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    ...prismaOverrides.schedulerLock,
  };
  const syncRun = {
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    ...prismaOverrides.syncRun,
  };
  const prisma = {
    schedulerLock,
    syncRun,
  } as unknown as PrismaService;
  const registry = new SchedulerRegistry();
  const syncPolymarket = syncOverrides.syncPolymarket ?? vi.fn().mockResolvedValue({ runId: 'sync_run_1' });
  const syncService = {
    syncPolymarket,
  } as unknown as PolymarketSyncService;
  const scheduler = new PolymarketSyncScheduler(config, prisma, registry, syncService);

  return {
    prisma,
    registry,
    scheduler,
    schedulerLockUpsert: schedulerLock.upsert,
    schedulerLockUpdateMany: schedulerLock.updateMany,
    syncRunUpdateMany: syncRun.updateMany,
    syncService,
    syncPolymarket,
  };
}

type SchedulerLockMock = {
  findUnique: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
};

type SyncRunMock = {
  updateMany: ReturnType<typeof vi.fn>;
};

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
