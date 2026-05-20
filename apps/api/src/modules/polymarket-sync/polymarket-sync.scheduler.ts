import { HttpStatus, Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { SyncRunStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../database/prisma.service';
import { SyncPolymarketDto } from './dto/sync-polymarket.dto';
import { PolymarketSyncService } from './polymarket-sync.service';

export const POLYMARKET_MARKET_SYNC_INTERVAL = 'polymarket-market-sync';
export const POLYMARKET_HOT_MARKET_SYNC_INTERVAL = 'polymarket-hot-market-sync';
const POLYMARKET_MARKET_SYNC_LOCK = 'polymarket-market-sync';
const DEFAULT_LOCK_TTL_MS = 900_000;

type IntervalRef = ReturnType<typeof setInterval> & {
  unref?: () => void;
};

type LockHeartbeatRef = {
  failure: Promise<never>;
  stop: () => Promise<void>;
};

type MarketSyncMode = 'incremental' | 'full' | 'hot';
type MarketSyncDto = {
  scope: 'markets';
  mode: MarketSyncMode;
  limit?: number;
  hotEventLimit?: number;
};
type SyncPolymarketResult = Awaited<ReturnType<PolymarketSyncService['syncPolymarket']>>;

export type PolymarketMarketSyncRunResult =
  | {
      status: 'completed';
      trigger: string;
      runId: string | null;
    }
  | {
      status: 'failed';
      trigger: string;
      reason: string;
    }
  | {
      status: 'skipped';
      trigger: string;
      reason: 'already_running' | 'distributed_lock_unavailable';
    };

@Injectable()
export class PolymarketSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PolymarketSyncScheduler.name);
  private readonly ownerId = `api:${process.pid}:${randomUUID()}`;
  private running = false;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SchedulerRegistry)
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(PolymarketSyncService)
    private readonly syncService: PolymarketSyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.get<boolean>('polymarket.marketSync.enabled', false)) {
      return;
    }

    await this.recoverInterruptedRuns();

    const intervalMs = this.config.get<number>('polymarket.marketSync.intervalMs', 900_000);
    const interval = setInterval(() => {
      void this.runOnce('interval');
    }, intervalMs) as IntervalRef;
    interval.unref?.();

    this.schedulerRegistry.addInterval(POLYMARKET_MARKET_SYNC_INTERVAL, interval);
    if (this.config.get<boolean>('polymarket.marketSync.hotEnabled', true)) {
      const hotIntervalMs = this.config.get<number>('polymarket.marketSync.hotIntervalMs', 300_000);
      const hotInterval = setInterval(() => {
        void this.runHotOnce('hot_interval');
      }, hotIntervalMs) as IntervalRef;
      hotInterval.unref?.();
      this.schedulerRegistry.addInterval(POLYMARKET_HOT_MARKET_SYNC_INTERVAL, hotInterval);
    }
    if (this.config.get<boolean>('polymarket.marketSync.runOnStartup', false)) {
      void this.runOnce('startup');
    }
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', POLYMARKET_MARKET_SYNC_INTERVAL)) {
      this.schedulerRegistry.deleteInterval(POLYMARKET_MARKET_SYNC_INTERVAL);
    }
    if (this.schedulerRegistry.doesExist('interval', POLYMARKET_HOT_MARKET_SYNC_INTERVAL)) {
      this.schedulerRegistry.deleteInterval(POLYMARKET_HOT_MARKET_SYNC_INTERVAL);
    }
  }

  async runOnce(trigger: string): Promise<PolymarketMarketSyncRunResult> {
    const mode = this.config.get<'incremental' | 'full'>('polymarket.marketSync.mode', 'incremental');
    const limit = this.config.get<number>('polymarket.marketSync.limit', 1000);
    return this.runConfiguredSync(trigger, {
      scope: 'markets',
      mode,
      ...(mode === 'incremental' ? { limit } : {}),
    });
  }

  async runHotOnce(trigger: string): Promise<PolymarketMarketSyncRunResult> {
    return this.runConfiguredSync(trigger, {
      scope: 'markets',
      mode: 'hot',
      limit: this.config.get<number>('polymarket.marketSync.hotLimit', 250),
      hotEventLimit: this.config.get<number>('polymarket.marketSync.hotEventLimit', 50),
    });
  }

  async runManual(dto: SyncPolymarketDto): Promise<SyncPolymarketResult> {
    const scope = dto.scope ?? 'markets';
    if (scope !== 'markets') {
      return this.syncService.syncPolymarket(dto);
    }

    return this.runManualMarketSync(normalizeMarketSyncDto(dto));
  }

  private async runConfiguredSync(
    trigger: string,
    dto: MarketSyncDto,
  ): Promise<PolymarketMarketSyncRunResult> {
    try {
      const result = await this.executeMarketSyncWithLock(dto);
      this.logger.log(`Polymarket market sync completed: ${result.runId}`);
      return {
        status: 'completed',
        trigger,
        runId: result.runId ?? null,
      };
    } catch (error) {
      if (error instanceof MarketSyncAlreadyRunningError) {
        return {
          status: 'skipped',
          trigger,
          reason: 'already_running',
        };
      }
      if (error instanceof MarketSyncLockUnavailableError) {
        return {
          status: 'skipped',
          trigger,
          reason: 'distributed_lock_unavailable',
        };
      }

      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Polymarket market sync failed: ${reason}`, error instanceof Error ? error.stack : undefined);
      return {
        status: 'failed',
        trigger,
        reason,
      };
    }
  }

  private async runManualMarketSync(dto: MarketSyncDto): Promise<SyncPolymarketResult> {
    try {
      return await this.executeMarketSyncWithLock(dto);
    } catch (error) {
      if (error instanceof MarketSyncAlreadyRunningError) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'POLYMARKET_SYNC_ALREADY_RUNNING',
          'Polymarket market sync is already running',
        );
      }
      if (error instanceof MarketSyncLockUnavailableError) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'POLYMARKET_SYNC_LOCK_UNAVAILABLE',
          'Another Polymarket market sync instance owns the distributed lock',
        );
      }
      throw error;
    }
  }

  private async executeMarketSyncWithLock(dto: MarketSyncDto): Promise<SyncPolymarketResult> {
    if (this.running) {
      throw new MarketSyncAlreadyRunningError();
    }

    this.running = true;
    const abortController = new AbortController();
    let lockAcquired = false;
    let lockHeartbeat: LockHeartbeatRef | undefined;
    let syncPromise: ReturnType<PolymarketSyncService['syncPolymarket']> | undefined;
    try {
      await this.recoverInterruptedRuns();
      lockAcquired = await this.acquireDistributedLock();
      if (!lockAcquired) {
        throw new MarketSyncLockUnavailableError();
      }
      lockHeartbeat = this.startLockHeartbeat(abortController);

      syncPromise = this.syncService.syncPolymarket(dto, {
        abortSignal: abortController.signal,
      });
      return await Promise.race([syncPromise, lockHeartbeat.failure]);
    } catch (error) {
      abortController.abort(error instanceof Error ? error : new Error(String(error)));
      if (syncPromise) {
        await syncPromise.catch(() => undefined);
      }
      throw error;
    } finally {
      if (lockHeartbeat) {
        await lockHeartbeat.stop();
      }
      if (lockAcquired) {
        await this.releaseDistributedLock().catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          this.logger.error(`Polymarket market sync lock release failed: ${reason}`, error instanceof Error ? error.stack : undefined);
        });
      }
      this.running = false;
    }
  }

  private async acquireDistributedLock(): Promise<boolean> {
    const now = new Date();
    const lockTtlMs = this.getLockTtlMs();
    const lockedUntil = new Date(now.getTime() + lockTtlMs);

    await this.prisma.schedulerLock.upsert({
      where: { name: POLYMARKET_MARKET_SYNC_LOCK },
      create: {
        name: POLYMARKET_MARKET_SYNC_LOCK,
        ownerId: this.ownerId,
        lockedUntil,
      },
      update: {},
    });

    const claim = await this.prisma.schedulerLock.updateMany({
      where: {
        name: POLYMARKET_MARKET_SYNC_LOCK,
        OR: [
          {
            lockedUntil: {
              lte: now,
            },
          },
          {
            ownerId: this.ownerId,
          },
        ],
      },
      data: {
        ownerId: this.ownerId,
        lockedUntil,
      },
    });

    return claim.count === 1;
  }

  private startLockHeartbeat(abortController: AbortController): LockHeartbeatRef {
    const heartbeatMs = Math.max(1_000, Math.floor(this.getLockTtlMs() / 3));
    let stopped = false;
    let failed = false;
    let activeRenewal: Promise<void> | undefined;
    let failHeartbeat: (error: Error) => void = () => undefined;
    const failure = new Promise<never>((_resolve, reject) => {
      failHeartbeat = reject;
    });
    const heartbeat = setInterval(() => {
      if (stopped || failed) {
        return;
      }

      activeRenewal = this.renewDistributedLock()
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : String(error);
          const failureReason = error instanceof Error ? error : new Error(reason);
          failed = true;
          clearInterval(heartbeat);
          abortController.abort(failureReason);
          this.logger.error(
            `Polymarket market sync lock heartbeat failed: ${reason}`,
            error instanceof Error ? error.stack : undefined,
          );
          failHeartbeat(failureReason);
        })
        .finally(() => {
          activeRenewal = undefined;
        });
    }, heartbeatMs) as IntervalRef;
    heartbeat.unref?.();
    return {
      failure,
      stop: async () => {
        stopped = true;
        clearInterval(heartbeat);
        if (activeRenewal) {
          await activeRenewal;
        }
      },
    };
  }

  private async renewDistributedLock(): Promise<void> {
    const renewed = await this.prisma.schedulerLock.updateMany({
      where: {
        name: POLYMARKET_MARKET_SYNC_LOCK,
        ownerId: this.ownerId,
      },
      data: {
        lockedUntil: new Date(Date.now() + this.getLockTtlMs()),
      },
    });

    if (renewed.count !== 1) {
      throw new Error('Polymarket market sync lock ownership was lost');
    }
  }

  private async releaseDistributedLock(): Promise<void> {
    await this.prisma.schedulerLock.updateMany({
      where: {
        name: POLYMARKET_MARKET_SYNC_LOCK,
        ownerId: this.ownerId,
      },
      data: {
        lockedUntil: new Date(),
      },
    });
  }

  private getLockTtlMs(): number {
    const configured = this.config.get<number>('polymarket.marketSync.lockTtlMs', DEFAULT_LOCK_TTL_MS);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_LOCK_TTL_MS;
  }

  private async recoverInterruptedRuns(): Promise<void> {
    const activeLock = await this.prisma.schedulerLock.findUnique({
      where: { name: POLYMARKET_MARKET_SYNC_LOCK },
      select: {
        lockedUntil: true,
      },
    });
    if (activeLock && activeLock.lockedUntil > new Date()) {
      return;
    }

    const cutoff = new Date(Date.now() - this.getLockTtlMs());
    const recovered = await this.prisma.syncRun.updateMany({
      where: {
        jobType: 'polymarket_sync',
        scope: 'markets',
        status: SyncRunStatus.running,
        startedAt: {
          lt: cutoff,
        },
      },
      data: {
        status: SyncRunStatus.failed,
        finishedAt: new Date(),
        error: 'Polymarket market sync was interrupted before completion',
      },
    });

    if (recovered.count > 0) {
      this.logger.warn(`Recovered ${recovered.count} interrupted Polymarket market sync run(s)`);
    }
  }
}

function normalizeMarketSyncDto(dto: SyncPolymarketDto): MarketSyncDto {
  return {
    scope: 'markets',
    mode: normalizeMarketSyncMode(dto.mode),
    ...(dto.limit == null ? {} : { limit: dto.limit }),
    ...(dto.hotEventLimit == null ? {} : { hotEventLimit: dto.hotEventLimit }),
  };
}

function normalizeMarketSyncMode(mode: string | undefined): MarketSyncMode {
  if (mode === 'full' || mode === 'hot' || mode === 'incremental') return mode;
  return 'incremental';
}

class MarketSyncAlreadyRunningError extends Error {
  constructor() {
    super('Polymarket market sync is already running');
  }
}

class MarketSyncLockUnavailableError extends Error {
  constructor() {
    super('Another Polymarket market sync instance owns the distributed lock');
  }
}
