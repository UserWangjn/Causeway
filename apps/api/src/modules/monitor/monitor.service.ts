import { Inject, Injectable } from '@nestjs/common';
import { Prisma, ScriptStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

const SCRIPT_MARKET_REFRESH_REASON = 'Script market monitoring refresh uses local market cache; external refresh is not wired yet';
const ORDER_STATUS_REFRESH_REASON = 'Order status refresh uses local order state; external CLOB status refresh is not wired yet';
const MONITOR_REFRESH_BATCH_SIZE = 500;

const ORDER_STATUS_REFRESH_SELECT = Prisma.validator<Prisma.CausewayOrderSelect>()({
  id: true,
  status: true,
  externalOrderId: true,
  orderIntent: {
    select: {
      executionMode: true,
      status: true,
    },
  },
});

const SCRIPT_MARKET_REFRESH_SELECT = Prisma.validator<Prisma.ScriptMarketSelect>()({
  id: true,
  marketId: true,
  market: {
    select: {
      id: true,
      lastTradePrice: true,
      bestBid: true,
      bestAsk: true,
      spread: true,
      liquidity: true,
      volume: true,
    },
  },
  selections: {
    select: {
      outcome: {
        select: {
          id: true,
          marketId: true,
          price: true,
          bestBid: true,
          bestAsk: true,
          lastTradePrice: true,
        },
      },
    },
  },
});

type ScriptMarketRefreshRecord = Prisma.ScriptMarketGetPayload<{
  select: typeof SCRIPT_MARKET_REFRESH_SELECT;
}>;

type OrderStatusRefreshRecord = Prisma.CausewayOrderGetPayload<{
  select: typeof ORDER_STATUS_REFRESH_SELECT;
}>;

@Injectable()
export class MonitorService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async refreshOrderStatuses() {
    const run = await this.prisma.syncRun.create({
      data: {
        jobType: 'order_status_refresh',
        scope: 'orders',
        status: 'running',
        metadata: toJson({
          capability: 'degraded',
          source: 'local_order_state',
          reason: ORDER_STATUS_REFRESH_REASON,
          batchSize: MONITOR_REFRESH_BATCH_SIZE,
        }),
      },
    });
    const summary = createOrderStatusRefreshSummary();
    let inspectedOrderCount = 0;
    let batchCount = 0;
    let cursor: string | null = null;

    try {
      while (true) {
        const orders: OrderStatusRefreshRecord[] = await this.prisma.causewayOrder.findMany({
          where: {
            status: {
              in: ['preview_ready', 'dry_run_completed', 'submitted', 'partially_filled', 'filled', 'unknown', 'cancelled', 'failed'],
            },
          },
          select: ORDER_STATUS_REFRESH_SELECT,
          orderBy: { id: 'asc' },
          take: MONITOR_REFRESH_BATCH_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!orders.length) {
          break;
        }

        batchCount += 1;
        inspectedOrderCount += orders.length;
        cursor = orders.at(-1)?.id ?? cursor;
        addOrderStatusRefreshSummary(summary, orders);
        if (orders.length < MONITOR_REFRESH_BATCH_SIZE) {
          break;
        }
      }

      const completedRun = await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          fetchedCount: inspectedOrderCount,
          upsertedCount: 0,
          cursor,
          metadata: toJson({
            capability: 'degraded',
            source: 'local_order_state',
            reason: ORDER_STATUS_REFRESH_REASON,
            batchSize: MONITOR_REFRESH_BATCH_SIZE,
            batchCount,
            inspectedOrderCount,
            ...summary,
          }),
        },
      });

      return {
        runId: completedRun.id,
        jobType: completedRun.jobType,
        status: completedRun.status,
        capability: 'degraded',
        source: 'local_order_state',
        reason: ORDER_STATUS_REFRESH_REASON,
        inspectedOrderCount,
        batchCount,
        ...summary,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failedRun = await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          fetchedCount: inspectedOrderCount,
          error: reason,
          cursor,
          metadata: toJson({
            capability: 'unavailable',
            source: 'local_order_state',
            reason,
            batchSize: MONITOR_REFRESH_BATCH_SIZE,
            batchCount,
            inspectedOrderCount,
            ...summary,
          }),
        },
      });

      return {
        runId: failedRun.id,
        jobType: failedRun.jobType,
        status: failedRun.status,
        capability: 'unavailable',
        source: 'local_order_state',
        reason,
        inspectedOrderCount,
        batchCount,
        ...summary,
      };
    }
  }

  async refreshScriptMarkets() {
    const snapshotAt = new Date();
    const run = await this.prisma.syncRun.create({
      data: {
        jobType: 'script_market_refresh',
        scope: 'scripts',
        status: 'running',
        metadata: toJson({
          capability: 'degraded',
          source: 'local_polymarket_cache',
          reason: SCRIPT_MARKET_REFRESH_REASON,
          batchSize: MONITOR_REFRESH_BATCH_SIZE,
        }),
      },
    });
    const snapshotTracker = createScriptMarketSnapshotTracker();
    let refreshedScriptMarketCount = 0;
    let batchCount = 0;
    let cursor: string | null = null;

    try {
      while (true) {
        const scriptMarkets: ScriptMarketRefreshRecord[] = await this.prisma.scriptMarket.findMany({
          where: {
            script: {
              status: {
                not: ScriptStatus.archived,
              },
            },
          },
          select: SCRIPT_MARKET_REFRESH_SELECT,
          orderBy: { id: 'asc' },
          take: MONITOR_REFRESH_BATCH_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!scriptMarkets.length) {
          break;
        }

        batchCount += 1;
        refreshedScriptMarketCount += scriptMarkets.length;
        cursor = scriptMarkets.at(-1)?.id ?? cursor;
        const snapshots = buildScriptMarketSnapshots(scriptMarkets, snapshotAt, snapshotTracker);
        if (snapshots.length) {
          await this.prisma.marketSnapshot.createMany({
            data: snapshots,
          });
          snapshotTracker.snapshotCount += snapshots.length;
        }
        if (scriptMarkets.length < MONITOR_REFRESH_BATCH_SIZE) {
          break;
        }
      }

      const completedRun = await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          fetchedCount: refreshedScriptMarketCount,
          upsertedCount: snapshotTracker.snapshotCount,
          cursor,
          metadata: toJson({
            capability: 'degraded',
            source: 'local_polymarket_cache',
            reason: SCRIPT_MARKET_REFRESH_REASON,
            batchSize: MONITOR_REFRESH_BATCH_SIZE,
            batchCount,
            marketCount: snapshotTracker.marketIds.size,
            outcomeCount: snapshotTracker.outcomeIds.size,
          }),
        },
      });

      return {
        runId: completedRun.id,
        jobType: completedRun.jobType,
        status: completedRun.status,
        capability: 'degraded',
        source: 'local_polymarket_cache',
        reason: SCRIPT_MARKET_REFRESH_REASON,
        refreshedScriptMarketCount,
        snapshotCount: snapshotTracker.snapshotCount,
        batchCount,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const failedRun = await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          fetchedCount: refreshedScriptMarketCount,
          upsertedCount: snapshotTracker.snapshotCount,
          error: reason,
          cursor,
          metadata: toJson({
            capability: 'unavailable',
            source: 'local_polymarket_cache',
            reason,
            batchSize: MONITOR_REFRESH_BATCH_SIZE,
            batchCount,
            marketCount: snapshotTracker.marketIds.size,
            outcomeCount: snapshotTracker.outcomeIds.size,
          }),
        },
      });

      return {
        runId: failedRun.id,
        jobType: failedRun.jobType,
        status: failedRun.status,
        capability: 'unavailable',
        source: 'local_polymarket_cache',
        reason,
        refreshedScriptMarketCount,
        snapshotCount: snapshotTracker.snapshotCount,
        batchCount,
      };
    }
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function createOrderStatusRefreshSummary() {
  return {
    statusCounts: {} as Record<string, number>,
    intentStatusCounts: {} as Record<string, number>,
    refreshableExternalOrderCount: 0,
    missingExternalOrderIdCount: 0,
  };
}

function addOrderStatusRefreshSummary(
  summary: ReturnType<typeof createOrderStatusRefreshSummary>,
  orders: OrderStatusRefreshRecord[],
): void {
  for (const order of orders) {
    summary.statusCounts[order.status] = (summary.statusCounts[order.status] ?? 0) + 1;
    summary.intentStatusCounts[order.orderIntent.status] = (summary.intentStatusCounts[order.orderIntent.status] ?? 0) + 1;

    if (order.orderIntent.executionMode === 'real' && (order.status === 'submitted' || order.status === 'partially_filled')) {
      summary.refreshableExternalOrderCount += 1;
      if (!order.externalOrderId) {
        summary.missingExternalOrderIdCount += 1;
      }
    }
  }
}

function createScriptMarketSnapshotTracker() {
  return {
    marketIds: new Set<string>(),
    outcomeIds: new Set<string>(),
    snapshotCount: 0,
  };
}

function buildScriptMarketSnapshots(
  scriptMarkets: ScriptMarketRefreshRecord[],
  snapshotAt: Date,
  tracker: ReturnType<typeof createScriptMarketSnapshotTracker>,
) {
  const snapshots: Prisma.MarketSnapshotCreateManyInput[] = [];

  for (const scriptMarket of scriptMarkets) {
    if (!tracker.marketIds.has(scriptMarket.market.id)) {
      tracker.marketIds.add(scriptMarket.market.id);
      snapshots.push({
        marketId: scriptMarket.market.id,
        outcomeId: null,
        price: scriptMarket.market.lastTradePrice,
        bestBid: scriptMarket.market.bestBid,
        bestAsk: scriptMarket.market.bestAsk,
        spread: scriptMarket.market.spread,
        liquidity: scriptMarket.market.liquidity,
        volume: scriptMarket.market.volume,
        snapshotAt,
      });
    }

    for (const selection of scriptMarket.selections) {
      const { outcome } = selection;
      if (tracker.outcomeIds.has(outcome.id)) {
        continue;
      }
      tracker.outcomeIds.add(outcome.id);
      snapshots.push({
        marketId: outcome.marketId,
        outcomeId: outcome.id,
        price: outcome.lastTradePrice ?? outcome.price,
        bestBid: outcome.bestBid,
        bestAsk: outcome.bestAsk,
        spread: null,
        liquidity: null,
        volume: null,
        snapshotAt,
      });
    }
  }

  return snapshots;
}
