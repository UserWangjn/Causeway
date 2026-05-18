import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MonitorService {
  constructor(private readonly prisma: PrismaService) {}

  async refreshOrderStatuses() {
    const reason = 'CLOB open order/status refresh is not wired yet';
    const run = await this.prisma.syncRun.create({
      data: {
        jobType: 'order_status_refresh',
        scope: 'orders',
        status: 'failed',
        finishedAt: new Date(),
        error: reason,
        metadata: toJson({
          capability: 'unavailable',
          reason,
        }),
      },
    });

    return {
      runId: run.id,
      jobType: run.jobType,
      status: run.status,
      capability: 'unavailable',
      reason,
    };
  }

  async refreshScriptMarkets() {
    const reason = 'Script market monitoring refresh is not wired yet';
    const run = await this.prisma.syncRun.create({
      data: {
        jobType: 'script_market_refresh',
        scope: 'scripts',
        status: 'failed',
        finishedAt: new Date(),
        error: reason,
        metadata: toJson({
          capability: 'unavailable',
          reason,
        }),
      },
    });

    return {
      runId: run.id,
      jobType: run.jobType,
      status: run.status,
      capability: 'unavailable',
      reason,
    };
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
