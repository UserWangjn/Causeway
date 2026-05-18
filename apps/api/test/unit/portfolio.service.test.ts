import { OrderIntentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../../src/common/decorators/current-user.decorator';
import type { PrismaService } from '../../src/database/prisma.service';
import type { DataApiClient } from '../../src/integrations/polymarket/services/data-api.client';
import { PortfolioService } from '../../src/modules/portfolio/portfolio.service';

describe('PortfolioService', () => {
  it('summarizes only the authenticated user local exposure', async () => {
    const externalPositionFindMany = vi.fn().mockResolvedValue([
      {
        currentValue: '12.50',
        pnl: '1.25',
      },
    ]);
    const causewayOrderFindMany = vi.fn().mockResolvedValue([
      {
        amountUsd: '10',
      },
      {
        amountUsd: '15.25',
      },
    ]);
    const service = createService({
      externalPosition: {
        findMany: externalPositionFindMany,
      },
      causewayOrder: {
        findMany: causewayOrderFindMany,
      },
    });

    const result = await service.summary(currentUser());

    expect(externalPositionFindMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      select: { currentValue: true, pnl: true },
    });
    expect(causewayOrderFindMany).toHaveBeenCalledWith({
      where: {
        orderIntent: { userId: 'user_1' },
        status: { in: ['submitted', 'partially_filled'] },
      },
      select: { amountUsd: true },
    });
    expect(result).toMatchObject({
      capability: 'degraded',
      cashAvailable: null,
      portfolioValue: 12.5,
      openPositionsValue: 12.5,
      openOrdersValue: 25.25,
      pnl: 1.25,
    });
  });

  it('lists local orders with user-scoped status filtering', async () => {
    const orderIntentFindMany = vi.fn().mockResolvedValue([
      {
        id: 'intent_1',
        status: 'dry_run_completed',
        executionMode: 'dry_run',
        totalAmountUsd: '10',
        createdAt: new Date('2026-05-18T00:00:00.000Z'),
        updatedAt: new Date('2026-05-18T00:01:00.000Z'),
        orders: [
          {
            id: 'order_1',
            marketId: 'market_1',
            outcomeId: 'outcome_1',
            clobTokenId: 'token_1',
            side: 'BUY',
            orderMode: 'limit',
            orderType: 'GTC',
            limitPrice: '0.5',
            estimatedFillPrice: '0.5',
            size: '20',
            amountUsd: '10',
            externalOrderId: null,
            status: 'dry_run_completed',
            errorMessage: null,
            market: {
              id: 'market_1',
              slug: 'market-one',
              question: 'Will market one resolve Yes?',
            },
            outcome: {
              id: 'outcome_1',
              label: 'Yes',
              clobTokenId: 'token_1',
            },
          },
        ],
      },
    ]);
    const service = createService({
      orderIntent: {
        findMany: orderIntentFindMany,
      },
    });

    const result = await service.orders(currentUser(), {
      status: 'filled',
      cursor: encodeTestCursor({
        v: 1,
        scope: 'portfolio_orders',
        id: 'intent_before',
        timestamp: '2026-05-18T00:00:00.000Z',
      }),
      limit: 25,
    });

    expect(orderIntentFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            userId: 'user_1',
            status: { in: [OrderIntentStatus.dry_run_completed] },
          },
          {
            OR: [
              { createdAt: { lt: new Date('2026-05-18T00:00:00.000Z') } },
              {
                AND: [
                  { createdAt: new Date('2026-05-18T00:00:00.000Z') },
                  { id: { gt: 'intent_before' } },
                ],
              },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 26,
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
    expect(result).toMatchObject({
      capability: 'degraded',
      dataSource: 'local',
      nextCursor: null,
      hasMore: false,
      items: [
        {
          intentId: 'intent_1',
          status: 'dry_run_completed',
          executionMode: 'dry_run',
          totalAmountUsd: 10,
          orders: [
            {
              id: 'order_1',
              limitPrice: 0.5,
              size: 20,
              amountUsd: 10,
              status: 'dry_run_completed',
            },
          ],
        },
      ],
    });
  });

  it('treats user-confirming intents as open portfolio orders', async () => {
    const orderIntentFindMany = vi.fn().mockResolvedValue([]);
    const service = createService({
      orderIntent: {
        findMany: orderIntentFindMany,
      },
    });

    await service.orders(currentUser(), { status: 'open', limit: 10 });

    expect(orderIntentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user_1',
          status: {
            in: [
              OrderIntentStatus.preview_ready,
              OrderIntentStatus.user_confirming,
              OrderIntentStatus.submitted,
              OrderIntentStatus.partially_submitted,
            ],
          },
        },
      }),
    );
  });

  it('returns positions in the public contract shape', async () => {
    const externalPositionFindMany = vi.fn().mockResolvedValue([
      {
        id: 'position_1',
        marketId: 'market_1',
        outcomeId: 'outcome_1',
        clobTokenId: 'token_1',
        size: '10',
        avgPrice: '0.40',
        currentPrice: '0.55',
        currentValue: '5.50',
        pnl: '1.50',
        syncedAt: new Date('2026-05-18T00:00:00.000Z'),
        market: {
          id: 'market_1',
          slug: 'market-one',
          question: 'Will market one resolve Yes?',
          icon: null,
          image: null,
        },
        outcome: {
          id: 'outcome_1',
          label: 'Yes',
          clobTokenId: 'token_1',
        },
      },
    ]);
    const service = createService({
      externalPosition: {
        findMany: externalPositionFindMany,
      },
    });

    const result = await service.positions(currentUser());

    expect(externalPositionFindMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
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
    expect(result).toMatchObject({
      capability: 'degraded',
      dataSource: 'polymarket_data_api',
      items: [
        {
          marketId: 'market_1',
          outcomeId: 'outcome_1',
          tokenId: 'token_1',
          title: 'Will market one resolve Yes?',
          outcomeLabel: 'Yes',
          size: 10,
          avgPrice: 0.4,
          currentPrice: 0.55,
          currentValue: 5.5,
          pnl: 1.5,
        },
      ],
    });
  });

  it('does not expose unresolved local position links as public position ids', async () => {
    const externalPositionFindMany = vi.fn().mockResolvedValue([
      {
        id: 'position_1',
        marketId: null,
        outcomeId: null,
        clobTokenId: 'token_1',
        size: '10',
        avgPrice: '0.40',
        currentPrice: '0.55',
        currentValue: '5.50',
        pnl: '1.50',
        syncedAt: new Date('2026-05-18T00:00:00.000Z'),
        market: null,
        outcome: null,
      },
    ]);
    const service = createService({
      externalPosition: {
        findMany: externalPositionFindMany,
      },
    });

    const result = await service.positions(currentUser());

    expect(result).toMatchObject({
      capability: 'degraded',
      dataSource: 'polymarket_data_api',
      items: [],
      error: 'some positions are not linked to local markets yet',
    });
  });

  it('returns an available empty positions page after a completed position sync', async () => {
    const externalPositionFindMany = vi.fn().mockResolvedValue([]);
    const syncRunFindFirst = vi.fn().mockResolvedValue({
      status: 'completed',
      error: null,
    });
    const service = createService({
      externalPosition: {
        findMany: externalPositionFindMany,
      },
      syncRun: {
        findFirst: syncRunFindFirst,
      },
    });

    const result = await service.positions(currentUser());

    expect(syncRunFindFirst).toHaveBeenCalledWith({
      where: {
        jobType: 'portfolio_positions_sync',
        scope: 'portfolio_positions',
        metadata: {
          path: ['userId'],
          equals: 'user_1',
        },
      },
      orderBy: { startedAt: 'desc' },
      select: {
        status: true,
        error: true,
      },
    });
    expect(result).toMatchObject({
      capability: 'available',
      dataSource: 'polymarket_data_api',
      items: [],
      error: null,
    });
  });

  it('syncs Data API positions into user-scoped local positions', async () => {
    const getCurrentPositions = vi.fn().mockResolvedValue([
      {
        asset: 'token_1',
        conditionId: 'condition_1',
        size: '12.5',
        averagePrice: '0.40',
        curPrice: '0.52',
        cashPnl: '1.50',
      },
    ]);
    const syncRunCreate = vi.fn().mockResolvedValue({ id: 'sync_run_1' });
    const syncRunUpdate = vi.fn().mockResolvedValue({
      id: 'sync_run_1',
      status: 'completed',
      fetchedCount: 1,
      upsertedCount: 1,
    });
    const externalPositionUpsert = vi.fn();
    const externalPositionDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const tx = {
      polymarketOutcome: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'outcome_1',
          marketId: 'market_1',
          market: {
            conditionId: 'condition_1',
          },
        }),
      },
      polymarketMarket: {
        findUnique: vi.fn(),
      },
      externalPosition: {
        upsert: externalPositionUpsert,
        deleteMany: externalPositionDeleteMany,
      },
    };
    const service = createService(
      {
        syncRun: {
          create: syncRunCreate,
          update: syncRunUpdate,
        },
        $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
      },
      { getCurrentPositions },
    );

    const result = await service.syncPositions(currentUser());

    expect(getCurrentPositions).toHaveBeenCalledWith('0x1111111111111111111111111111111111111111', {
      limit: 500,
      offset: 0,
      sizeThreshold: 0,
    });
    expect(syncRunCreate).toHaveBeenCalledWith({
      data: {
        jobType: 'portfolio_positions_sync',
        scope: 'portfolio_positions',
        status: 'running',
        metadata: {
          userId: 'user_1',
          walletAddress: '0x1111111111111111111111111111111111111111',
        },
      },
    });
    expect(externalPositionUpsert).toHaveBeenCalledWith({
      where: {
        userId_clobTokenId: {
          userId: 'user_1',
          clobTokenId: 'token_1',
        },
      },
      update: {
        marketId: 'market_1',
        outcomeId: 'outcome_1',
        size: 12.5,
        avgPrice: 0.4,
        currentPrice: 0.52,
        currentValue: 6.5,
        pnl: 1.5,
        rawPayload: {
          asset: 'token_1',
          conditionId: 'condition_1',
          size: '12.5',
          averagePrice: '0.40',
          curPrice: '0.52',
          cashPnl: '1.50',
        },
        syncedAt: expect.any(Date) as Date,
      },
      create: {
        userId: 'user_1',
        marketId: 'market_1',
        outcomeId: 'outcome_1',
        clobTokenId: 'token_1',
        size: 12.5,
        avgPrice: 0.4,
        currentPrice: 0.52,
        currentValue: 6.5,
        pnl: 1.5,
        rawPayload: {
          asset: 'token_1',
          conditionId: 'condition_1',
          size: '12.5',
          averagePrice: '0.40',
          curPrice: '0.52',
          cashPnl: '1.50',
        },
        syncedAt: expect.any(Date) as Date,
      },
    });
    expect(externalPositionDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        clobTokenId: {
          notIn: ['token_1'],
        },
      },
    });
    expect(syncRunUpdate).toHaveBeenLastCalledWith({
      where: { id: 'sync_run_1' },
      data: {
        status: 'completed',
        finishedAt: expect.any(Date) as Date,
        fetchedCount: 1,
        upsertedCount: 1,
        metadata: {
          userId: 'user_1',
          skippedCount: 0,
          deletedStaleCount: 0,
        },
      },
    });
    expect(result).toMatchObject({
      runId: 'sync_run_1',
      status: 'completed',
      capability: 'available',
      fetchedCount: 1,
      upsertedCount: 1,
      skippedCount: 0,
      deletedStaleCount: 0,
    });
  });

  it('paginates all Data API positions before deleting stale local positions', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      asset: `token_${index}`,
      size: '1',
    }));
    const getCurrentPositions = vi.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce([]);
    const externalPositionDeleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const tx = {
      polymarketOutcome: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      polymarketMarket: {
        findUnique: vi.fn(),
      },
      externalPosition: {
        upsert: vi.fn(),
        deleteMany: externalPositionDeleteMany,
      },
    };
    const service = createService(
      {
        syncRun: {
          create: vi.fn().mockResolvedValue({ id: 'sync_run_1' }),
          update: vi.fn().mockResolvedValue({
            id: 'sync_run_1',
            status: 'completed',
            fetchedCount: 500,
            upsertedCount: 500,
          }),
        },
        $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
      },
      { getCurrentPositions },
    );

    const result = await service.syncPositions(currentUser());

    expect(getCurrentPositions).toHaveBeenNthCalledWith(1, '0x1111111111111111111111111111111111111111', {
      limit: 500,
      offset: 0,
      sizeThreshold: 0,
    });
    expect(getCurrentPositions).toHaveBeenNthCalledWith(2, '0x1111111111111111111111111111111111111111', {
      limit: 500,
      offset: 500,
      sizeThreshold: 0,
    });
    expect(externalPositionDeleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        clobTokenId: {
          notIn: firstPage.map((position) => position.asset),
        },
      },
    });
    expect(result).toMatchObject({
      fetchedCount: 500,
      upsertedCount: 500,
      deletedStaleCount: 2,
    });
  });

  it('records a failed sync run when Data API position sync fails', async () => {
    const getCurrentPositions = vi.fn().mockRejectedValue(new Error('data api unavailable'));
    const syncRunUpdate = vi.fn();
    const service = createService(
      {
        syncRun: {
          create: vi.fn().mockResolvedValue({ id: 'sync_run_1' }),
          update: syncRunUpdate,
        },
      },
      { getCurrentPositions },
    );

    await expect(service.syncPositions(currentUser())).rejects.toThrow('data api unavailable');
    expect(syncRunUpdate).toHaveBeenCalledWith({
      where: { id: 'sync_run_1' },
      data: {
        status: 'failed',
        finishedAt: expect.any(Date) as Date,
        error: 'data api unavailable',
      },
    });
  });

  it('lists local completed orders as degraded trade history', async () => {
    const causewayOrderFindMany = vi.fn().mockResolvedValue([
      {
        id: 'order_1',
        orderIntentId: 'intent_1',
        marketId: 'market_1',
        outcomeId: 'outcome_1',
        clobTokenId: 'token_1',
        side: 'BUY',
        orderMode: 'limit',
        orderType: 'GTC',
        limitPrice: '0.50',
        estimatedFillPrice: '0.51',
        size: '20',
        amountUsd: '10.20',
        externalOrderId: null,
        status: 'dry_run_completed',
        updatedAt: new Date('2026-05-18T00:02:00.000Z'),
        orderIntent: {
          id: 'intent_1',
          executionMode: 'dry_run',
          status: 'dry_run_completed',
        },
        market: {
          id: 'market_1',
          slug: 'market-one',
          question: 'Will market one resolve Yes?',
        },
        outcome: {
          id: 'outcome_1',
          label: 'Yes',
          clobTokenId: 'token_1',
        },
      },
    ]);
    const service = createService({
      causewayOrder: {
        findMany: causewayOrderFindMany,
      },
    });

    const result = await service.trades(currentUser(), {
      cursor: encodeTestCursor({
        v: 1,
        scope: 'portfolio_trades',
        id: 'order_before',
        timestamp: '2026-05-18T00:02:00.000Z',
      }),
      limit: 25,
    });

    expect(causewayOrderFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            orderIntent: { userId: 'user_1' },
            status: { in: ['dry_run_completed', 'filled', 'partially_filled'] },
          },
          {
            OR: [
              { updatedAt: { lt: new Date('2026-05-18T00:02:00.000Z') } },
              {
                AND: [
                  { updatedAt: new Date('2026-05-18T00:02:00.000Z') },
                  { id: { gt: 'order_before' } },
                ],
              },
            ],
          },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 26,
      include: {
        orderIntent: {
          select: {
            id: true,
            executionMode: true,
            status: true,
          },
        },
        market: {
          select: { id: true, slug: true, question: true },
        },
        outcome: {
          select: { id: true, label: true, clobTokenId: true },
        },
      },
    });
    expect(result).toMatchObject({
      capability: 'degraded',
      dataSource: 'local',
      nextCursor: null,
      hasMore: false,
      error: 'real trade history source is not wired yet; returning local completed orders',
      items: [
        {
          tradeId: 'order_1',
          orderId: 'order_1',
          intentId: 'intent_1',
          executionMode: 'dry_run',
          price: 0.51,
          size: 20,
          amountUsd: 10.2,
          status: 'dry_run_completed',
          tradedAt: '2026-05-18T00:02:00.000Z',
        },
      ],
    });
  });

  it('returns a local empty trades page when no local trades exist', async () => {
    const service = createService({
      causewayOrder: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await service.trades(currentUser(), {
      cursor: encodeTestCursor({
        v: 1,
        scope: 'portfolio_trades',
        id: 'trade_before',
        timestamp: '2026-05-18T00:02:00.000Z',
      }),
      limit: 10,
    });

    expect(result).toMatchObject({
      capability: 'degraded',
      dataSource: 'local',
      items: [],
      nextCursor: null,
      hasMore: false,
      error: 'real trade history source is not wired yet; returning local completed orders',
    });
  });
});

function createService(prisma: unknown, dataApiOverrides: Partial<DataApiClient> = {}): PortfolioService {
  const dataApiClient = {
    getCapability: vi.fn().mockReturnValue({
      status: 'unavailable',
      reason: 'fixture data api unavailable',
    }),
    getCurrentPositions: vi.fn(),
    ...dataApiOverrides,
  } as unknown as DataApiClient;

  return new PortfolioService(dataApiClient, prisma as PrismaService);
}

function encodeTestCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function currentUser(): CurrentUser {
  return {
    id: 'user_1',
    walletAddress: '0x1111111111111111111111111111111111111111',
    chainId: 137,
  };
}
