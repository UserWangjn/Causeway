import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { OrderIntentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const MAINTENANCE_CLEANUP_INTERVAL = 'maintenance-cleanup';
const CLEANUP_BATCH_SIZE = 500;

type IntervalRef = ReturnType<typeof setInterval> & {
  unref?: () => void;
};

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private running = false;

  constructor(
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(SchedulerRegistry)
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('maintenance.cleanupEnabled', true)) {
      return;
    }

    const intervalMs = this.config.get<number>('maintenance.cleanupIntervalMs', 3_600_000);
    const interval = setInterval(() => {
      void this.runCleanup('interval');
    }, intervalMs) as IntervalRef;
    interval.unref?.();
    this.schedulerRegistry.addInterval(MAINTENANCE_CLEANUP_INTERVAL, interval);
    void this.runCleanup('startup');
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', MAINTENANCE_CLEANUP_INTERVAL)) {
      this.schedulerRegistry.deleteInterval(MAINTENANCE_CLEANUP_INTERVAL);
    }
  }

  async runCleanup(trigger: 'startup' | 'interval' | 'manual' = 'manual') {
    if (this.running) {
      return { status: 'skipped' as const, reason: 'already_running' as const };
    }

    this.running = true;
    try {
      const now = new Date();
      const walletSessionCutoff = daysAgo(now, this.config.get<number>('maintenance.walletSessionRetentionDays', 30));
      const authChallengeCutoff = daysAgo(now, this.config.get<number>('maintenance.polymarketAuthChallengeRetentionDays', 7));
      const orderPreviewCutoff = daysAgo(now, this.config.get<number>('maintenance.orderPreviewRetentionDays', 7));
      const auditEventCutoff = daysAgo(now, this.config.get<number>('maintenance.auditEventRetentionDays', 90));

      const result = {
        status: 'completed' as const,
        trigger,
        walletSessions: await this.deleteExpiredWalletSessions(walletSessionCutoff),
        polymarketAuthChallenges: await this.deleteOldPolymarketAuthChallenges(authChallengeCutoff),
        orderPreviews: await this.deleteExpiredOrderPreviews(now, orderPreviewCutoff),
        auditEvents: await this.deleteOldAuditEvents(auditEventCutoff),
      };
      const deletedCount = result.walletSessions + result.polymarketAuthChallenges + result.orderPreviews + result.auditEvents;
      if (deletedCount > 0) {
        this.logger.log(`Maintenance cleanup removed ${deletedCount} rows`);
      }
      return result;
    } catch (error) {
      this.logger.error('Maintenance cleanup failed', error instanceof Error ? error.stack : undefined);
      return {
        status: 'failed' as const,
        trigger,
        reason: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.running = false;
    }
  }

  private async deleteExpiredWalletSessions(cutoff: Date): Promise<number> {
    let total = 0;
    for (;;) {
      const rows = await this.prisma.walletSession.findMany({
        where: {
          OR: [
            {
              verifiedAt: null,
              nonceExpiresAt: { lt: cutoff },
            },
            {
              sessionExpiresAt: { not: null, lt: cutoff },
            },
          ],
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: CLEANUP_BATCH_SIZE,
      });
      if (rows.length === 0) return total;
      const deleted = await this.prisma.walletSession.deleteMany({
        where: { id: { in: rows.map((row) => row.id) } },
      });
      total += deleted.count;
      if (rows.length < CLEANUP_BATCH_SIZE) return total;
    }
  }

  private async deleteOldPolymarketAuthChallenges(cutoff: Date): Promise<number> {
    let total = 0;
    for (;;) {
      const rows = await this.prisma.polymarketAuthChallenge.findMany({
        where: {
          OR: [
            { expiresAt: { lt: cutoff } },
            { usedAt: { not: null, lt: cutoff } },
          ],
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: CLEANUP_BATCH_SIZE,
      });
      if (rows.length === 0) return total;
      const deleted = await this.prisma.polymarketAuthChallenge.deleteMany({
        where: { id: { in: rows.map((row) => row.id) } },
      });
      total += deleted.count;
      if (rows.length < CLEANUP_BATCH_SIZE) return total;
    }
  }

  private async deleteExpiredOrderPreviews(now: Date, cutoff: Date): Promise<number> {
    let total = 0;
    for (;;) {
      const rows = await this.prisma.orderIntent.findMany({
        where: {
          OR: [
            {
              status: { in: [OrderIntentStatus.preview_ready, OrderIntentStatus.user_confirming] },
              previewExpiresAt: { lt: now },
              updatedAt: { lt: cutoff },
            },
            {
              status: OrderIntentStatus.draft,
              updatedAt: { lt: cutoff },
            },
          ],
        },
        select: { id: true },
        orderBy: { updatedAt: 'asc' },
        take: CLEANUP_BATCH_SIZE,
      });
      if (rows.length === 0) return total;
      const deleted = await this.prisma.orderIntent.deleteMany({
        where: { id: { in: rows.map((row) => row.id) } },
      });
      total += deleted.count;
      if (rows.length < CLEANUP_BATCH_SIZE) return total;
    }
  }

  private async deleteOldAuditEvents(cutoff: Date): Promise<number> {
    let total = 0;
    for (;;) {
      const rows = await this.prisma.auditEvent.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: CLEANUP_BATCH_SIZE,
      });
      if (rows.length === 0) return total;
      const deleted = await this.prisma.auditEvent.deleteMany({
        where: { id: { in: rows.map((row) => row.id) } },
      });
      total += deleted.count;
      if (rows.length < CLEANUP_BATCH_SIZE) return total;
    }
  }
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
