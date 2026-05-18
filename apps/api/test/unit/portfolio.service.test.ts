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
        status: { in: ['preview_ready', 'submitted', 'partially_filled'] },
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

    const result = await service.orders(currentUser(), { status: 'filled', cursor: 'intent_before', limit: 25 });

    expect(orderIntentFindMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        status: { in: [OrderIntentStatus.dry_run_completed] },
      },
      orderBy: { createdAt: 'desc' },
      cursor: { id: 'intent_before' },
      skip: 1,
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

  it('returns an explicit unavailable trades capability with pagination fields', () => {
    const service = createService({});

    const result = service.trades(currentUser(), { cursor: 'trade_before', limit: 10 });

    expect(result).toMatchObject({
      capability: 'unavailable',
      dataSource: 'stub',
      items: [],
      nextCursor: null,
      hasMore: false,
      error: 'trades source is not wired yet',
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

function currentUser(): CurrentUser {
  return {
    id: 'user_1',
    walletAddress: '0x1111111111111111111111111111111111111111',
    chainId: 137,
  };
}
