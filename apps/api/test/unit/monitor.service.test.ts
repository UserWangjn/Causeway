import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../src/database/prisma.service';
import { MonitorService } from '../../src/modules/monitor/monitor.service';

describe('MonitorService', () => {
  it('records a degraded local order status refresh summary in batches', async () => {
    const causewayOrderFindMany = vi.fn().mockResolvedValue([
      {
        id: 'order_dry_run',
        status: 'dry_run_completed',
        externalOrderId: null,
        orderIntent: {
          executionMode: 'dry_run',
          status: 'dry_run_completed',
        },
      },
      {
        id: 'order_real_submitted',
        status: 'submitted',
        externalOrderId: null,
        orderIntent: {
          executionMode: 'real',
          status: 'submitted',
        },
      },
    ]);
    const syncRunCreate = vi.fn().mockResolvedValue({
      id: 'sync_run_1',
      jobType: 'order_status_refresh',
      status: 'running',
    });
    const syncRunUpdate = vi.fn().mockResolvedValue({
      id: 'sync_run_1',
      jobType: 'order_status_refresh',
      status: 'completed',
    });
    const service = new MonitorService({
      causewayOrder: {
        findMany: causewayOrderFindMany,
      },
      syncRun: {
        create: syncRunCreate,
        update: syncRunUpdate,
      },
    } as unknown as PrismaService);

    const result = await service.refreshOrderStatuses();

    expect(syncRunCreate).toHaveBeenCalledWith({
      data: {
        jobType: 'order_status_refresh',
        scope: 'orders',
        status: 'running',
        metadata: {
          capability: 'degraded',
          source: 'local_order_state',
          reason: 'Order status refresh uses local order state; external CLOB status refresh is not wired yet',
          batchSize: 500,
        },
      },
    });
    expect(causewayOrderFindMany).toHaveBeenCalledWith({
      where: {
        status: {
          in: ['preview_ready', 'dry_run_completed', 'submitted', 'partially_filled', 'filled', 'unknown', 'cancelled', 'failed'],
        },
      },
      select: {
        id: true,
        status: true,
        externalOrderId: true,
        orderIntent: {
          select: {
            executionMode: true,
            status: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: 500,
    });
    expect(syncRunUpdate).toHaveBeenCalledWith({
      where: { id: 'sync_run_1' },
      data: {
        status: 'completed',
        finishedAt: expect.any(Date) as Date,
        fetchedCount: 2,
        upsertedCount: 0,
        cursor: 'order_real_submitted',
        metadata: {
          capability: 'degraded',
          source: 'local_order_state',
          reason: 'Order status refresh uses local order state; external CLOB status refresh is not wired yet',
          batchSize: 500,
          batchCount: 1,
          inspectedOrderCount: 2,
          statusCounts: {
            dry_run_completed: 1,
            submitted: 1,
          },
          intentStatusCounts: {
            dry_run_completed: 1,
            submitted: 1,
          },
          refreshableExternalOrderCount: 1,
          missingExternalOrderIdCount: 1,
        },
      },
    });
    expect(result).toMatchObject({
      runId: 'sync_run_1',
      jobType: 'order_status_refresh',
      status: 'completed',
      capability: 'degraded',
      source: 'local_order_state',
      inspectedOrderCount: 2,
      batchCount: 1,
      statusCounts: {
        dry_run_completed: 1,
        submitted: 1,
      },
      refreshableExternalOrderCount: 1,
      missingExternalOrderIdCount: 1,
    });
  });

  it('records a failed local order status refresh run when scanning fails', async () => {
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
    const service = new MonitorService({
      causewayOrder: {
        findMany: vi.fn().mockRejectedValue(new Error('orders scan failed')),
      },
      syncRun: {
        create: syncRunCreate,
        update: syncRunUpdate,
      },
    } as unknown as PrismaService);

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
          source: 'local_order_state',
          reason: 'orders scan failed',
          batchSize: 500,
          batchCount: 0,
          inspectedOrderCount: 0,
          statusCounts: {},
          intentStatusCounts: {},
          refreshableExternalOrderCount: 0,
          missingExternalOrderIdCount: 0,
        },
      },
    });
    expect(result).toMatchObject({
      runId: 'sync_run_failed',
      jobType: 'order_status_refresh',
      status: 'failed',
      capability: 'unavailable',
      source: 'local_order_state',
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
    const service = new MonitorService({
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
    } as unknown as PrismaService);

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
    const service = new MonitorService({
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
    } as unknown as PrismaService);

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
