import { Inject, Injectable } from '@nestjs/common';
import { CausewayOrderStatus, OrderIntentStatus, Prisma, ScriptStatus } from '@prisma/client';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { ClobClient, type ClobApiCredentials, type ClobOpenOrder } from '../../integrations/polymarket/services/clob.client';
import { TradingService } from '../trading/trading.service';

const SCRIPT_MARKET_REFRESH_REASON = 'Script market monitoring refresh uses local market cache; external refresh is not wired yet';
const ORDER_STATUS_REFRESH_REASON = 'Order status refresh uses Polymarket CLOB order detail when external order ids are available';
const MONITOR_REFRESH_BATCH_SIZE = 500;
const ORDER_STATUS_REFRESH_BATCH_SIZE = 100;

const ORDER_STATUS_REFRESH_SELECT = Prisma.validator<Prisma.CausewayOrderSelect>()({
  id: true,
  status: true,
  externalOrderId: true,
  orderIntentId: true,
  orderIntent: {
    select: {
      id: true,
      executionMode: true,
      status: true,
      user: {
        select: {
          id: true,
          walletAddress: true,
          polymarketAccount: {
            select: {
              chainId: true,
            },
          },
        },
      },
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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ClobClient) private readonly clobClient: ClobClient,
    @Inject(TradingService) private readonly tradingService: TradingService,
  ) {}

  async refreshOrderStatuses() {
    const run = await this.prisma.syncRun.create({
      data: {
        jobType: 'order_status_refresh',
        scope: 'orders',
        status: 'running',
        metadata: toJson({
          capability: 'available',
          source: 'polymarket_clob',
          reason: ORDER_STATUS_REFRESH_REASON,
          batchSize: ORDER_STATUS_REFRESH_BATCH_SIZE,
        }),
      },
    });
    const summary = createOrderStatusRefreshSummary();
    const credentialsByUserId = new Map<string, Promise<ClobApiCredentials>>();
    let inspectedOrderCount = 0;
    let batchCount = 0;
    let cursor: string | null = null;

    try {
      while (true) {
        const orders: OrderStatusRefreshRecord[] = await this.prisma.causewayOrder.findMany({
          where: {
            orderIntent: {
              executionMode: 'real',
            },
            status: {
              in: [CausewayOrderStatus.submitted, CausewayOrderStatus.partially_filled, CausewayOrderStatus.unknown],
            },
          },
          select: ORDER_STATUS_REFRESH_SELECT,
          orderBy: { id: 'asc' },
          take: ORDER_STATUS_REFRESH_BATCH_SIZE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!orders.length) {
          break;
        }

        batchCount += 1;
        inspectedOrderCount += orders.length;
        cursor = orders.at(-1)?.id ?? cursor;
        addOrderStatusRefreshSummary(summary, orders);
        for (const order of orders) {
          await this.refreshOneOrderStatus(order, summary, credentialsByUserId);
        }
        if (orders.length < ORDER_STATUS_REFRESH_BATCH_SIZE) {
          break;
        }
      }

      const capability = resolveOrderStatusRefreshCapability(summary);
      const completedRun = await this.prisma.syncRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          fetchedCount: inspectedOrderCount,
          upsertedCount: summary.remoteOrderPersistedCount,
          cursor,
          metadata: toJson({
            capability,
            source: 'polymarket_clob',
            reason: ORDER_STATUS_REFRESH_REASON,
            batchSize: ORDER_STATUS_REFRESH_BATCH_SIZE,
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
        capability,
        source: 'polymarket_clob',
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
            source: 'polymarket_clob',
            reason,
            batchSize: ORDER_STATUS_REFRESH_BATCH_SIZE,
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
        source: 'polymarket_clob',
        reason,
        inspectedOrderCount,
        batchCount,
        ...summary,
      };
    }
  }

  private async refreshOneOrderStatus(
    order: OrderStatusRefreshRecord,
    summary: ReturnType<typeof createOrderStatusRefreshSummary>,
    credentialsByUserId: Map<string, Promise<ClobApiCredentials>>,
  ): Promise<void> {
    if (!order.externalOrderId) return;

    summary.remoteRefreshAttemptCount += 1;
    try {
      const credentials = await this.getOrderRefreshCredentials(order, credentialsByUserId);
      const remoteOrder = await this.clobClient.getOrder(order.externalOrderId, credentials);
      summary.remoteRefreshSuccessCount += 1;
      summary.remoteStatusCounts[remoteOrder.status] = (summary.remoteStatusCounts[remoteOrder.status] ?? 0) + 1;
      const nextStatus = mapClobOrderStatus(remoteOrder);
      const statusChanged = nextStatus !== order.status;

      await this.prisma.$transaction(async (tx) => {
        await tx.causewayOrder.update({
          where: { id: order.id },
          data: {
            status: nextStatus,
            errorMessage: null,
            responsePayload: toJson({
              source: 'polymarket_clob_order_detail',
              refreshedAt: new Date().toISOString(),
              order: remoteOrder.raw,
            }),
          },
        });
        await refreshOrderIntentStatus(tx, order.orderIntentId);
      });
      if (statusChanged) {
        summary.remoteStatusUpdatedCount += 1;
      }
      summary.remoteOrderPersistedCount += 1;
    } catch (error) {
      summary.remoteRefreshFailedCount += 1;
      const reason = error instanceof Error ? error.message : String(error);
      summary.remoteRefreshErrorCounts[reason] = (summary.remoteRefreshErrorCounts[reason] ?? 0) + 1;
    }
  }

  private getOrderRefreshCredentials(
    order: OrderStatusRefreshRecord,
    credentialsByUserId: Map<string, Promise<ClobApiCredentials>>,
  ): Promise<ClobApiCredentials> {
    const userId = order.orderIntent.user.id;
    const cachedCredentials = credentialsByUserId.get(userId);
    if (cachedCredentials) return cachedCredentials;

    const credentials = this.tradingService.getUserClobCredentials(toCurrentUser(order));
    credentialsByUserId.set(userId, credentials);
    return credentials;
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
    remoteStatusCounts: {} as Record<string, number>,
    refreshableExternalOrderCount: 0,
    missingExternalOrderIdCount: 0,
    remoteRefreshAttemptCount: 0,
    remoteRefreshSuccessCount: 0,
    remoteRefreshFailedCount: 0,
    remoteOrderPersistedCount: 0,
    remoteStatusUpdatedCount: 0,
    remoteRefreshErrorCounts: {} as Record<string, number>,
  };
}

function addOrderStatusRefreshSummary(
  summary: ReturnType<typeof createOrderStatusRefreshSummary>,
  orders: OrderStatusRefreshRecord[],
): void {
  for (const order of orders) {
    summary.statusCounts[order.status] = (summary.statusCounts[order.status] ?? 0) + 1;
    summary.intentStatusCounts[order.orderIntent.status] = (summary.intentStatusCounts[order.orderIntent.status] ?? 0) + 1;

    if (order.orderIntent.executionMode === 'real') {
      summary.refreshableExternalOrderCount += 1;
      if (!order.externalOrderId) {
        summary.missingExternalOrderIdCount += 1;
      }
    }
  }
}

function resolveOrderStatusRefreshCapability(
  summary: ReturnType<typeof createOrderStatusRefreshSummary>,
): 'available' | 'degraded' {
  return summary.remoteRefreshFailedCount > 0 || summary.missingExternalOrderIdCount > 0 ? 'degraded' : 'available';
}

function toCurrentUser(order: OrderStatusRefreshRecord): CurrentUser {
  return {
    id: order.orderIntent.user.id,
    sessionId: 'monitor_order_status_refresh',
    walletAddress: order.orderIntent.user.walletAddress,
    chainId: order.orderIntent.user.polymarketAccount?.chainId ?? 137,
  };
}

function mapClobOrderStatus(order: ClobOpenOrder): CausewayOrderStatus {
  const normalizedStatus = normalizeClobStatus(order.status);
  const originalSize = toFiniteNumber(order.originalSize);
  const sizeMatched = toFiniteNumber(order.sizeMatched);

  if (originalSize != null && originalSize > 0 && sizeMatched != null) {
    if (sizeMatched >= originalSize) return CausewayOrderStatus.filled;
    if (sizeMatched > 0) return CausewayOrderStatus.partially_filled;
  }

  if (normalizedStatus === 'matched' || normalizedStatus === 'filled') return CausewayOrderStatus.filled;
  if (normalizedStatus.includes('partial')) return CausewayOrderStatus.partially_filled;
  if (normalizedStatus.includes('cancel')) return CausewayOrderStatus.cancelled;
  if (normalizedStatus === 'expired' || normalizedStatus === 'rejected' || normalizedStatus === 'failed') {
    return CausewayOrderStatus.failed;
  }
  if (!normalizedStatus || normalizedStatus === 'unknown') return CausewayOrderStatus.unknown;
  return CausewayOrderStatus.submitted;
}

async function refreshOrderIntentStatus(tx: Prisma.TransactionClient, orderIntentId: string): Promise<void> {
  const orders = await tx.causewayOrder.findMany({
    where: { orderIntentId },
    select: { status: true },
  });
  const status = resolveOrderIntentStatus(orders.map((order) => order.status));
  if (!status) return;

  await tx.orderIntent.update({
    where: { id: orderIntentId },
    data: { status },
  });
}

function resolveOrderIntentStatus(statuses: CausewayOrderStatus[]): OrderIntentStatus | null {
  if (!statuses.length) return null;
  if (statuses.every((status) => status === CausewayOrderStatus.cancelled)) return OrderIntentStatus.cancelled;
  if (statuses.every((status) => status === CausewayOrderStatus.failed)) return OrderIntentStatus.failed;
  if (statuses.every((status) => status === CausewayOrderStatus.unknown)) return OrderIntentStatus.unknown;

  const hasAcceptedOrder = statuses.some((status) => (
    status === CausewayOrderStatus.submitted
    || status === CausewayOrderStatus.partially_filled
    || status === CausewayOrderStatus.filled
  ));
  const hasTerminalProblem = statuses.some((status) => status === CausewayOrderStatus.cancelled || status === CausewayOrderStatus.failed);
  if (hasAcceptedOrder && hasTerminalProblem) return OrderIntentStatus.partially_submitted;
  if (hasAcceptedOrder) return OrderIntentStatus.submitted;
  if (hasTerminalProblem) return OrderIntentStatus.failed;
  return null;
}

function normalizeClobStatus(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function toFiniteNumber(value: string | null): number | null {
  if (value == null || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
