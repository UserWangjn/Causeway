import { OrderIntentStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../../src/common/decorators/current-user.decorator';
import type { PrismaService } from '../../src/database/prisma.service';
import type { DataApiClient } from '../../src/integrations/polymarket/services/data-api.client';
import { PortfolioService } from '../../src/modules/portfolio/portfolio.service';
import type { TradingService } from '../../src/modules/trading/trading.service';

describe('PortfolioService', () => {
  it('summarizes only the authenticated user account exposure', async () => {
    const externalPositionFindMany = vi.fn().mockResolvedValue([
      {
        currentValue: '12.50',
        pnl: '1.25',
      },
    ]);
    const service = createService({
      externalPosition: {
        findMany: externalPositionFindMany,
      },
    }, {}, tradingBalance('9000000'));

    const result = await service.summary(currentUser());

    expect(externalPositionFindMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      select: { currentValue: true, pnl: true },
    });
    expect(result).toMatchObject({
      capability: 'available',
      dataSource: 'polymarket_data_api',
      cashAvailable: 9,
      portfolioValue: 21.5,
      openPositionsValue: 12.5,
      openOrdersValue: null,
      pnl: 1.25,
      error: null,
    });
  });

  it('returns degraded empty summary when positions have not been synced yet', async () => {
    const syncRunFindFirst = vi.fn().mockResolvedValue(null);
    const service = createService(
      {
        externalPosition: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        causewayOrder: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        syncRun: {
          findFirst: syncRunFindFirst,
        },
      },
      {
        getCapability: vi.fn().mockReturnValue({
          status: 'available',
          reason: null,
        }),
      },
    );

    const result = await service.summary(currentUser());

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
      capability: 'degraded',
      dataSource: 'pending_sync',
      cashAvailable: null,
      portfolioValue: null,
      openPositionsValue: null,
      openOrdersValue: null,
      pnl: null,
      error: 'positions have not been synced yet',
    });
  });

  it('keeps empty summary degraded after a completed empty position sync because cash balance is unavailable', async () => {
    const service = createService({
      externalPosition: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      causewayOrder: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      syncRun: {
        findFirst: vi.fn().mockResolvedValue({
          status: 'completed',
          error: null,
        }),
      },
    });

    const result = await service.summary(currentUser());

    expect(result).toMatchObject({
      capability: 'degraded',
      dataSource: 'polymarket_data_api',
      cashAvailable: null,
      error: 'Trading wallet balance has not been refreshed yet.',
    });
  });

  it('returns unavailable empty summary when position sync capability is unavailable', async () => {
    const service = createService({
      externalPosition: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      causewayOrder: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      syncRun: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const result = await service.summary(currentUser());

    expect(result).toMatchObject({
      capability: 'unavailable',
      dataSource: 'unavailable',
      cashAvailable: null,
      error: 'fixture data api unavailable',
    });
  });

  it('lists Causeway order ledger records with user-scoped status filtering', async () => {
    const orderIntentFindMany = vi.fn().mockResolvedValue([
      {
        id: 'intent_1',
        status: 'submitted',
        executionMode: 'real',
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
            externalOrderId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            status: 'filled',
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
            executionMode: 'real',
            orders: {
              some: {
                status: { in: ['filled', 'partially_filled'] },
              },
            },
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
      select: {
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
              select: { id: true, slug: true, question: true, icon: true, image: true },
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
      dataSource: 'causeway_order_ledger',
      nextCursor: null,
      hasMore: false,
      items: [
        {
          intentId: 'intent_1',
          status: 'submitted',
          executionMode: 'real',
          totalAmountUsd: 10,
          orders: [
            {
              id: 'order_1',
              limitPrice: 0.5,
              size: 20,
              amountUsd: 10,
              status: 'filled',
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
          executionMode: 'real',
          status: {
            in: [
              OrderIntentStatus.preview_ready,
              OrderIntentStatus.user_confirming,
              OrderIntentStatus.submitted,
              OrderIntentStatus.partially_submitted,
              OrderIntentStatus.unknown,
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
      select: {
        marketId: true,
        outcomeId: true,
        clobTokenId: true,
        size: true,
        avgPrice: true,
        currentPrice: true,
        currentValue: true,
        pnl: true,
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

  it('does not expose unresolved position links as public position ids', async () => {
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
      error: 'some positions are missing Causeway market metadata',
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
      dataApiAvailable({ getCurrentPositions }),
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
      dataApiAvailable({ getCurrentPositions }),
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
      dataApiAvailable({ getCurrentPositions }),
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

  it('rejects position sync before creating a run when Data API capability is unavailable', async () => {
    const getCurrentPositions = vi.fn();
    const syncRunCreate = vi.fn();
    const service = createService(
      {
        syncRun: {
          create: syncRunCreate,
        },
      },
      {
        getCapability: vi.fn().mockReturnValue({
          status: 'unavailable',
          reason: 'Polymarket Data API is disabled',
        }),
        getCurrentPositions,
      },
    );

    await expect(service.syncPositions(currentUser())).rejects.toMatchObject({
      response: {
        code: 'CAPABILITY_UNAVAILABLE',
        message: 'Polymarket Data API is disabled',
      },
    });
    expect(syncRunCreate).not.toHaveBeenCalled();
    expect(getCurrentPositions).not.toHaveBeenCalled();
  });

  it('lists monitored real filled orders as degraded trade history', async () => {
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
        externalOrderId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'filled',
        updatedAt: new Date('2026-05-18T00:02:00.000Z'),
        orderIntent: {
          id: 'intent_1',
          executionMode: 'real',
          status: 'submitted',
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
            orderIntent: { userId: 'user_1', executionMode: 'real' },
            status: { in: ['filled', 'partially_filled'] },
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
      select: {
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
          select: { id: true, slug: true, question: true, icon: true, image: true },
        },
        outcome: {
          select: { id: true, label: true, clobTokenId: true },
        },
      },
    });
    expect(result).toMatchObject({
      capability: 'degraded',
      dataSource: 'causeway_order_ledger',
      nextCursor: null,
      hasMore: false,
      error: 'trade history is based on monitored Causeway orders; external non-Causeway trades are excluded',
      items: [
        {
          tradeId: 'order_1',
          orderId: 'order_1',
          intentId: 'intent_1',
          executionMode: 'real',
          price: 0.51,
          size: 20,
          amountUsd: 10.2,
          status: 'filled',
          tradedAt: '2026-05-18T00:02:00.000Z',
        },
      ],
    });
  });

  it('returns an empty Causeway order ledger trades page when no trades exist', async () => {
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
      capability: 'available',
      dataSource: 'causeway_order_ledger',
      items: [],
      nextCursor: null,
      hasMore: false,
      error: null,
    });
  });
});

function createService(
  prisma: unknown,
  dataApiOverrides: Partial<DataApiClient> = {},
  tradingOverrides: Partial<TradingService> = {},
): PortfolioService {
  const dataApiClient = {
    getCapability: vi.fn().mockReturnValue({
      status: 'unavailable',
      reason: 'fixture data api unavailable',
    }),
    getCurrentPositions: vi.fn(),
    ...dataApiOverrides,
  } as unknown as DataApiClient;
  const tradingService = {
    getReadiness: vi.fn().mockResolvedValue({
      balance: { raw: null },
      reason: 'Trading wallet balance has not been refreshed yet.',
    }),
    ...tradingOverrides,
  } as unknown as TradingService;

  return new PortfolioService(dataApiClient, prisma as PrismaService, tradingService);
}

function dataApiAvailable(overrides: Partial<DataApiClient> = {}): Partial<DataApiClient> {
  return {
    getCapability: vi.fn().mockReturnValue({
      status: 'available',
      reason: null,
    }),
    ...overrides,
  };
}

function tradingBalance(raw: string | null): Partial<TradingService> {
  return {
    getReadiness: vi.fn().mockResolvedValue({
      balance: { raw },
      reason: raw == null ? 'Trading wallet balance has not been refreshed yet.' : null,
    }),
  };
}

function encodeTestCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function currentUser(): CurrentUser {
  return {
    id: 'user_1',
    sessionId: 'session_1',
    walletAddress: '0x1111111111111111111111111111111111111111',
    chainId: 137,
  };
}
