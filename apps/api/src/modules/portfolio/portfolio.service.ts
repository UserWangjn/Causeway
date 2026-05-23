import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { OrderIntentStatus, Prisma } from '@prisma/client';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiException } from '../../common/errors/api.exception';
import {
  decodeOpaqueCursor,
  encodeOpaqueCursor,
  invalidPaginationCursor,
  isRecord,
} from '../../common/pagination/opaque-cursor';
import { roundCurrency, toNullableNumber } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';
import {
  normalizeDataApiPosition,
  type NormalizedDataApiPosition,
} from '../../integrations/polymarket/data-api-position-normalizer';
import { DataApiClient } from '../../integrations/polymarket/services/data-api.client';
import { PortfolioOrdersQueryDto } from './dto/portfolio-orders-query.dto';
import { PortfolioTradesQueryDto } from './dto/portfolio-trades-query.dto';

const CASH_BALANCE_UNAVAILABLE_REASON = 'cash balance source is not wired yet';
const LOCAL_TRADE_HISTORY_REASON = 'trade history is based on monitored Causeway orders; external non-Causeway trades are excluded';

const PORTFOLIO_MARKET_SELECT = Prisma.validator<Prisma.PolymarketMarketSelect>()({
  id: true,
  slug: true,
  question: true,
});

const PORTFOLIO_POSITION_MARKET_SELECT = Prisma.validator<Prisma.PolymarketMarketSelect>()({
  ...PORTFOLIO_MARKET_SELECT,
  icon: true,
  image: true,
});

const PORTFOLIO_OUTCOME_SELECT = Prisma.validator<Prisma.PolymarketOutcomeSelect>()({
  id: true,
  label: true,
  clobTokenId: true,
});

const PORTFOLIO_POSITION_SELECT = Prisma.validator<Prisma.ExternalPositionSelect>()({
  marketId: true,
  outcomeId: true,
  clobTokenId: true,
  size: true,
  avgPrice: true,
  currentPrice: true,
  currentValue: true,
  pnl: true,
  market: {
    select: PORTFOLIO_POSITION_MARKET_SELECT,
  },
  outcome: {
    select: PORTFOLIO_OUTCOME_SELECT,
  },
});

const PORTFOLIO_ORDER_INTENT_SELECT = Prisma.validator<Prisma.OrderIntentSelect>()({
  id: true,
  status: true,
  executionMode: true,
  totalAmountUsd: true,
  createdAt: true,
  updatedAt: true,
  orders: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      marketId: true,
      outcomeId: true,
      clobTokenId: true,
      side: true,
      orderMode: true,
      orderType: true,
      limitPrice: true,
      estimatedFillPrice: true,
      size: true,
      amountUsd: true,
      externalOrderId: true,
      status: true,
      errorMessage: true,
      market: {
        select: PORTFOLIO_MARKET_SELECT,
      },
      outcome: {
        select: PORTFOLIO_OUTCOME_SELECT,
      },
    },
  },
});

const PORTFOLIO_TRADE_SELECT = Prisma.validator<Prisma.CausewayOrderSelect>()({
  id: true,
  orderIntentId: true,
  marketId: true,
  outcomeId: true,
  clobTokenId: true,
  side: true,
  orderMode: true,
  orderType: true,
  limitPrice: true,
  estimatedFillPrice: true,
  size: true,
  amountUsd: true,
  externalOrderId: true,
  status: true,
  updatedAt: true,
  orderIntent: {
    select: {
      id: true,
      executionMode: true,
      status: true,
    },
  },
  market: {
    select: PORTFOLIO_MARKET_SELECT,
  },
  outcome: {
    select: PORTFOLIO_OUTCOME_SELECT,
  },
});

@Injectable()
export class PortfolioService {
  constructor(
    @Inject(DataApiClient)
    private readonly dataApiClient: DataApiClient,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async summary(user: CurrentUser) {
    const capability = this.dataApiClient.getCapability();
    const positions = await this.prisma.externalPosition.findMany({
      where: { userId: user.id },
      select: { currentValue: true, pnl: true },
    });
    const openOrders = await this.prisma.causewayOrder.findMany({
      where: {
        orderIntent: { userId: user.id, executionMode: 'real' },
        status: { in: ['submitted', 'partially_filled'] },
      },
      select: { amountUsd: true },
    });
    const openPositionsValue = sumNullable(positions.map((position) => position.currentValue));
    const pnl = sumNullable(positions.map((position) => position.pnl));
    const openOrdersValue = sumNullable(openOrders.map((order) => order.amountUsd));
    const hasLocalExposure = positions.length > 0 || openOrders.length > 0;
    const summaryState = hasLocalExposure
      ? {
          capability: 'degraded' as const,
          dataSource: resolvePortfolioSummaryDataSource(positions.length, openOrders.length),
          error: CASH_BALANCE_UNAVAILABLE_REASON,
        }
      : resolveEmptySummaryState(await this.findLatestPositionSync(user.id), capability);

    return {
      capability: summaryState.capability,
      dataSource: summaryState.dataSource,
      cashAvailable: null,
      portfolioValue: openPositionsValue,
      openPositionsValue,
      openOrdersValue,
      pnl,
      refreshedAt: new Date().toISOString(),
      error: summaryState.error,
    };
  }

  async positions(user: CurrentUser) {
    const positions = await this.prisma.externalPosition.findMany({
      where: { userId: user.id },
      orderBy: { syncedAt: 'desc' },
      select: PORTFOLIO_POSITION_SELECT,
    });
    const items = positions.flatMap((position) => {
      if (!position.marketId || !position.outcomeId || !position.market || !position.outcome) {
        return [];
      }

      return [
        {
          marketId: position.marketId,
          outcomeId: position.outcomeId,
          tokenId: position.clobTokenId,
          title: position.market.question,
          outcomeLabel: position.outcome.label,
          size: toNullableNumber(position.size),
          avgPrice: toNullableNumber(position.avgPrice),
          currentPrice: toNullableNumber(position.currentPrice),
          currentValue: toNullableNumber(position.currentValue),
          pnl: toNullableNumber(position.pnl),
        },
      ];
    });
    const hasUnresolvedPositions = items.length !== positions.length;
    const latestSync = items.length || hasUnresolvedPositions ? null : await this.findLatestPositionSync(user.id);
    const emptyPositionState = resolveEmptyPositionState(latestSync);

    return {
      capability: items.length || hasUnresolvedPositions ? 'degraded' : emptyPositionState.capability,
      dataSource: items.length || hasUnresolvedPositions ? 'polymarket_data_api' : emptyPositionState.dataSource,
      items,
      refreshedAt: new Date().toISOString(),
      error: hasUnresolvedPositions
        ? 'some positions are not linked to local markets yet'
        : items.length
          ? 'external position sync is not fully automated yet'
          : emptyPositionState.error,
    };
  }

  private findLatestPositionSync(userId: string) {
    return this.prisma.syncRun.findFirst({
      where: {
        jobType: 'portfolio_positions_sync',
        scope: 'portfolio_positions',
        metadata: {
          path: ['userId'],
          equals: userId,
        },
      },
      orderBy: { startedAt: 'desc' },
      select: {
        status: true,
        error: true,
      },
    });
  }

  async syncPositions(user: CurrentUser) {
    const capability = this.dataApiClient.getCapability();
    if (capability.status !== 'available') {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'CAPABILITY_UNAVAILABLE',
        capability.reason ?? 'Polymarket Data API is unavailable',
      );
    }

    const pageSize = 500;
    const syncRun = await this.prisma.syncRun.create({
      data: {
        jobType: 'portfolio_positions_sync',
        scope: 'portfolio_positions',
        status: 'running',
        metadata: toJson({
          userId: user.id,
        }),
      },
    });

    try {
      const payloads = await this.loadCurrentPositionPayloads(user.walletAddress, pageSize);
      const positions = dedupePositionsByToken(payloads.flatMap((payload) => normalizeDataApiPosition(payload) ?? []));
      const skippedCount = payloads.length - positions.length;
      const { upsertedCount, deletedStaleCount } = await this.prisma.$transaction(async (tx) => {
        const syncedAt = new Date();
        for (const position of positions) {
          const link = await resolvePositionLink(tx, position);
          await tx.externalPosition.upsert({
            where: {
              userId_clobTokenId: {
                userId: user.id,
                clobTokenId: position.clobTokenId,
              },
            },
            update: {
              marketId: link.marketId,
              outcomeId: link.outcomeId,
              size: position.size,
              avgPrice: position.avgPrice,
              currentPrice: position.currentPrice,
              currentValue: position.currentValue,
              pnl: position.pnl,
              rawPayload: toJson(position.rawPayload),
              syncedAt,
            },
            create: {
              userId: user.id,
              marketId: link.marketId,
              outcomeId: link.outcomeId,
              clobTokenId: position.clobTokenId,
              size: position.size,
              avgPrice: position.avgPrice,
              currentPrice: position.currentPrice,
              currentValue: position.currentValue,
              pnl: position.pnl,
              rawPayload: toJson(position.rawPayload),
              syncedAt,
            },
          });
        }

        const staleDelete = positions.length
          ? await tx.externalPosition.deleteMany({
              where: {
                userId: user.id,
                clobTokenId: {
                  notIn: positions.map((position) => position.clobTokenId),
                },
              },
            })
          : await tx.externalPosition.deleteMany({
              where: { userId: user.id },
            });

        return {
          upsertedCount: positions.length,
          deletedStaleCount: staleDelete.count,
        };
      });

      const completedRun = await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          fetchedCount: payloads.length,
          upsertedCount,
          metadata: toJson({
            userId: user.id,
            skippedCount,
            deletedStaleCount,
          }),
        },
      });

      return {
        runId: completedRun.id,
        status: completedRun.status,
        capability: 'available',
        fetchedCount: completedRun.fetchedCount,
        upsertedCount: completedRun.upsertedCount,
        skippedCount,
        deletedStaleCount,
      };
    } catch (error) {
      await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  private async loadCurrentPositionPayloads(walletAddress: string, pageSize: number): Promise<Record<string, unknown>[]> {
    const maxPages = 20;
    const payloads: Record<string, unknown>[] = [];
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const offset = pageIndex * pageSize;
      const page = await this.dataApiClient.getCurrentPositions(walletAddress, {
        limit: pageSize,
        offset,
        sizeThreshold: 0,
      });
      payloads.push(...page);
      if (page.length < pageSize) break;
    }
    if (payloads.length >= pageSize * maxPages) {
      throw new ApiException(
        HttpStatus.BAD_GATEWAY,
        'POLYMARKET_API_ERROR',
        'Data API position pagination did not terminate within the configured page limit',
        { pageSize, maxPages },
      );
    }
    return payloads;
  }

  async orders(user: CurrentUser, query: PortfolioOrdersQueryDto = {}) {
    const limit = query.limit ?? 50;
    const cursor = decodeTimestampCursor(query.cursor, 'portfolio_orders');
    const where = buildPortfolioOrdersWhere(user.id, query.status, cursor);
    const intents = await this.prisma.orderIntent.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      select: PORTFOLIO_ORDER_INTENT_SELECT,
    });
    const items = intents.slice(0, limit);

    return {
      capability: 'degraded',
      dataSource: 'local',
      items: items.map((intent) => ({
        intentId: intent.id,
        status: intent.status,
        executionMode: intent.executionMode,
        totalAmountUsd: toNullableNumber(intent.totalAmountUsd),
        createdAt: intent.createdAt.toISOString(),
        updatedAt: intent.updatedAt.toISOString(),
        orders: intent.orders.map((order) => ({
          id: order.id,
          marketId: order.marketId,
          outcomeId: order.outcomeId,
          clobTokenId: order.clobTokenId,
          side: order.side,
          orderMode: order.orderMode,
          orderType: order.orderType,
          limitPrice: toNullableNumber(order.limitPrice),
          estimatedFillPrice: toNullableNumber(order.estimatedFillPrice),
          size: toNullableNumber(order.size),
          amountUsd: toNullableNumber(order.amountUsd),
          externalOrderId: order.externalOrderId,
          status: order.status,
          errorMessage: order.errorMessage,
          market: order.market,
          outcome: order.outcome,
        })),
      })),
      nextCursor: intents.length > limit ? encodeTimestampCursor('portfolio_orders', items.at(-1)) : null,
      hasMore: intents.length > limit,
      refreshedAt: new Date().toISOString(),
      error: null,
    };
  }

  async trades(user: CurrentUser, query: PortfolioTradesQueryDto = {}) {
    const limit = query.limit ?? 50;
    const cursor = decodeTimestampCursor(query.cursor, 'portfolio_trades');
    const where = buildPortfolioTradesWhere(user.id, cursor);
    const orders = await this.prisma.causewayOrder.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      select: PORTFOLIO_TRADE_SELECT,
    });
    const items = orders.slice(0, limit);

    if (!items.length) {
      return {
        capability: 'available',
        dataSource: 'local',
        items: [],
        nextCursor: null,
        hasMore: false,
        refreshedAt: new Date().toISOString(),
        error: null,
      };
    }

    return {
      capability: 'degraded',
      dataSource: 'local',
      items: items.map((order) => ({
        tradeId: order.id,
        orderId: order.id,
        intentId: order.orderIntentId,
        executionMode: order.orderIntent.executionMode,
        intentStatus: order.orderIntent.status,
        marketId: order.marketId,
        outcomeId: order.outcomeId,
        tokenId: order.clobTokenId,
        side: order.side,
        orderMode: order.orderMode,
        orderType: order.orderType,
        price: firstNullableNumber(order.estimatedFillPrice, order.limitPrice),
        size: toNullableNumber(order.size),
        amountUsd: toNullableNumber(order.amountUsd),
        externalOrderId: order.externalOrderId,
        status: order.status,
        market: order.market,
        outcome: order.outcome,
        tradedAt: order.updatedAt.toISOString(),
      })),
      nextCursor: orders.length > limit ? encodeTimestampCursor('portfolio_trades', items.at(-1)) : null,
      hasMore: orders.length > limit,
      refreshedAt: new Date().toISOString(),
      error: LOCAL_TRADE_HISTORY_REASON,
    };
  }
}

function dedupePositionsByToken(positions: NormalizedDataApiPosition[]): NormalizedDataApiPosition[] {
  return [...new Map(positions.map((position) => [position.clobTokenId, position])).values()];
}

async function resolvePositionLink(
  tx: Prisma.TransactionClient,
  position: NormalizedDataApiPosition,
): Promise<{ marketId: string | null; outcomeId: string | null }> {
  const outcome = await tx.polymarketOutcome.findUnique({
    where: { clobTokenId: position.clobTokenId },
    select: {
      id: true,
      marketId: true,
      market: {
        select: {
          conditionId: true,
        },
      },
    },
  });
  if (outcome && (!position.conditionId || outcome.market.conditionId === position.conditionId)) {
    return {
      marketId: outcome.marketId,
      outcomeId: outcome.id,
    };
  }

  if (position.conditionId) {
    const market = await tx.polymarketMarket.findUnique({
      where: { conditionId: position.conditionId },
      select: { id: true },
    });
    return {
      marketId: market?.id ?? null,
      outcomeId: null,
    };
  }

  return {
    marketId: null,
    outcomeId: null,
  };
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function sumNullable(values: unknown[]): number | null {
  const numbers = values.map(toNullableNumber).filter((value): value is number => value != null);
  if (!numbers.length) return null;
  return roundCurrency(numbers.reduce((sum, value) => sum + value, 0));
}

function firstNullableNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toNullableNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function resolvePortfolioSummaryDataSource(positionCount: number, openOrderCount: number): 'polymarket_data_api' | 'local' | 'stub' {
  if (positionCount > 0) return 'polymarket_data_api';
  if (openOrderCount > 0) return 'local';
  return 'stub';
}

function resolveEmptySummaryState(
  latestSync: { status: string; error: string | null } | null,
  dataApiCapability: { status: 'available' | 'unavailable'; reason: string | null },
): {
  capability: 'degraded' | 'unavailable';
  dataSource: 'polymarket_data_api' | 'stub';
  error: string | null;
} {
  if (latestSync?.status === 'completed') {
    return {
      capability: 'degraded',
      dataSource: 'polymarket_data_api',
      error: CASH_BALANCE_UNAVAILABLE_REASON,
    };
  }
  if (latestSync?.status === 'failed') {
    return {
      capability: 'unavailable',
      dataSource: 'stub',
      error: latestSync.error ?? 'positions sync failed',
    };
  }
  if (dataApiCapability.status === 'unavailable') {
    return {
      capability: 'unavailable',
      dataSource: 'stub',
      error: dataApiCapability.reason ?? 'positions sync is unavailable',
    };
  }
  return {
    capability: 'degraded',
    dataSource: 'stub',
    error: 'positions have not been synced yet',
  };
}

function resolveEmptyPositionState(latestSync: { status: string; error: string | null } | null): {
  capability: 'available' | 'degraded' | 'unavailable';
  dataSource: 'polymarket_data_api' | 'stub';
  error: string | null;
} {
  if (latestSync?.status === 'completed') {
    return {
      capability: 'available',
      dataSource: 'polymarket_data_api',
      error: null,
    };
  }
  if (latestSync?.status === 'failed') {
    return {
      capability: 'unavailable',
      dataSource: 'stub',
      error: latestSync.error ?? 'positions sync failed',
    };
  }
  return {
    capability: 'degraded',
    dataSource: 'stub',
    error: 'positions have not been synced yet',
  };
}

type TimestampCursorScope = 'portfolio_orders' | 'portfolio_trades';

type TimestampCursorRecord = {
  id: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type DecodedTimestampCursor = {
  id: string;
  timestamp: Date;
};

function buildPortfolioOrdersWhere(
  userId: string,
  status: string | undefined,
  cursor: DecodedTimestampCursor | null,
): Prisma.OrderIntentWhereInput {
  const base: Prisma.OrderIntentWhereInput = {
    userId,
    executionMode: 'real',
    ...portfolioOrderStatusWhere(status),
  };
  if (!cursor) return base;

  return {
    AND: [
      base,
      {
        OR: [
          { createdAt: { lt: cursor.timestamp } },
          {
            AND: [
              { createdAt: cursor.timestamp },
              { id: { gt: cursor.id } },
            ],
          },
        ],
      },
    ],
  };
}

function buildPortfolioTradesWhere(userId: string, cursor: DecodedTimestampCursor | null): Prisma.CausewayOrderWhereInput {
  const base: Prisma.CausewayOrderWhereInput = {
    orderIntent: {
      userId,
      executionMode: 'real',
    },
    status: { in: ['filled', 'partially_filled'] },
  };
  if (!cursor) return base;

  return {
    AND: [
      base,
      {
        OR: [
          { updatedAt: { lt: cursor.timestamp } },
          {
            AND: [
              { updatedAt: cursor.timestamp },
              { id: { gt: cursor.id } },
            ],
          },
        ],
      },
    ],
  };
}

function encodeTimestampCursor(scope: TimestampCursorScope, record: TimestampCursorRecord | undefined): string | null {
  if (!record) return null;
  const timestamp = scope === 'portfolio_orders' ? record.createdAt : record.updatedAt;
  if (!timestamp) return null;

  return encodeOpaqueCursor({
    v: 1,
    scope,
    id: record.id,
    timestamp: timestamp.toISOString(),
  });
}

function decodeTimestampCursor(cursor: string | undefined, expectedScope: TimestampCursorScope): DecodedTimestampCursor | null {
  if (!cursor) return null;
  const decoded = decodeOpaqueCursor(cursor);
  if (
    !isRecord(decoded)
    || decoded.v !== 1
    || decoded.scope !== expectedScope
    || typeof decoded.id !== 'string'
    || typeof decoded.timestamp !== 'string'
  ) {
    throw invalidPaginationCursor();
  }

  const timestamp = new Date(decoded.timestamp);
  if (Number.isNaN(timestamp.getTime())) {
    throw invalidPaginationCursor();
  }

  return {
    id: decoded.id,
    timestamp,
  };
}

function portfolioOrderStatusWhere(status: string | undefined): Prisma.OrderIntentWhereInput {
  if (!status) return {};
  if (status === 'open') {
    return {
      status: {
        in: [
          OrderIntentStatus.preview_ready,
          OrderIntentStatus.user_confirming,
          OrderIntentStatus.submitted,
          OrderIntentStatus.partially_submitted,
          OrderIntentStatus.unknown,
        ],
      },
    };
  }
  if (status === 'filled') {
    return {
      orders: {
        some: {
          status: { in: ['filled', 'partially_filled'] },
        },
      },
    };
  }
  if (status === 'cancelled') return { status: OrderIntentStatus.cancelled };
  if (status === 'failed') return { status: OrderIntentStatus.failed };
  return {};
}
