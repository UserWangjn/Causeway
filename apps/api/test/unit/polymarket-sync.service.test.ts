import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../src/database/prisma.service';
import type { GammaClient } from '../../src/integrations/polymarket/services/gamma.client';
import { PolymarketSyncService } from '../../src/modules/polymarket-sync/polymarket-sync.service';

type TransactionCallback = (tx: unknown) => Promise<unknown>;
type SyncRunUpdateInput = {
  where: { id: string };
  data: {
    status: string;
    finishedAt?: Date;
    fetchedCount?: number;
    upsertedCount?: number;
    cursor?: string;
    metadata?: unknown;
    error?: string;
  };
};
type SyncRunUpdateResult = {
  id: string;
  status: string;
  fetchedCount: number;
  upsertedCount: number;
};

describe('PolymarketSyncService', () => {
  it('paginates Gamma markets and upserts by stable external identity', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => gammaMarket(index));
    const secondPage = [gammaMarket(100)];
    const getMarkets = vi.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage);
    const syncRunCreate = vi.fn().mockResolvedValue({ id: 'sync_run_1' });
    const syncRunUpdate = vi.fn<(input: SyncRunUpdateInput) => Promise<SyncRunUpdateResult>>().mockResolvedValue({
      id: 'sync_run_1',
      status: 'completed',
      fetchedCount: 101,
      upsertedCount: 101,
    });
    const marketUpsert = vi.fn().mockImplementation((input: { create: { slug: string } }) => ({
      id: input.create.slug,
    }));
    const outcomeUpsert = vi.fn();
    const tx = {
      polymarketMarket: {
        upsert: marketUpsert,
      },
      polymarketOutcome: {
        upsert: outcomeUpsert,
      },
    };
    const transaction = vi.fn((callback: TransactionCallback) => callback(tx));
    const service = new PolymarketSyncService(
      { getMarkets } as unknown as GammaClient,
      {
        syncRun: {
          create: syncRunCreate,
          update: syncRunUpdate,
        },
        $transaction: transaction,
      } as unknown as PrismaService,
    );

    const result = await service.syncPolymarket({ scope: 'markets', mode: 'incremental', limit: 101 });

    expect(getMarkets).toHaveBeenNthCalledWith(
      1,
      {
        limit: 100,
        offset: 0,
        active: true,
        closed: false,
      },
      { signal: undefined },
    );
    expect(getMarkets).toHaveBeenNthCalledWith(
      2,
      {
        limit: 1,
        offset: 100,
        active: true,
        closed: false,
      },
      { signal: undefined },
    );
    expect(marketUpsert).toHaveBeenNthCalledWith(1, {
      where: { externalMarketId: 'external_market_0' },
      update: expect.objectContaining({
        externalMarketId: 'external_market_0',
        conditionId: 'condition_0',
        slug: 'market-0',
        lastSeenAt: expect.any(Date) as Date,
        staleDetectedAt: null,
      }) as object,
      create: expect.objectContaining({
        externalMarketId: 'external_market_0',
        conditionId: 'condition_0',
        slug: 'market-0',
        lastSeenAt: expect.any(Date) as Date,
      }) as object,
    });
    expect(marketUpsert).toHaveBeenCalledTimes(101);
    expect(outcomeUpsert).toHaveBeenCalledTimes(202);
    const lastSyncRunUpdate = syncRunUpdate.mock.calls.at(-1)?.[0];
    expect(lastSyncRunUpdate?.where).toEqual({ id: 'sync_run_1' });
    expect(lastSyncRunUpdate?.data.status).toBe('completed');
    expect(lastSyncRunUpdate?.data.fetchedCount).toBe(101);
    expect(lastSyncRunUpdate?.data.upsertedCount).toBe(101);
    expect(lastSyncRunUpdate?.data.cursor).toBe('101');
    expect(lastSyncRunUpdate?.data.finishedAt).toBeInstanceOf(Date);
    expect(result).toMatchObject({
      runId: 'sync_run_1',
      scope: 'markets',
      mode: 'incremental',
      status: 'completed',
      fetchedCount: 101,
      upsertedCount: 101,
      skippedCount: 0,
    });
  });

  it('skips invalid Gamma markets and records skip reasons in sync metadata', async () => {
    const getMarkets = vi.fn().mockResolvedValueOnce([gammaMarket(1), { id: 'invalid_market', slug: 'invalid-market', question: 'No outcomes?' }]);
    const syncRunCreate = vi.fn().mockResolvedValue({ id: 'sync_run_1' });
    const syncRunUpdate = vi.fn<(input: SyncRunUpdateInput) => Promise<SyncRunUpdateResult>>().mockResolvedValue({
      id: 'sync_run_1',
      status: 'completed',
      fetchedCount: 2,
      upsertedCount: 1,
    });
    const marketUpsert = vi.fn().mockResolvedValue({ id: 'market-1' });
    const tx = {
      polymarketMarket: {
        upsert: marketUpsert,
      },
      polymarketOutcome: {
        upsert: vi.fn(),
      },
    };
    const service = new PolymarketSyncService(
      { getMarkets } as unknown as GammaClient,
      {
        syncRun: {
          create: syncRunCreate,
          update: syncRunUpdate,
        },
        $transaction: vi.fn((callback: TransactionCallback) => callback(tx)),
      } as unknown as PrismaService,
    );

    const result = await service.syncPolymarket({ scope: 'markets', mode: 'incremental', limit: 2 });

    expect(result.skippedCount).toBe(1);
    expect(marketUpsert).toHaveBeenCalledTimes(1);
    const lastSyncRunUpdate = syncRunUpdate.mock.calls.at(-1)?.[0];
    expect(lastSyncRunUpdate?.data.metadata).toMatchObject({
      skippedCount: 1,
      skippedPayloads: [
        {
          index: 1,
          reason: 'missing_outcomes',
          externalMarketId: 'invalid_market',
          slug: 'invalid-market',
        },
      ],
    });
  });

  it('records fetched and upserted progress when sync fails after a partial write', async () => {
    const getMarkets = vi.fn().mockResolvedValueOnce([gammaMarket(1), gammaMarket(2)]);
    const syncRunCreate = vi.fn().mockResolvedValue({ id: 'sync_run_1' });
    const syncRunUpdate = vi.fn<(input: SyncRunUpdateInput) => Promise<SyncRunUpdateResult>>().mockResolvedValue({
      id: 'sync_run_1',
      status: 'failed',
      fetchedCount: 2,
      upsertedCount: 1,
    });
    const marketUpsert = vi
      .fn()
      .mockResolvedValueOnce({ id: 'market-1' })
      .mockRejectedValueOnce(new Error('database unavailable'));
    const tx = {
      polymarketMarket: {
        upsert: marketUpsert,
      },
      polymarketOutcome: {
        upsert: vi.fn(),
      },
    };
    const service = new PolymarketSyncService(
      { getMarkets } as unknown as GammaClient,
      {
        syncRun: {
          create: syncRunCreate,
          update: syncRunUpdate,
        },
        $transaction: vi.fn((callback: TransactionCallback) => callback(tx)),
      } as unknown as PrismaService,
    );

    await expect(service.syncPolymarket({ scope: 'markets', mode: 'incremental', limit: 2 })).rejects.toThrow(
      'database unavailable',
    );

    expect(syncRunUpdate).toHaveBeenCalledWith({
      where: { id: 'sync_run_1' },
      data: {
        status: 'failed',
        finishedAt: expect.any(Date) as Date,
        fetchedCount: 2,
        upsertedCount: 1,
        error: 'database unavailable',
        metadata: {
          mode: 'incremental',
          pageSize: 100,
          skippedCount: 0,
          skippedPayloads: [],
        },
      },
    });
  });

  it('discovers full active event markets, deduplicates them, and soft-stales missing rows after completion', async () => {
    const getEvents = vi.fn()
      .mockResolvedValueOnce([
        gammaEvent(1, [gammaMarket(1), gammaMarket(1), gammaMarket(2)]),
      ])
      .mockResolvedValueOnce([]);
    const syncRunCreate = vi.fn().mockResolvedValue({ id: 'sync_run_1' });
    const syncRunUpdate = vi.fn<(input: SyncRunUpdateInput) => Promise<SyncRunUpdateResult>>().mockResolvedValue({
      id: 'sync_run_1',
      status: 'completed',
      fetchedCount: 2,
      upsertedCount: 2,
    });
    const eventUpsert = vi.fn().mockResolvedValue({ id: 'event_1' });
    const eventFindMany = vi.fn().mockResolvedValue([{ id: 'event_1', externalEventId: 'event_1' }]);
    const marketUpsert = vi.fn().mockImplementation((input: { create: { slug: string } }) => ({ id: input.create.slug }));
    const outcomeUpsert = vi.fn();
    const staleMarketUpdateMany = vi.fn().mockResolvedValue({ count: 3 });
    const staleEventUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      polymarketMarket: {
        upsert: marketUpsert,
      },
      polymarketOutcome: {
        upsert: outcomeUpsert,
      },
    };
    const service = new PolymarketSyncService(
      { getEvents } as unknown as GammaClient,
      {
        syncRun: {
          create: syncRunCreate,
          update: syncRunUpdate,
        },
        polymarketEvent: {
          upsert: eventUpsert,
          findMany: eventFindMany,
          updateMany: staleEventUpdateMany,
        },
        polymarketMarket: {
          updateMany: staleMarketUpdateMany,
        },
        $transaction: vi.fn((callback: TransactionCallback) => callback(tx)),
      } as unknown as PrismaService,
    );

    const result = await service.syncPolymarket({ scope: 'markets', mode: 'full' });

    expect(getEvents).toHaveBeenNthCalledWith(
      1,
      {
        limit: 100,
        offset: 0,
        active: true,
        closed: false,
      },
      { signal: undefined },
    );
    expect(marketUpsert).toHaveBeenCalledTimes(2);
    expect(outcomeUpsert).toHaveBeenCalledTimes(4);
    expect(staleMarketUpdateMany).toHaveBeenCalledWith({
      where: {
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: expect.any(Date) as Date } },
        ],
      },
      data: {
        acceptingOrders: false,
        enableOrderBook: false,
        staleDetectedAt: expect.any(Date) as Date,
        staleReason: 'not_seen_in_full_discovery',
      },
    });
    expect(result).toMatchObject({
      runId: 'sync_run_1',
      scope: 'markets',
      mode: 'full',
      status: 'completed',
      fetchedCount: 2,
      upsertedCount: 2,
      skippedCount: 0,
    });
  });

  it('refreshes hot event markets and local user-relevant markets without stale cleanup', async () => {
    const getEvents = vi.fn().mockResolvedValueOnce([gammaEvent(1, [gammaMarket(1), gammaMarket(2)])]);
    const getMarketById = vi.fn().mockResolvedValueOnce(gammaMarket(3));
    const syncRunCreate = vi.fn().mockResolvedValue({ id: 'sync_run_1' });
    const syncRunUpdate = vi.fn<(input: SyncRunUpdateInput) => Promise<SyncRunUpdateResult>>().mockResolvedValue({
      id: 'sync_run_1',
      status: 'completed',
      fetchedCount: 3,
      upsertedCount: 3,
    });
    const eventUpsert = vi.fn().mockResolvedValue({ id: 'event_1' });
    const eventFindMany = vi.fn().mockResolvedValue([{ id: 'event_1', externalEventId: 'event_1' }]);
    const marketUpsert = vi.fn().mockImplementation((input: { create: { slug: string } }) => ({ id: input.create.slug }));
    const outcomeUpsert = vi.fn();
    const tx = {
      polymarketMarket: {
        upsert: marketUpsert,
      },
      polymarketOutcome: {
        upsert: outcomeUpsert,
      },
    };
    const service = new PolymarketSyncService(
      { getEvents, getMarketById } as unknown as GammaClient,
      {
        syncRun: {
          create: syncRunCreate,
          update: syncRunUpdate,
        },
        polymarketEvent: {
          upsert: eventUpsert,
          findMany: eventFindMany,
        },
        causewayOrder: {
          findMany: vi.fn().mockResolvedValue([
            {
              market: {
                externalMarketId: 'external_market_3',
                slug: 'market-3',
                eventId: 'event_db_3',
              },
            },
          ]),
        },
        scriptMarket: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        polymarketMarket: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        $transaction: vi.fn((callback: TransactionCallback) => callback(tx)),
      } as unknown as PrismaService,
    );

    const result = await service.syncPolymarket({ scope: 'markets', mode: 'hot', limit: 3, hotEventLimit: 1 });

    expect(getEvents).toHaveBeenCalledWith(
      {
        limit: 1,
        offset: 0,
        active: true,
        closed: false,
        order: 'volume_24hr',
        ascending: false,
      },
      { signal: undefined },
    );
    expect(getMarketById).toHaveBeenCalledWith('external_market_3', { signal: undefined });
    expect(marketUpsert).toHaveBeenCalledTimes(3);
    expect(marketUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { externalMarketId: 'external_market_3' },
      update: expect.objectContaining({
        eventId: 'event_db_3',
        slug: 'market-3',
      }) as object,
    }));
    expect(result).toMatchObject({
      runId: 'sync_run_1',
      scope: 'markets',
      mode: 'hot',
      status: 'completed',
      fetchedCount: 3,
      upsertedCount: 3,
      skippedCount: 0,
    });
    expect(syncRunUpdate.mock.calls.at(-1)?.[0].data.metadata).toMatchObject({
      mode: 'hot',
      source: 'events_and_local_hotset',
      eventLimit: 1,
    });
  });

  it('reserves hot sync capacity for local user-relevant markets when event markets fill the limit', async () => {
    const getEvents = vi.fn().mockResolvedValueOnce([gammaEvent(1, [gammaMarket(1), gammaMarket(2)])]);
    const getMarketById = vi.fn().mockResolvedValueOnce(gammaMarket(3));
    const syncRunCreate = vi.fn().mockResolvedValue({ id: 'sync_run_1' });
    const syncRunUpdate = vi.fn<(input: SyncRunUpdateInput) => Promise<SyncRunUpdateResult>>().mockResolvedValue({
      id: 'sync_run_1',
      status: 'completed',
      fetchedCount: 2,
      upsertedCount: 2,
    });
    const eventUpsert = vi.fn().mockResolvedValue({ id: 'event_1' });
    const eventFindMany = vi.fn().mockResolvedValue([{ id: 'event_1', externalEventId: 'event_1' }]);
    const marketUpsert = vi.fn().mockImplementation((input: { create: { slug: string } }) => ({ id: input.create.slug }));
    const tx = {
      polymarketMarket: {
        upsert: marketUpsert,
      },
      polymarketOutcome: {
        upsert: vi.fn(),
      },
    };
    const service = new PolymarketSyncService(
      { getEvents, getMarketById } as unknown as GammaClient,
      {
        syncRun: {
          create: syncRunCreate,
          update: syncRunUpdate,
        },
        polymarketEvent: {
          upsert: eventUpsert,
          findMany: eventFindMany,
        },
        causewayOrder: {
          findMany: vi.fn().mockResolvedValue([
            {
              market: {
                externalMarketId: 'external_market_3',
                slug: 'market-3',
                eventId: 'event_db_3',
              },
            },
          ]),
        },
        scriptMarket: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        polymarketMarket: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        $transaction: vi.fn((callback: TransactionCallback) => callback(tx)),
      } as unknown as PrismaService,
    );

    const result = await service.syncPolymarket({ scope: 'markets', mode: 'hot', limit: 2, hotEventLimit: 1 });

    expect(getMarketById).toHaveBeenCalledWith('external_market_3', { signal: undefined });
    expect(marketUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { externalMarketId: 'external_market_3' },
      update: expect.objectContaining({
        eventId: 'event_db_3',
      }) as object,
    }));
    expect(result).toMatchObject({
      fetchedCount: 2,
      upsertedCount: 2,
      skippedCount: 0,
    });
  });

  it('preserves local hot candidate priority even when Gamma lookups resolve out of order', async () => {
    const getEvents = vi.fn().mockResolvedValueOnce([gammaEvent(1, [gammaMarket(1), gammaMarket(2)])]);
    const getMarketById = vi.fn(async (marketId: string) => {
      if (marketId === 'external_market_3') {
        await Promise.resolve();
        return gammaMarket(3);
      }
      return gammaMarket(4);
    });
    const syncRunCreate = vi.fn().mockResolvedValue({ id: 'sync_run_1' });
    const syncRunUpdate = vi.fn<(input: SyncRunUpdateInput) => Promise<SyncRunUpdateResult>>().mockResolvedValue({
      id: 'sync_run_1',
      status: 'completed',
      fetchedCount: 2,
      upsertedCount: 2,
    });
    const marketUpsert = vi.fn().mockImplementation((input: { create: { slug: string } }) => ({ id: input.create.slug }));
    const causewayOrderFindMany = vi
      .fn()
      .mockResolvedValueOnce([
        { market: { externalMarketId: 'external_market_3', slug: 'market-3', eventId: 'event_db_3' } },
        { market: { externalMarketId: 'external_market_4', slug: 'market-4', eventId: 'event_db_4' } },
      ])
      .mockResolvedValueOnce([]);
    const tx = {
      polymarketMarket: {
        upsert: marketUpsert,
      },
      polymarketOutcome: {
        upsert: vi.fn(),
      },
    };
    const service = new PolymarketSyncService(
      { getEvents, getMarketById } as unknown as GammaClient,
      {
        syncRun: {
          create: syncRunCreate,
          update: syncRunUpdate,
        },
        polymarketEvent: {
          upsert: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
        },
        causewayOrder: {
          findMany: causewayOrderFindMany,
        },
        scriptMarket: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        polymarketMarket: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        $transaction: vi.fn((callback: TransactionCallback) => callback(tx)),
      } as unknown as PrismaService,
    );

    await service.syncPolymarket({ scope: 'markets', mode: 'hot', limit: 2, hotEventLimit: 1 });

    expect(causewayOrderFindMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        status: {
          in: ['submitted', 'partially_filled'],
        },
      }) as object,
    }));
    const upsertedExternalMarketIds = marketUpsert.mock.calls.map(([input]) =>
      (input as { where: { externalMarketId: string } }).where.externalMarketId,
    );
    expect(upsertedExternalMarketIds).toEqual([
      'external_market_3',
      'external_market_4',
    ]);
  });

  it('rethrows aborts during hot local lookups instead of recording them as skipped payloads', async () => {
    const abortController = new AbortController();
    const getEvents = vi.fn().mockResolvedValueOnce([]);
    const getMarketById = vi.fn().mockImplementation(() => {
      abortController.abort(new Error('Polymarket market sync lock ownership was lost'));
      return Promise.reject(new Error('request aborted'));
    });
    const syncRunCreate = vi.fn().mockResolvedValue({ id: 'sync_run_1' });
    const syncRunUpdate = vi.fn<(input: SyncRunUpdateInput) => Promise<SyncRunUpdateResult>>().mockResolvedValue({
      id: 'sync_run_1',
      status: 'failed',
      fetchedCount: 0,
      upsertedCount: 0,
    });
    const service = new PolymarketSyncService(
      { getEvents, getMarketById } as unknown as GammaClient,
      {
        syncRun: {
          create: syncRunCreate,
          update: syncRunUpdate,
        },
        causewayOrder: {
          findMany: vi.fn().mockResolvedValue([
            {
              market: {
                externalMarketId: 'external_market_3',
                slug: 'market-3',
                eventId: 'event_db_3',
              },
            },
          ]),
        },
        scriptMarket: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        polymarketMarket: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaService,
    );

    await expect(
      service.syncPolymarket(
        { scope: 'markets', mode: 'hot', limit: 1, hotEventLimit: 1 },
        { abortSignal: abortController.signal },
      ),
    ).rejects.toThrow('Polymarket market sync lock ownership was lost');
    expect(syncRunUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'failed',
        error: 'Polymarket market sync lock ownership was lost',
      }) as object,
    }));
  });

  it('lists sync runs with filters and an opaque pagination cursor', async () => {
    const syncRunFindMany = vi.fn().mockResolvedValue([
      syncRunRecord('run_1', '2026-05-18T00:00:00.000Z'),
      syncRunRecord('run_2', '2026-05-17T00:00:00.000Z'),
      syncRunRecord('run_3', '2026-05-16T00:00:00.000Z'),
    ]);
    const service = new PolymarketSyncService(
      {} as unknown as GammaClient,
      {
        syncRun: {
          findMany: syncRunFindMany,
        },
      } as unknown as PrismaService,
    );
    const cursor = encodeTestCursor({
      v: 1,
      scope: 'internal_sync_runs',
      id: 'run_before',
      startedAt: '2026-05-19T00:00:00.000Z',
    });

    const result = await service.listRuns({
      jobType: 'polymarket_sync',
      scope: 'markets',
      status: 'completed',
      limit: 2,
      cursor,
    });

    expect(syncRunFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            jobType: 'polymarket_sync',
            scope: 'markets',
            status: 'completed',
          },
          {
            OR: [
              { startedAt: { lt: new Date('2026-05-19T00:00:00.000Z') } },
              {
                AND: [
                  { startedAt: new Date('2026-05-19T00:00:00.000Z') },
                  { id: { gt: 'run_before' } },
                ],
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        jobType: true,
        scope: true,
        status: true,
        fetchedCount: true,
        upsertedCount: true,
        error: true,
        startedAt: true,
        finishedAt: true,
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
      take: 3,
    });
    expect(result).toMatchObject({
      hasMore: true,
      items: [
        {
          id: 'run_1',
          jobType: 'polymarket_sync',
          scope: 'markets',
          status: 'completed',
          startedAt: '2026-05-18T00:00:00.000Z',
          finishedAt: null,
        },
        {
          id: 'run_2',
          startedAt: '2026-05-17T00:00:00.000Z',
        },
      ],
    });
    expect(result.nextCursor).toBeTruthy();
    expect(decodeTestCursor(result.nextCursor)).toEqual({
      v: 1,
      scope: 'internal_sync_runs',
      id: 'run_2',
      startedAt: '2026-05-17T00:00:00.000Z',
    });
  });
});

function gammaMarket(index: number) {
  return {
    id: `external_market_${index}`,
    conditionId: `condition_${index}`,
    slug: `market-${index}`,
    question: `Fixture market ${index}?`,
    outcomes: '["Yes","No"]',
    outcomePrices: '["0.4","0.6"]',
    clobTokenIds: `["token_${index}_yes","token_${index}_no"]`,
    active: true,
    closed: false,
  };
}

function gammaEvent(index: number, markets: Array<ReturnType<typeof gammaMarket>>) {
  return {
    id: `event_${index}`,
    slug: `event-${index}`,
    title: `Fixture event ${index}`,
    active: true,
    closed: false,
    archived: false,
    markets,
  };
}

function syncRunRecord(id: string, startedAt: string) {
  return {
    id,
    jobType: 'polymarket_sync',
    scope: 'markets',
    status: 'completed',
    fetchedCount: 10,
    upsertedCount: 9,
    error: null,
    startedAt: new Date(startedAt),
    finishedAt: null,
  };
}

function encodeTestCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeTestCursor(cursor: string | null): unknown {
  if (!cursor) return null;
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
}
