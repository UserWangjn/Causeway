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
    const marketFindUnique = vi.fn().mockResolvedValue(null);
    const marketCreate = vi.fn().mockImplementation((input: { data: { slug: string } }) => ({
      id: input.data.slug,
    }));
    const marketUpdate = vi.fn();
    const outcomeUpsert = vi.fn();
    const tx = {
      polymarketMarket: {
        findUnique: marketFindUnique,
        create: marketCreate,
        update: marketUpdate,
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

    expect(getMarkets).toHaveBeenNthCalledWith(1, {
      limit: 100,
      offset: 0,
      active: true,
      closed: false,
    });
    expect(getMarkets).toHaveBeenNthCalledWith(2, {
      limit: 1,
      offset: 100,
      active: true,
      closed: false,
    });
    expect(marketFindUnique).toHaveBeenNthCalledWith(1, {
      where: { externalMarketId: 'external_market_0' },
      select: { id: true },
    });
    expect(marketFindUnique).toHaveBeenNthCalledWith(2, {
      where: { conditionId: 'condition_0' },
      select: { id: true },
    });
    expect(marketFindUnique).toHaveBeenNthCalledWith(3, {
      where: { slug: 'market-0' },
      select: { id: true },
    });
    expect(marketCreate).toHaveBeenCalledTimes(101);
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
    const marketCreate = vi.fn().mockResolvedValue({ id: 'market-1' });
    const tx = {
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: marketCreate,
        update: vi.fn(),
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
    expect(marketCreate).toHaveBeenCalledTimes(1);
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
