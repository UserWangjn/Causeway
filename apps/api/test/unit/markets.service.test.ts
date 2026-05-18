import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../src/database/prisma.service';
import type { ClobClient } from '../../src/integrations/polymarket/services/clob.client';
import { MarketsService } from '../../src/modules/markets/markets.service';

describe('MarketsService', () => {
  it('returns market list items in the documented API shape', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'market_1',
        eventId: 'event_1',
        slug: 'market-one',
        question: 'Will the market list contract hold?',
        icon: null,
        image: null,
        active: true,
        closed: false,
        acceptingOrders: true,
        enableOrderBook: true,
        bestBid: '0.41',
        bestAsk: '0.43',
        lastTradePrice: '0.42',
        volume: '100',
        volume24hr: '10',
        liquidity: '50',
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        syncedAt: new Date('2026-05-18T00:00:00.000Z'),
        outcomes: [
          {
            id: 'outcome_yes',
            outcomeIndex: 0,
            label: 'Yes',
            clobTokenId: 'token_yes',
            price: '0.42',
            bestBid: '0.41',
            bestAsk: '0.43',
            lastTradePrice: '0.42',
            syncedAt: new Date('2026-05-18T00:00:00.000Z'),
          },
        ],
      },
    ]);
    const service = createService({
      polymarketMarket: {
        findMany,
      },
    });

    const result = await service.listMarkets({ limit: 10 });

    expect(result.items).toEqual([
      {
        id: 'market_1',
        eventId: 'event_1',
        slug: 'market-one',
        question: 'Will the market list contract hold?',
        icon: null,
        image: null,
        active: true,
        closed: false,
        acceptingOrders: true,
        enableOrderBook: true,
        bestBid: 0.41,
        bestAsk: 0.43,
        lastTradePrice: 0.42,
        volume: 100,
        volume24hr: 10,
        liquidity: 50,
        endDate: '2026-12-31T00:00:00.000Z',
        syncedAt: '2026-05-18T00:00:00.000Z',
        outcomes: [
          {
            outcomeId: 'outcome_yes',
            label: 'Yes',
            tokenId: 'token_yes',
            price: 0.42,
            bestBid: 0.41,
            bestAsk: 0.43,
            lastTradePrice: 0.42,
          },
        ],
      },
    ]);
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
  });

  it('builds a deterministic market network when no persisted graph exists', async () => {
    const networkNodeFindMany = vi.fn().mockResolvedValue([]);
    const marketFindMany = vi.fn().mockResolvedValue([
      networkMarket('market_1', 'event_1', 'First market', '0.55', ['politics']),
      networkMarket('market_2', 'event_1', 'Second market', '0.35', ['politics']),
      networkMarket('market_3', 'event_2', 'Third market', '0.15', ['sports']),
    ]);
    const service = createService({
      marketNetworkNode: {
        findMany: networkNodeFindMany,
      },
      polymarketMarket: {
        findMany: marketFindMany,
      },
    });

    const result = await service.getMarketNetwork({ limit: 10 });

    expect(result.nodes).toEqual([
      {
        id: 'market_1',
        marketId: 'market_1',
        title: 'First market',
        icon: null,
        price: 0.55,
        volume: 100,
        category: 'politics',
      },
      {
        id: 'market_2',
        marketId: 'market_2',
        title: 'Second market',
        icon: null,
        price: 0.35,
        volume: 100,
        category: 'politics',
      },
      {
        id: 'market_3',
        marketId: 'market_3',
        title: 'Third market',
        icon: null,
        price: 0.15,
        volume: 100,
        category: 'sports',
      },
    ]);
    expect(result.edges).toEqual([
      {
        id: 'event:event_1:market_1:market_2',
        source: 'market_1',
        target: 'market_2',
        relationType: 'event',
        weight: 0.8,
      },
    ]);
  });

  it('validates outcome ownership before returning an orderbook contract', async () => {
    const getOrderBook = vi.fn().mockResolvedValue({
      tokenId: 'token_yes',
      bids: [{ price: 0.41, size: 100 }],
      asks: [{ price: 0.43, size: 100 }],
      tickSize: null,
      minOrderSize: null,
      refreshedAt: '2026-05-18T00:00:00.000Z',
    });
    const marketFindUnique = vi.fn().mockResolvedValue({
      id: 'market_1',
      negRisk: false,
      orderMinSize: '1',
      orderPriceMinTickSize: '0.01',
      outcomes: [{ id: 'outcome_yes' }],
    });
    const service = createService(
      {
        polymarketMarket: {
          findUnique: marketFindUnique,
        },
      },
      { getOrderBook },
    );

    const result = await service.getOrderBook('market_1', 'token_yes');

    expect(marketFindUnique).toHaveBeenCalledWith({
      where: { id: 'market_1' },
      select: {
        id: true,
        negRisk: true,
        orderMinSize: true,
        orderPriceMinTickSize: true,
        outcomes: {
          where: { clobTokenId: 'token_yes' },
          select: { id: true },
          take: 1,
        },
      },
    });
    expect(result).toEqual({
      marketId: 'market_1',
      tokenId: 'token_yes',
      bids: [{ price: 0.41, size: 100 }],
      asks: [{ price: 0.43, size: 100 }],
      tickSize: 0.01,
      minOrderSize: 1,
      negRisk: false,
      refreshedAt: '2026-05-18T00:00:00.000Z',
    });
  });
});

function createService(prisma: unknown, clobOverrides: Partial<ClobClient> = {}) {
  const clobClient = {
    getOrderBook: vi.fn(),
    ...clobOverrides,
  } as unknown as ClobClient;
  return new MarketsService(clobClient, prisma as PrismaService);
}

function networkMarket(id: string, eventId: string, question: string, price: string, tags: string[]) {
  return {
    id,
    eventId,
    slug: id,
    question,
    icon: null,
    image: null,
    bestBid: price,
    bestAsk: price,
    lastTradePrice: price,
    volume: '100',
    event: {
      tags,
    },
  };
}
