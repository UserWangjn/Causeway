import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../src/common/errors/api.exception';
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

  it('builds trimmed search, category, filters, sorting, and cursor pagination queries', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = createService({
      polymarketMarket: {
        findMany,
      },
    });

    await service.listMarkets({
      q: '  Election  ',
      category: '  politics  ',
      active: 'true',
      closed: 'false',
      sort: 'volume',
      cursor: encodeTestCursor({
        v: 1,
        scope: 'markets',
        sort: 'volume',
        id: 'market_before',
        value: '100',
      }),
      limit: 25,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            active: true,
            closed: false,
            archived: false,
            staleDetectedAt: null,
            AND: [
              {
                OR: [
                  { question: { contains: 'Election', mode: 'insensitive' } },
                  { slug: { contains: 'Election', mode: 'insensitive' } },
                  { description: { contains: 'Election', mode: 'insensitive' } },
                ],
              },
              {
                event: {
                  tags: {
                    array_contains: ['politics'],
                  },
                },
              },
            ],
          },
          {
            OR: [
              { volume: { lt: '100' } },
              { volume: null },
              {
                AND: [
                  { volume: '100' },
                  { id: { gt: 'market_before' } },
                ],
              },
            ],
          },
        ],
      },
      orderBy: [{ volume: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      take: 26,
      select: expect.any(Object) as object,
    });
  });

  it('builds market categories from normalized persisted event tags without loading every market', async () => {
    const count = vi.fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    const queryRaw = vi.fn().mockResolvedValue([
      { category: 'macro', count: 1n },
      { category: 'sports', count: 1n },
      { category: 'politics', count: 1n },
    ]);
    const service = createService({
      $queryRaw: queryRaw,
      polymarketMarket: {
        count,
      },
    });

    const result = await service.getMarketCategories();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenNthCalledWith(1, {
      where: {
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
      },
    });
    expect(count).toHaveBeenNthCalledWith(2, {
      where: {
        AND: [
          {
            active: true,
            closed: false,
            archived: false,
            staleDetectedAt: null,
          },
          {
            OR: [
              { volume24hr: { gt: 0 } },
              { volume: { gt: 0 } },
              { liquidity: { gt: 0 } },
            ],
          },
        ],
      },
    });
    expect(count).toHaveBeenNthCalledWith(3, {
      where: {
        AND: [
          {
            active: true,
            closed: false,
            archived: false,
            staleDetectedAt: null,
          },
          {
            discoveredAt: {
              gte: expect.any(Date) as Date,
            },
          },
        ],
      },
    });
    expect(result.categories).toEqual([
      { key: 'all', label: 'All', count: 3 },
      { key: 'hot', label: 'Hot', count: 2 },
      { key: 'new', label: 'New', count: 1 },
      { key: 'macro', label: 'Macro', count: 1 },
      { key: 'politics', label: 'Politics', count: 1 },
      { key: 'sports', label: 'Sports', count: 1 },
    ]);
  });

  it('returns market details with all outcomes and related markets from the same event', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      ...marketRecord('market_1', 'market-one', 'Will market one resolve?'),
      externalMarketId: 'external_market_1',
      conditionId: 'condition_1',
      questionId: 'question_1',
      description: 'Market one description',
      rules: 'Market one rules',
      archived: false,
      negRisk: false,
      orderMinSize: '1',
      orderPriceMinTickSize: '0.01',
      spread: '0.02',
      event: {
        id: 'event_1',
        slug: 'event-one',
        title: 'Event One',
        icon: null,
        image: null,
      },
      outcomes: [
        outcomeRecord('outcome_yes', 0, 'Yes', 'token_yes', '0.42'),
        outcomeRecord('outcome_no', 1, 'No', 'token_no', '0.58'),
        outcomeRecord('outcome_other', 2, 'Other', 'token_other', '0.01'),
      ],
    });
    const findMany = vi.fn().mockResolvedValue([
      {
        ...marketRecord('market_2', 'market-two', 'Will market two resolve?'),
        outcomes: [outcomeRecord('outcome_two_yes', 0, 'Yes', 'token_two_yes', '0.33')],
      },
    ]);
    const service = createService({
      polymarketMarket: {
        findUnique,
        findMany,
      },
    });

    const result = await service.getMarket('market_1');

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'market_1' },
      select: {
        id: true,
        eventId: true,
        slug: true,
        question: true,
        icon: true,
        image: true,
        active: true,
        closed: true,
        acceptingOrders: true,
        enableOrderBook: true,
        bestBid: true,
        bestAsk: true,
        lastTradePrice: true,
        volume: true,
        volume24hr: true,
        liquidity: true,
        endDate: true,
        syncedAt: true,
        externalMarketId: true,
        conditionId: true,
        questionId: true,
        description: true,
        rules: true,
        archived: true,
        negRisk: true,
        orderMinSize: true,
        orderPriceMinTickSize: true,
        spread: true,
        outcomes: {
          orderBy: { outcomeIndex: 'asc' },
          select: {
            id: true,
            outcomeIndex: true,
            label: true,
            clobTokenId: true,
            price: true,
            bestBid: true,
            bestAsk: true,
            lastTradePrice: true,
            syncedAt: true,
          },
        },
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            icon: true,
            image: true,
          },
        },
      },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        eventId: 'event_1',
        id: { not: 'market_1' },
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
      },
      orderBy: [{ volume24hr: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      take: 6,
      select: expect.any(Object) as object,
    });
    expect(result).toMatchObject({
      id: 'market_1',
      externalMarketId: 'external_market_1',
      conditionId: 'condition_1',
      questionId: 'question_1',
      description: 'Market one description',
      rules: 'Market one rules',
      negRisk: false,
      orderMinSize: 1,
      orderPriceMinTickSize: 0.01,
      spread: 0.02,
      event: {
        id: 'event_1',
        slug: 'event-one',
        title: 'Event One',
      },
      relatedMarkets: [
        expect.objectContaining({
          id: 'market_2',
          slug: 'market-two',
        }) as object,
      ],
    });
    expect(result.outcomes.map((outcome) => outcome.tokenId)).toEqual(['token_yes', 'token_no', 'token_other']);
  });

  it('returns the clicked market separately from its parent event detail', async () => {
    const selectedMarket = {
      ...marketRecord('market_1', 'market-one', 'Will selected market resolve?'),
      description: 'Selected market description',
      rules: null,
      orderMinSize: '1',
      orderPriceMinTickSize: '0.01',
      event: {
        id: 'event_1',
        slug: 'event-one',
        title: 'Parent Event Title',
        tags: ['sports'],
        icon: null,
        image: null,
        volume: '100',
        liquidity: '50',
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        syncedAt: new Date('2026-05-18T00:00:00.000Z'),
        description: 'Parent event description',
      },
      outcomes: [outcomeRecord('outcome_yes', 0, 'Yes', 'token_yes', '0.42')],
    };
    const eventRecord = {
      id: 'event_1',
      slug: 'event-one',
      title: 'Parent Event Title',
      description: 'Parent event description',
      icon: null,
      image: null,
      tags: ['sports'],
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      volume: '100',
      liquidity: '50',
      syncedAt: new Date('2026-05-18T00:00:00.000Z'),
      markets: [
        selectedMarket,
        {
          ...selectedMarket,
          id: 'market_2',
          slug: 'market-two',
          question: 'Will another market resolve?',
        },
      ],
    };
    const marketFindUnique = vi.fn().mockResolvedValue(selectedMarket);
    const eventFindUnique = vi.fn().mockResolvedValue(eventRecord);
    const service = createService({
      polymarketMarket: {
        findUnique: marketFindUnique,
      },
      polymarketEvent: {
        findUnique: eventFindUnique,
      },
    });

    const result = await service.getEventDetail({ marketId: 'market_1' });

    expect(result).toMatchObject({
      event: {
        id: 'event_1',
        title: 'Parent Event Title',
      },
      selectedMarket: {
        id: 'market_1',
        title: 'Will selected market resolve?',
        eventTitle: 'Parent Event Title',
      },
      markets: [
        {
          id: 'market_1',
          title: 'Will selected market resolve?',
        },
        {
          id: 'market_2',
          title: 'Will another market resolve?',
        },
      ],
    });
  });

  it('throws MARKET_NOT_FOUND for missing markets', async () => {
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(service.getMarket('missing_market')).rejects.toBeInstanceOf(ApiException);
    await expect(service.getMarket('missing_market')).rejects.toMatchObject({
      response: {
        code: 'MARKET_NOT_FOUND',
      },
    });
  });

  it('builds a deterministic market network when no persisted graph exists', async () => {
    const networkNodeFindMany = vi.fn().mockResolvedValue([]);
    const marketCount = vi.fn().mockResolvedValue(3);
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
        count: marketCount,
        findMany: marketFindMany,
      },
    });

    const result = await service.getMarketNetwork({ limit: 10 });

    expect(networkNodeFindMany).toHaveBeenCalledWith({
      where: {
        market: {
          active: true,
          closed: false,
          archived: false,
          staleDetectedAt: null,
          AND: undefined,
        },
        OR: undefined,
      },
      orderBy: { score: 'desc' },
      take: 80,
      include: {
        market: {
          select: expect.any(Object) as object,
        },
      },
    });
    expect(marketFindMany).toHaveBeenCalledWith({
      where: {
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
        AND: undefined,
      },
      orderBy: [
        { volume24hr: { sort: 'desc', nulls: 'last' } },
        { volume: { sort: 'desc', nulls: 'last' } },
        { liquidity: { sort: 'desc', nulls: 'last' } },
        { syncedAt: 'desc' },
        { id: 'asc' },
      ],
      take: 80,
      select: expect.any(Object) as object,
    });
    expect(result.nodes).toEqual([
      {
        id: 'market_1',
        marketId: 'market_1',
        title: 'First market',
        icon: null,
        price: 0.55,
        volume: 100,
        volume24hr: 10,
        liquidity: 50,
        category: 'politics',
      },
      {
        id: 'market_2',
        marketId: 'market_2',
        title: 'Second market',
        icon: null,
        price: 0.35,
        volume: 100,
        volume24hr: 10,
        liquidity: 50,
        category: 'politics',
      },
      {
        id: 'market_3',
        marketId: 'market_3',
        title: 'Third market',
        icon: null,
        price: 0.15,
        volume: 100,
        volume24hr: 10,
        liquidity: 50,
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
    expect(result).toMatchObject({
      total: 3,
      returned: 3,
      limit: 10,
      hasMore: false,
      category: 'all',
      source: 'database',
      topologySource: 'deterministic',
    });
  });

  it('treats the hot network category as an activity-ranked market subset', async () => {
    const networkNodeFindMany = vi.fn().mockResolvedValue([]);
    const marketCount = vi.fn().mockResolvedValue(2);
    const marketFindMany = vi.fn().mockResolvedValue([
      networkMarket('market_1', 'event_1', 'First hot market', '0.55', ['politics']),
      networkMarket('market_2', 'event_2', 'Second hot market', '0.35', ['sports']),
    ]);
    const service = createService({
      marketNetworkNode: {
        findMany: networkNodeFindMany,
      },
      polymarketMarket: {
        count: marketCount,
        findMany: marketFindMany,
      },
    });

    const result = await service.getMarketNetwork({ category: 'hot', limit: 10 });

    const hotWhere = {
      active: true,
      closed: false,
      archived: false,
      staleDetectedAt: null,
      AND: [
        {
          OR: [
            { volume24hr: { gt: 0 } },
            { volume: { gt: 0 } },
            { liquidity: { gt: 0 } },
          ],
        },
      ],
    };
    expect(marketCount).toHaveBeenCalledWith({ where: hotWhere });
    expect(networkNodeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        market: hotWhere,
        OR: undefined,
      },
    }));
    expect(marketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: hotWhere,
      orderBy: [
        { volume24hr: { sort: 'desc', nulls: 'last' } },
        { volume: { sort: 'desc', nulls: 'last' } },
        { liquidity: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ],
    }));
    expect(result).toMatchObject({
      total: 2,
      returned: 2,
      limit: 10,
      hasMore: false,
      category: 'hot',
      topologySource: 'deterministic',
    });
  });

  it('treats the new network category as a recently discovered market subset', async () => {
    const networkNodeFindMany = vi.fn().mockResolvedValue([]);
    const marketCount = vi.fn().mockResolvedValue(2);
    const marketFindMany = vi.fn().mockResolvedValue([
      networkMarket('market_1', 'event_1', 'Newest market', '0.55', ['politics'], {
        discoveredAt: new Date('2026-05-19T00:00:00.000Z'),
      }),
      networkMarket('market_2', 'event_2', 'Older new market', '0.35', ['sports'], {
        discoveredAt: new Date('2026-05-18T00:00:00.000Z'),
      }),
    ]);
    const service = createService({
      marketNetworkNode: {
        findMany: networkNodeFindMany,
      },
      polymarketMarket: {
        count: marketCount,
        findMany: marketFindMany,
      },
    });

    const result = await service.getMarketNetwork({ category: 'new', limit: 10 });

    expect(marketCount).toHaveBeenCalledWith({
      where: {
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
        AND: [
          {
            discoveredAt: {
              gte: expect.any(Date) as Date,
            },
          },
        ],
      },
    });
    expect(networkNodeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        market: {
          active: true,
          closed: false,
          archived: false,
          staleDetectedAt: null,
          AND: [
            {
              discoveredAt: {
                gte: expect.any(Date) as Date,
              },
            },
          ],
        },
        OR: undefined,
      },
    }));
    expect(marketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [
        { discoveredAt: 'desc' },
        { volume24hr: { sort: 'desc', nulls: 'last' } },
        { liquidity: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ],
    }));
    expect(result.nodes.map((node) => node.id)).toEqual(['market_1', 'market_2']);
    expect(result).toMatchObject({
      total: 2,
      returned: 2,
      limit: 10,
      hasMore: false,
      category: 'new',
      topologySource: 'deterministic',
    });
  });

  it('diversifies deterministic network nodes across events and categories before filling the limit', async () => {
    const networkNodeFindMany = vi.fn().mockResolvedValue([]);
    const marketCount = vi.fn().mockResolvedValue(7);
    const marketFindMany = vi.fn().mockResolvedValue([
      networkMarket('market_1', 'event_1', 'First politics market', '0.50', ['politics'], { volume24hr: '1000' }),
      networkMarket('market_2', 'event_1', 'Second politics market', '0.50', ['politics'], { volume24hr: '900' }),
      networkMarket('market_3', 'event_1', 'Third politics market', '0.50', ['politics'], { volume24hr: '800' }),
      networkMarket('market_4', 'event_1', 'Fourth politics market', '0.50', ['politics'], { volume24hr: '700' }),
      networkMarket('market_5', 'event_2', 'Sports market', '0.50', ['sports'], { volume24hr: '100' }),
      networkMarket('market_6', 'event_3', 'Crypto market', '0.50', ['crypto'], { volume24hr: '90' }),
      networkMarket('market_7', 'event_4', 'Macro market', '0.50', ['macro'], { volume24hr: '80' }),
    ]);
    const service = createService({
      marketNetworkNode: {
        findMany: networkNodeFindMany,
      },
      polymarketMarket: {
        count: marketCount,
        findMany: marketFindMany,
      },
    });

    const result = await service.getMarketNetwork({ limit: 5 });

    expect(marketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 80,
    }));
    expect(result.nodes.map((node) => node.id)).toEqual([
      'market_1',
      'market_2',
      'market_5',
      'market_6',
      'market_7',
    ]);
    expect(result).toMatchObject({
      total: 7,
      returned: 5,
      limit: 5,
      hasMore: true,
      topologySource: 'deterministic',
    });
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

  it('rejects orderbooks that cannot provide numeric trading constraints', async () => {
    const service = createService(
      {
        polymarketMarket: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'market_1',
            negRisk: false,
            orderMinSize: null,
            orderPriceMinTickSize: null,
            outcomes: [{ id: 'outcome_yes' }],
          }),
        },
      },
      {
        getOrderBook: vi.fn().mockResolvedValue({
          tokenId: 'token_yes',
          bids: [],
          asks: [],
          tickSize: null,
          minOrderSize: null,
          refreshedAt: '2026-05-18T00:00:00.000Z',
        }),
      },
    );

    await expect(service.getOrderBook('market_1', 'token_yes')).rejects.toMatchObject({
      response: {
        code: 'ORDERBOOK_UNAVAILABLE',
      },
    });
  });
});

function encodeTestCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function createService(prisma: unknown, clobOverrides: Partial<ClobClient> = {}) {
  const clobClient = {
    getOrderBook: vi.fn(),
    ...clobOverrides,
  } as unknown as ClobClient;
  return new MarketsService(clobClient, prisma as PrismaService);
}

function networkMarket(
  id: string,
  eventId: string,
  question: string,
  price: string,
  tags: string[],
  options: { volume?: string; volume24hr?: string; liquidity?: string; discoveredAt?: Date } = {},
) {
  return {
    id,
    eventId,
    slug: id,
    question,
    icon: null,
    image: null,
    acceptingOrders: true,
    enableOrderBook: true,
    bestBid: price,
    bestAsk: price,
    lastTradePrice: price,
    volume: options.volume ?? '100',
    volume24hr: options.volume24hr ?? '10',
    liquidity: options.liquidity ?? '50',
    discoveredAt: options.discoveredAt ?? new Date('2026-05-18T00:00:00.000Z'),
    syncedAt: new Date('2026-05-18T00:00:00.000Z'),
    event: {
      slug: eventId,
      title: eventId,
      tags,
    },
  };
}

function marketRecord(id: string, slug: string, question: string) {
  return {
    id,
    eventId: 'event_1',
    slug,
    question,
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
  };
}

function outcomeRecord(id: string, outcomeIndex: number, label: string, clobTokenId: string, price: string) {
  return {
    id,
    outcomeIndex,
    label,
    clobTokenId,
    price,
    bestBid: price,
    bestAsk: price,
    lastTradePrice: price,
    syncedAt: new Date('2026-05-18T00:00:00.000Z'),
  };
}
