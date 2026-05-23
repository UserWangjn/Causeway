import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../src/database/prisma.service';
import type { ClobClient } from '../../src/integrations/polymarket/services/clob.client';
import { MonitorService } from '../../src/modules/monitor/monitor.service';
import type { TradingService } from '../../src/modules/trading/trading.service';

describe('MonitorService', () => {
  it('records an available CLOB order status refresh summary in batches', async () => {
    const externalOrderId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const causewayOrderFindMany = vi.fn().mockResolvedValue([
      orderStatusRecord({
        id: 'order_real_submitted',
        externalOrderId,
      }),
    ]);
    const causewayOrderUpdate = vi.fn().mockResolvedValue({});
    const orderIntentUpdate = vi.fn().mockResolvedValue({});
    const tx = {
      causewayOrder: {
        update: causewayOrderUpdate,
        findMany: vi.fn().mockResolvedValue([{ status: 'filled' }]),
      },
      orderIntent: {
        update: orderIntentUpdate,
      },
    };
    const prisma = {
      causewayOrder: {
        findMany: causewayOrderFindMany,
      },
      syncRun: {
        create: vi.fn().mockResolvedValue({
          id: 'sync_run_1',
          jobType: 'order_status_refresh',
          status: 'running',
        }),
        update: vi.fn().mockResolvedValue({
          id: 'sync_run_1',
          jobType: 'order_status_refresh',
          status: 'completed',
        }),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    };
    const clobClient = {
      getOrder: vi.fn().mockResolvedValue({
        id: externalOrderId,
        status: 'MATCHED',
        owner: null,
        makerAddress: null,
        market: null,
        assetId: 'token_1',
        side: 'BUY',
        originalSize: '20',
        sizeMatched: '20',
        price: '0.50',
        outcome: 'Yes',
        expiration: null,
        orderType: 'GTC',
        associateTrades: [],
        createdAt: null,
        raw: {
          id: externalOrderId,
          status: 'MATCHED',
        },
      }),
    };
    const tradingService = {
      getUserClobCredentials: vi.fn().mockResolvedValue({
        key: 'key',
        secret: 'secret',
        passphrase: 'passphrase',
        address: '0x1111111111111111111111111111111111111111',
      }),
    };
    const service = createService(prisma, clobClient, tradingService);

    const result = await service.refreshOrderStatuses();

    expect(prisma.syncRun.create).toHaveBeenCalledWith({
      data: {
        jobType: 'order_status_refresh',
        scope: 'orders',
        status: 'running',
        metadata: {
          capability: 'available',
          source: 'polymarket_clob',
          reason: 'Order status refresh uses Polymarket CLOB order detail when external order ids are available',
          batchSize: 100,
        },
      },
    });
    expect(causewayOrderFindMany).toHaveBeenCalledWith({
      where: {
        orderIntent: {
          executionMode: 'real',
        },
        status: {
          in: ['submitted', 'partially_filled', 'unknown'],
        },
      },
      select: {
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
      },
      orderBy: { id: 'asc' },
      take: 100,
    });
    expect(tradingService.getUserClobCredentials).toHaveBeenCalledWith({
      id: 'user_1',
      sessionId: 'monitor_order_status_refresh',
      walletAddress: '0x1111111111111111111111111111111111111111',
      chainId: 137,
    });
    expect(clobClient.getOrder).toHaveBeenCalledWith(externalOrderId, {
      key: 'key',
      secret: 'secret',
      passphrase: 'passphrase',
      address: '0x1111111111111111111111111111111111111111',
    });
    expect(causewayOrderUpdate).toHaveBeenCalledWith({
      where: { id: 'order_real_submitted' },
      data: {
        status: 'filled',
        errorMessage: null,
        responsePayload: {
          source: 'polymarket_clob_order_detail',
          refreshedAt: expect.any(String) as string,
          order: {
            id: externalOrderId,
            status: 'MATCHED',
          },
        },
      },
    });
    expect(orderIntentUpdate).toHaveBeenCalledWith({
      where: { id: 'intent_1' },
      data: { status: 'submitted' },
    });
    expect(prisma.syncRun.update).toHaveBeenCalledWith({
      where: { id: 'sync_run_1' },
      data: {
        status: 'completed',
        finishedAt: expect.any(Date) as Date,
        fetchedCount: 1,
        upsertedCount: 1,
        cursor: 'order_real_submitted',
        metadata: {
          capability: 'available',
          source: 'polymarket_clob',
          reason: 'Order status refresh uses Polymarket CLOB order detail when external order ids are available',
          batchSize: 100,
          batchCount: 1,
          inspectedOrderCount: 1,
          statusCounts: {
            submitted: 1,
          },
          intentStatusCounts: {
            submitted: 1,
          },
          remoteStatusCounts: {
            MATCHED: 1,
          },
          refreshableExternalOrderCount: 1,
          missingExternalOrderIdCount: 0,
          remoteRefreshAttemptCount: 1,
          remoteRefreshSuccessCount: 1,
          remoteRefreshFailedCount: 0,
          remoteOrderPersistedCount: 1,
          remoteStatusUpdatedCount: 1,
          remoteRefreshErrorCounts: {},
        },
      },
    });
    expect(result).toMatchObject({
      runId: 'sync_run_1',
      jobType: 'order_status_refresh',
      status: 'completed',
      capability: 'available',
      source: 'polymarket_clob',
      inspectedOrderCount: 1,
      batchCount: 1,
      statusCounts: {
        submitted: 1,
      },
      refreshableExternalOrderCount: 1,
      missingExternalOrderIdCount: 0,
      remoteRefreshAttemptCount: 1,
      remoteRefreshSuccessCount: 1,
      remoteOrderPersistedCount: 1,
      remoteStatusUpdatedCount: 1,
    });
  });

  it('records a degraded CLOB order status refresh summary when an order has no external order id', async () => {
    const prisma = {
      causewayOrder: {
        findMany: vi.fn().mockResolvedValue([orderStatusRecord({ externalOrderId: null })]),
      },
      syncRun: {
        create: vi.fn().mockResolvedValue({
          id: 'sync_run_1',
          jobType: 'order_status_refresh',
          status: 'running',
        }),
        update: vi.fn().mockResolvedValue({
          id: 'sync_run_1',
          jobType: 'order_status_refresh',
          status: 'completed',
        }),
      },
    };
    const service = createService(prisma);

    const result = await service.refreshOrderStatuses();

    expect(result).toMatchObject({
      capability: 'degraded',
      source: 'polymarket_clob',
      inspectedOrderCount: 1,
      refreshableExternalOrderCount: 1,
      missingExternalOrderIdCount: 1,
      remoteRefreshAttemptCount: 0,
    });
    const updateArgs = vi.mocked(prisma.syncRun.update).mock.calls[0]?.[0] as {
      data: { upsertedCount: number; metadata: { capability: string; missingExternalOrderIdCount: number } };
    };
    expect(updateArgs.data.upsertedCount).toBe(0);
    expect(updateArgs.data.metadata.capability).toBe('degraded');
    expect(updateArgs.data.metadata.missingExternalOrderIdCount).toBe(1);
  });

  it('records a failed CLOB order status refresh run when scanning fails', async () => {
    const syncRunCreate = vi.fn().mockResolvedValue({
      id: 'sync_run_failed',
      jobType: 'order_status_refresh',
      status: 'running',
    });
    const syncRunUpdate = vi.fn().mockResolvedValue({
      id: 'sync_run_failed',
      jobType: 'order_status_refresh',
      status: 'failed',
    });
    const service = createService({
      causewayOrder: {
        findMany: vi.fn().mockRejectedValue(new Error('orders scan failed')),
      },
      syncRun: {
        create: syncRunCreate,
        update: syncRunUpdate,
      },
    });

    const result = await service.refreshOrderStatuses();

    expect(syncRunUpdate).toHaveBeenCalledWith({
      where: { id: 'sync_run_failed' },
      data: {
        status: 'failed',
        finishedAt: expect.any(Date) as Date,
        fetchedCount: 0,
        error: 'orders scan failed',
        cursor: null,
        metadata: {
          capability: 'unavailable',
          source: 'polymarket_clob',
          reason: 'orders scan failed',
          batchSize: 100,
          batchCount: 0,
          inspectedOrderCount: 0,
          statusCounts: {},
          intentStatusCounts: {},
          remoteStatusCounts: {},
          refreshableExternalOrderCount: 0,
          missingExternalOrderIdCount: 0,
          remoteRefreshAttemptCount: 0,
          remoteRefreshSuccessCount: 0,
          remoteRefreshFailedCount: 0,
          remoteOrderPersistedCount: 0,
          remoteStatusUpdatedCount: 0,
          remoteRefreshErrorCounts: {},
        },
      },
    });
    expect(result).toMatchObject({
      runId: 'sync_run_failed',
      jobType: 'order_status_refresh',
      status: 'failed',
      capability: 'unavailable',
      source: 'polymarket_clob',
      reason: 'orders scan failed',
      inspectedOrderCount: 0,
      batchCount: 0,
    });
  });

  it('records local script market snapshots with a degraded capability run in batches', async () => {
    const scriptMarketFindMany = vi.fn().mockResolvedValue([
      scriptMarketRecord('script_market_1'),
      scriptMarketRecord('script_market_2'),
    ]);
    const marketSnapshotCreateMany = vi.fn().mockResolvedValue({ count: 2 });
    const syncRunCreate = vi.fn().mockResolvedValue({
      id: 'sync_run_2',
      jobType: 'script_market_refresh',
      status: 'running',
    });
    const syncRunUpdate = vi.fn().mockResolvedValue({
      id: 'sync_run_2',
      jobType: 'script_market_refresh',
      status: 'completed',
    });
    const service = createService({
      scriptMarket: {
        findMany: scriptMarketFindMany,
      },
      marketSnapshot: {
        createMany: marketSnapshotCreateMany,
      },
      syncRun: {
        create: syncRunCreate,
        update: syncRunUpdate,
      },
    });

    const result = await service.refreshScriptMarkets();

    expect(scriptMarketFindMany).toHaveBeenCalledWith({
      where: {
        script: {
          status: {
            not: 'archived',
          },
        },
      },
      select: {
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
      },
      orderBy: { id: 'asc' },
      take: 500,
    });
    expect(marketSnapshotCreateMany).toHaveBeenCalledWith({
      data: [
        {
          marketId: 'market_1',
          outcomeId: null,
          price: '0.55',
          bestBid: '0.54',
          bestAsk: '0.56',
          spread: '0.02',
          liquidity: '50',
          volume: '100',
          snapshotAt: expect.any(Date) as Date,
        },
        {
          marketId: 'market_1',
          outcomeId: 'outcome_1',
          price: '0.55',
          bestBid: '0.54',
          bestAsk: '0.56',
          spread: null,
          liquidity: null,
          volume: null,
          snapshotAt: expect.any(Date) as Date,
        },
      ],
    });
    expect(syncRunUpdate).toHaveBeenCalledWith({
      where: { id: 'sync_run_2' },
      data: {
        status: 'completed',
        finishedAt: expect.any(Date) as Date,
        fetchedCount: 2,
        upsertedCount: 2,
        cursor: 'script_market_2',
        metadata: {
          capability: 'degraded',
          source: 'local_polymarket_cache',
          reason: 'Script market monitoring refresh uses local market cache; external refresh is not wired yet',
          batchSize: 500,
          batchCount: 1,
          marketCount: 1,
          outcomeCount: 1,
        },
      },
    });
    expect(result).toMatchObject({
      runId: 'sync_run_2',
      jobType: 'script_market_refresh',
      status: 'completed',
      capability: 'degraded',
      source: 'local_polymarket_cache',
      refreshedScriptMarketCount: 2,
      snapshotCount: 2,
      batchCount: 1,
    });
  });

  it('records a failed script market refresh run when local snapshot creation fails', async () => {
    const syncRunCreate = vi.fn().mockResolvedValue({
      id: 'sync_run_failed',
      jobType: 'script_market_refresh',
      status: 'running',
    });
    const syncRunUpdate = vi.fn().mockResolvedValue({
      id: 'sync_run_failed',
      jobType: 'script_market_refresh',
      status: 'failed',
    });
    const service = createService({
      scriptMarket: {
        findMany: vi.fn().mockResolvedValue([scriptMarketRecord('script_market_1')]),
      },
      marketSnapshot: {
        createMany: vi.fn().mockRejectedValue(new Error('snapshot insert failed')),
      },
      syncRun: {
        create: syncRunCreate,
        update: syncRunUpdate,
      },
    });

    const result = await service.refreshScriptMarkets();

    expect(syncRunUpdate).toHaveBeenCalledWith({
      where: { id: 'sync_run_failed' },
      data: {
        status: 'failed',
        finishedAt: expect.any(Date) as Date,
        fetchedCount: 1,
        upsertedCount: 0,
        error: 'snapshot insert failed',
        cursor: 'script_market_1',
        metadata: {
          capability: 'unavailable',
          source: 'local_polymarket_cache',
          reason: 'snapshot insert failed',
          batchSize: 500,
          batchCount: 1,
          marketCount: 1,
          outcomeCount: 1,
        },
      },
    });
    expect(result).toMatchObject({
      runId: 'sync_run_failed',
      jobType: 'script_market_refresh',
      status: 'failed',
      capability: 'unavailable',
      source: 'local_polymarket_cache',
      reason: 'snapshot insert failed',
      refreshedScriptMarketCount: 1,
      snapshotCount: 0,
      batchCount: 1,
    });
  });
});

function createService(
  prisma: unknown,
  clobClient: Partial<ClobClient> = {},
  tradingService: Partial<TradingService> = {},
): MonitorService {
  return new MonitorService(
    prisma as PrismaService,
    clobClient as ClobClient,
    tradingService as TradingService,
  );
}

function orderStatusRecord(overrides: Partial<ReturnType<typeof baseOrderStatusRecord>> = {}) {
  return {
    ...baseOrderStatusRecord(),
    ...overrides,
  };
}

function baseOrderStatusRecord() {
  return {
    id: 'order_1',
    status: 'submitted',
    externalOrderId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    orderIntentId: 'intent_1',
    orderIntent: {
      id: 'intent_1',
      executionMode: 'real',
      status: 'submitted',
      user: {
        id: 'user_1',
        walletAddress: '0x1111111111111111111111111111111111111111',
        polymarketAccount: {
          chainId: 137,
        },
      },
    },
  };
}

function scriptMarketRecord(id: string) {
  return {
    id,
    marketId: 'market_1',
    market: {
      id: 'market_1',
      lastTradePrice: '0.55',
      bestBid: '0.54',
      bestAsk: '0.56',
      spread: '0.02',
      liquidity: '50',
      volume: '100',
    },
    selections: [
      {
        outcome: {
          id: 'outcome_1',
          marketId: 'market_1',
          price: '0.55',
          bestBid: '0.54',
          bestAsk: '0.56',
          lastTradePrice: '0.55',
        },
      },
    ],
  };
}
