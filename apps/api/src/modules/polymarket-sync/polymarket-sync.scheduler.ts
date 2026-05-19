import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { PolymarketSyncService } from './polymarket-sync.service';

export const POLYMARKET_MARKET_SYNC_INTERVAL = 'polymarket-market-sync';
const POLYMARKET_MARKET_SYNC_LOCK = 'polymarket-market-sync';
const DEFAULT_LOCK_TTL_MS = 900_000;

type IntervalRef = ReturnType<typeof setInterval> & {
  unref?: () => void;
};

type LockHeartbeatRef = {
  failure: Promise<never>;
  stop: () => Promise<void>;
};

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

  onModuleInit(): void {
    if (!this.config.get<boolean>('polymarket.marketSync.enabled', false)) {
      return;
    }

    const intervalMs = this.config.get<number>('polymarket.marketSync.intervalMs', 900_000);
    const interval = setInterval(() => {
      void this.runOnce('interval');
    }, intervalMs) as IntervalRef;
    interval.unref?.();

    this.schedulerRegistry.addInterval(POLYMARKET_MARKET_SYNC_INTERVAL, interval);
    if (this.config.get<boolean>('polymarket.marketSync.runOnStartup', false)) {
      void this.runOnce('startup');
    }
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', POLYMARKET_MARKET_SYNC_INTERVAL)) {
      this.schedulerRegistry.deleteInterval(POLYMARKET_MARKET_SYNC_INTERVAL);
    }
  }

  async runOnce(trigger: string): Promise<PolymarketMarketSyncRunResult> {
    if (this.running) {
      return {
        status: 'skipped',
        trigger,
        reason: 'already_running',
      };
    }

    this.running = true;
    const abortController = new AbortController();
    let lockAcquired = false;
    let lockHeartbeat: LockHeartbeatRef | undefined;
    let syncPromise: ReturnType<PolymarketSyncService['syncPolymarket']> | undefined;
    try {
      lockAcquired = await this.acquireDistributedLock();
      if (!lockAcquired) {
        return {
          status: 'skipped',
          trigger,
          reason: 'distributed_lock_unavailable',
        };
      }
      lockHeartbeat = this.startLockHeartbeat(abortController);

      const limit = this.config.get<number>('polymarket.marketSync.limit', 1000);
      syncPromise = this.syncService.syncPolymarket(
        {
          scope: 'markets',
          mode: 'incremental',
          limit,
        },
        {
          abortSignal: abortController.signal,
        },
      );
      const result = await Promise.race([syncPromise, lockHeartbeat.failure]);
      this.logger.log(`Polymarket market sync completed: ${result.runId}`);
      return {
        status: 'completed',
        trigger,
        runId: result.runId ?? null,
      };
    } catch (error) {
      abortController.abort(error instanceof Error ? error : new Error(String(error)));
      if (syncPromise) {
        await syncPromise.catch(() => undefined);
      }
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Polymarket market sync failed: ${reason}`, error instanceof Error ? error.stack : undefined);
      return {
        status: 'failed',
        trigger,
        reason,
      };
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
}
