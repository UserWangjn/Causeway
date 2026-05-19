import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../src/database/prisma.service';
import type { GammaClient } from '../../src/integrations/polymarket/services/gamma.client';
import { PolymarketSyncService } from '../../src/modules/polymarket-sync/polymarket-sync.service';
import { createTestPrismaClient, resetTestDatabase } from '../support/prisma-test-client';

describe('Polymarket sync integration', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetTestDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('upserts Gamma markets and outcomes idempotently by stable external identity', async () => {
    const getMarkets = vi
      .fn()
      .mockResolvedValueOnce([
        gammaMarketPayload({
          question: 'Which fixture candidate will win?',
          outcomePrices: ['0.20', '0.30', '0.50'],
        }),
      ])
      .mockResolvedValueOnce([
        gammaMarketPayload({
          question: 'Which updated fixture candidate will win?',
          outcomePrices: ['0.25', '0.35', '0.40'],
          volume: '250',
        }),
      ]);
    const service = createService(getMarkets);

    await expect(service.syncPolymarket({ scope: 'markets', mode: 'incremental', limit: 1 })).resolves.toMatchObject({
      status: 'completed',
      fetchedCount: 1,
      upsertedCount: 1,
      skippedCount: 0,
    });
    await expect(service.syncPolymarket({ scope: 'markets', mode: 'incremental', limit: 1 })).resolves.toMatchObject({
      status: 'completed',
      fetchedCount: 1,
      upsertedCount: 1,
      skippedCount: 0,
    });

    await expect(prisma.polymarketEvent.count()).resolves.toBe(1);
    await expect(prisma.polymarketMarket.count()).resolves.toBe(1);
    await expect(prisma.polymarketOutcome.count()).resolves.toBe(3);
    await expect(prisma.syncRun.count({ where: { jobType: 'polymarket_sync', status: 'completed' } })).resolves.toBe(2);

    const market = await prisma.polymarketMarket.findFirstOrThrow({
      where: { externalMarketId: 'gamma_market_1' },
      include: {
        event: true,
        outcomes: {
          orderBy: { outcomeIndex: 'asc' },
        },
      },
    });
    expect(market).toMatchObject({
      slug: 'gamma-market-1',
      question: 'Which updated fixture candidate will win?',
      conditionId: 'condition_gamma_1',
      acceptingOrders: true,
      enableOrderBook: true,
    });
    expect(String(market.volume)).toBe('250');
    expect(market.event).toMatchObject({
      externalEventId: 'gamma_event_1',
      slug: 'gamma-event-1',
      title: 'Gamma Fixture Event',
    });
    expect(market.outcomes.map((outcome) => ({
      label: outcome.label,
      tokenId: outcome.clobTokenId,
      price: String(outcome.price),
    }))).toEqual([
      { label: 'Candidate A', tokenId: 'token_gamma_a', price: '0.25' },
      { label: 'Candidate B', tokenId: 'token_gamma_b', price: '0.35' },
      { label: 'Candidate C', tokenId: 'token_gamma_c', price: '0.4' },
    ]);
    expect(getMarkets).toHaveBeenCalledTimes(2);
    expect(getMarkets).toHaveBeenNthCalledWith(1, {
      limit: 1,
      offset: 0,
      active: true,
      closed: false,
    }, { signal: undefined });
  });

  it('persists a failed SyncRun when Gamma retrieval fails before any writes', async () => {
    const getMarkets = vi.fn().mockRejectedValue(new Error('gamma unavailable'));
    const service = createService(getMarkets);

    await expect(service.syncPolymarket({ scope: 'markets', mode: 'incremental', limit: 10 })).rejects.toThrow('gamma unavailable');

    const syncRun = await prisma.syncRun.findFirstOrThrow({
      where: { jobType: 'polymarket_sync' },
      orderBy: { startedAt: 'desc' },
    });
    expect(syncRun).toMatchObject({
      scope: 'markets',
      status: 'failed',
      fetchedCount: 0,
      upsertedCount: 0,
      error: 'gamma unavailable',
    });
    expect(syncRun.finishedAt).toBeInstanceOf(Date);
    expect(syncRun.metadata).toMatchObject({
      mode: 'incremental',
      pageSize: 100,
      skippedCount: 0,
      skippedPayloads: [],
    });
  });

  function createService(getMarkets: ReturnType<typeof vi.fn>): PolymarketSyncService {
    return new PolymarketSyncService(
      { getMarkets } as unknown as GammaClient,
      prisma as unknown as PrismaService,
    );
  }
});

type GammaMarketInput = {
  question: string;
  outcomePrices: [string, string, string];
  volume?: string;
};

function gammaMarketPayload(input: GammaMarketInput): Record<string, unknown> {
  return {
    id: 'gamma_market_1',
    conditionId: 'condition_gamma_1',
    questionID: 'question_gamma_1',
    slug: 'gamma-market-1',
    question: input.question,
    description: 'Integration fixture market',
    rules: 'Integration fixture rules',
    outcomes: JSON.stringify(['Candidate A', 'Candidate B', 'Candidate C']),
    outcomePrices: JSON.stringify(input.outcomePrices),
    clobTokenIds: JSON.stringify(['token_gamma_a', 'token_gamma_b', 'token_gamma_c']),
    active: true,
    closed: false,
    acceptingOrders: true,
    enableOrderBook: true,
    negRisk: false,
    orderMinSize: '1',
    orderPriceMinTickSize: '0.01',
    bestBid: input.outcomePrices[0],
    bestAsk: input.outcomePrices[1],
    lastTradePrice: input.outcomePrices[2],
    spread: '0.01',
    volume: input.volume ?? '100',
    volume24hr: '10',
    liquidity: '50',
    endDate: '2026-12-31T00:00:00.000Z',
    event: {
      id: 'gamma_event_1',
      slug: 'gamma-event-1',
      title: 'Gamma Fixture Event',
      description: 'Integration fixture event',
      tags: ['integration', 'fixture'],
      active: true,
      closed: false,
      archived: false,
      restricted: false,
      endDate: '2026-12-31T00:00:00.000Z',
      volume: input.volume ?? '100',
      liquidity: '50',
      openInterest: '25',
    },
  };
}
