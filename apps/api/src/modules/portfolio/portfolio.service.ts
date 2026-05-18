import { Injectable } from '@nestjs/common';
import { OrderIntentStatus, Prisma } from '@prisma/client';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { roundCurrency, toNullableNumber } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';
import { DataApiClient } from '../../integrations/polymarket/services/data-api.client';

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

    return {
      capability: positions.length ? 'degraded' : 'unavailable',
      dataSource: positions.length ? 'polymarket_data_api' : 'stub',
      items: positions.map((position) => ({
        id: position.id,
        marketId: position.marketId,
        outcomeId: position.outcomeId,
        clobTokenId: position.clobTokenId,
        size: toNullableNumber(position.size),
        avgPrice: toNullableNumber(position.avgPrice),
        currentPrice: toNullableNumber(position.currentPrice),
        currentValue: toNullableNumber(position.currentValue),
        pnl: toNullableNumber(position.pnl),
        syncedAt: position.syncedAt.toISOString(),
        market: position.market,
        outcome: position.outcome,
      })),
      refreshedAt: new Date().toISOString(),
      error: positions.length ? 'external position sync is not fully automated yet' : 'positions source is not wired yet',
    };
  }

  async orders(user: CurrentUser, status?: string) {
    const intents = await this.prisma.orderIntent.findMany({
      where: {
        userId: user.id,
        status: status ? mapPortfolioOrderStatus(status) : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
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

    return {
      capability: 'degraded',
      dataSource: 'local',
      items: intents.map((intent) => ({
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
      refreshedAt: new Date().toISOString(),
      error: null,
    };
  }

  trades(_user: CurrentUser) {
    return {
      capability: 'unavailable',
      dataSource: 'stub',
      items: [],
      refreshedAt: new Date().toISOString(),
      error: 'trades source is not wired yet',
    };
  }
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
