import { HttpStatus, Injectable } from '@nestjs/common';
import { OrderIntentStatus, Prisma } from '@prisma/client';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiException } from '../../common/errors/api.exception';
import { roundCurrency, toNullableNumber } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';
import {
  normalizeDataApiPosition,
  type NormalizedDataApiPosition,
} from '../../integrations/polymarket/data-api-position-normalizer';
import { DataApiClient } from '../../integrations/polymarket/services/data-api.client';
import { PortfolioOrdersQueryDto } from './dto/portfolio-orders-query.dto';
import { PortfolioTradesQueryDto } from './dto/portfolio-trades-query.dto';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly dataApiClient: DataApiClient,
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
        orderIntent: { userId: user.id },
        status: { in: ['preview_ready', 'submitted', 'partially_filled'] },
      },
      select: { amountUsd: true },
    });
    const openPositionsValue = sumNullable(positions.map((position) => position.currentValue));
    const pnl = sumNullable(positions.map((position) => position.pnl));
    const openOrdersValue = sumNullable(openOrders.map((order) => order.amountUsd));

    return {
      capability: positions.length || openOrders.length ? 'degraded' : capability.status,
      dataSource: positions.length ? 'polymarket_data_api' : 'stub',
      cashAvailable: null,
      portfolioValue: openPositionsValue,
      openPositionsValue,
      openOrdersValue,
      pnl,
      refreshedAt: new Date().toISOString(),
      error: capability.reason,
    };
  }

  async positions(user: CurrentUser) {
    const positions = await this.prisma.externalPosition.findMany({
      where: { userId: user.id },
      orderBy: { syncedAt: 'desc' },
      include: {
        market: {
          select: {
            id: true,
            slug: true,
            question: true,
            icon: true,
            image: true,
          },
        },
        outcome: {
          select: {
            id: true,
            label: true,
            clobTokenId: true,
          },
        },
      },
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

    return {
      capability: items.length || hasUnresolvedPositions ? 'degraded' : 'unavailable',
      dataSource: items.length || hasUnresolvedPositions ? 'polymarket_data_api' : 'stub',
      items,
      refreshedAt: new Date().toISOString(),
      error: hasUnresolvedPositions
        ? 'some positions are not linked to local markets yet'
        : items.length
          ? 'external position sync is not fully automated yet'
          : 'positions source is not wired yet',
    };
  }

  async syncPositions(user: CurrentUser) {
    const pageSize = 500;
    const syncRun = await this.prisma.syncRun.create({
      data: {
        jobType: 'portfolio_positions_sync',
        scope: 'portfolio_positions',
        status: 'running',
        metadata: toJson({
          userId: user.id,
          walletAddress: user.walletAddress,
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
    const intents = await this.prisma.orderIntent.findMany({
      where: {
        userId: user.id,
        status: query.status ? mapPortfolioOrderStatus(query.status) : undefined,
      },
      orderBy: { createdAt: 'desc' },
      cursor: query.cursor ? { id: query.cursor } : undefined,
      skip: query.cursor ? 1 : 0,
      take: limit + 1,
      include: {
        orders: {
          orderBy: { createdAt: 'asc' },
          include: {
            market: {
              select: { id: true, slug: true, question: true },
            },
            outcome: {
              select: { id: true, label: true, clobTokenId: true },
            },
          },
        },
      },
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
      nextCursor: intents.length > limit ? items.at(-1)?.id ?? null : null,
      hasMore: intents.length > limit,
      refreshedAt: new Date().toISOString(),
      error: null,
    };
  }

  trades(_user: CurrentUser, _query: PortfolioTradesQueryDto = {}) {
    return {
      capability: 'unavailable',
      dataSource: 'stub',
      items: [],
      nextCursor: null,
      hasMore: false,
      refreshedAt: new Date().toISOString(),
      error: 'trades source is not wired yet',
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

function mapPortfolioOrderStatus(status: string): Prisma.EnumOrderIntentStatusFilter<'OrderIntent'> | undefined {
  if (status === 'open') {
    return {
      in: [OrderIntentStatus.preview_ready, OrderIntentStatus.submitted, OrderIntentStatus.partially_submitted],
    };
  }
  if (status === 'filled') return { in: [OrderIntentStatus.dry_run_completed] };
  if (status === 'cancelled') return { equals: OrderIntentStatus.cancelled };
  if (status === 'failed') return { equals: OrderIntentStatus.failed };
  return undefined;
}
