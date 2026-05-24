import { describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../src/common/errors/api.exception';
import type { PrismaService } from '../../src/database/prisma.service';
import type { ClobClient } from '../../src/integrations/polymarket/services/clob.client';
import type { GammaClient } from '../../src/integrations/polymarket/services/gamma.client';
import { MarketsService } from '../../src/modules/markets/markets.service';

const SEARCH_RESULT_KEYS = [
  'category',
  'categoryKey',
  'endDate',
  'eventId',
  'eventSlug',
  'icon',
  'id',
  'image',
  'liquidity',
  'marketId',
  'matchedBy',
  'price',
  'score',
  'slug',
  'subtitle',
  'title',
  'topic',
  'type',
  'volume',
].sort();

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
                  { event: { is: { title: { contains: 'Election', mode: 'insensitive' } } } },
                  { event: { is: { slug: { contains: 'Election', mode: 'insensitive' } } } },
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
    const queryRaw = vi.fn().mockResolvedValue([
      { category: 'macro', count: 1n },
      { category: 'sports', count: 1n },
      { category: 'politics', count: 1n },
      { category: '__all__', count: 3n },
      { category: '__hot__', count: 2n },
      { category: '__new__', count: 1n },
    ]);
    const service = createService({
      $queryRaw: queryRaw,
    });

    const result = await service.getMarketCategories();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.categories).toEqual([
      { key: 'all', label: 'All', count: 3 },
      { key: 'hot', label: 'Hot', count: 2 },
      { key: 'new', label: 'New', count: 1 },
      { key: 'macro', label: 'Macro', count: 1 },
      { key: 'politics', label: 'Politics', count: 1 },
      { key: 'sports', label: 'Sports', count: 1 },
    ]);
  });

  it('normalizes Gamma search results into the documented stable shape', async () => {
    const searchV2 = vi.fn().mockResolvedValue({
      events: [
        {
          id: 'event_1',
          slug: 'event-one',
          title: 'Fixture sports event',
          image: 'event.png',
          tags: ['sports'],
          volume: '1000',
          liquidity: '250',
          endDate: '2026-12-31T00:00:00.000Z',
          markets: [
            {
              id: 'market_1',
              slug: 'market-one',
              question: 'Will fixture market resolve?',
              groupItemTitle: 'Fixture market',
              bestAsk: '0.42',
              volume: '100',
              liquidity: '50',
              endDate: '2026-12-30T00:00:00.000Z',
            },
          ],
        },
      ],
      tags: [
        {
          id: 'tag_1',
          slug: 'crypto',
          label: 'Crypto',
          event_count: '7',
        },
      ],
    });
    const service = createService({}, {}, { searchV2 });

    const result = await service.searchMarkets({ q: 'fixture', limit: 5 });

    expect(result.source).toBe('polymarket_gamma_search_v2');
    expect(searchV2).toHaveBeenCalledWith({ q: 'fixture', limitPerType: 6 });
    expect(result.results).toHaveLength(3);
    for (const item of result.results) {
      expect(Object.keys(item).sort()).toEqual(SEARCH_RESULT_KEYS);
    }
    expect(result.results.map((item) => item.type)).toEqual(['market', 'event', 'topic']);
    expect(result.results[0]).toMatchObject({
      type: 'market',
      category: 'Sports',
      categoryKey: 'sports',
      topic: null,
      price: 0.42,
    });
    expect(result.results[2]).toMatchObject({
      type: 'topic',
      topic: 'crypto',
      category: 'Crypto',
      categoryKey: 'crypto',
      icon: null,
      image: null,
    });
  });

  it('falls back to cached market search when Gamma search fails', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        ...marketRecord('market_1', 'market-one', 'Will fixture market resolve?'),
        outcomes: [outcomeRecord('outcome_yes', 0, 'Yes', 'token_yes', '0.42')],
        event: {
          id: 'event_1',
          slug: 'event-one',
          title: 'Fixture Event',
          tags: ['politics'],
          icon: 'event-icon.png',
          image: 'event-image.png',
          volume: '1000',
          liquidity: '500',
          endDate: new Date('2026-12-31T00:00:00.000Z'),
          syncedAt: new Date('2026-05-18T00:00:00.000Z'),
          description: 'Event description',
        },
      },
    ]);
    const searchV2 = vi.fn().mockRejectedValue(new Error('Gamma unavailable'));
    const service = createService({
      polymarketMarket: {
        findMany,
      },
    }, {}, { searchV2 });

    const result = await service.searchMarkets({ q: 'fixture', limit: 3 });

    expect(result.source).toBe('causeway_market_cache');
    expect(findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
        OR: [
          { question: { contains: 'fixture', mode: 'insensitive' } },
          { slug: { contains: 'fixture', mode: 'insensitive' } },
          { description: { contains: 'fixture', mode: 'insensitive' } },
          { event: { is: { title: { contains: 'fixture', mode: 'insensitive' } } } },
          { event: { is: { slug: { contains: 'fixture', mode: 'insensitive' } } } },
        ],
      },
      orderBy: [{ volume24hr: { sort: 'desc', nulls: 'last' } }, { volume: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      take: 3,
      select: expect.any(Object) as object,
    });
    expect(Object.keys(result.results[0] ?? {}).sort()).toEqual(SEARCH_RESULT_KEYS);
    expect(result.results[0]).toMatchObject({
      type: 'market',
      id: 'market:market_1',
      marketId: 'market_1',
      eventId: 'event_1',
      eventSlug: 'event-one',
      topic: null,
      category: 'Politics',
      categoryKey: 'politics',
      matchedBy: 'market',
    });
  });

  it('normalizes Polymarket links before searching Gamma and the local cache', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const searchV2 = vi.fn().mockResolvedValue({ events: [], tags: [] });
    const service = createService({
      polymarketMarket: {
        findMany,
      },
    }, {}, { searchV2 });

    await service.searchMarkets({ q: 'https://polymarket.com/event/fixture-event?tid=123', limit: 5 });

    expect(searchV2).toHaveBeenCalledWith({ q: 'fixture-event', limitPerType: 6 });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
        OR: [
          { question: { contains: 'fixture-event', mode: 'insensitive' } },
          { slug: { contains: 'fixture-event', mode: 'insensitive' } },
          { description: { contains: 'fixture-event', mode: 'insensitive' } },
          { event: { is: { title: { contains: 'fixture-event', mode: 'insensitive' } } } },
          { event: { is: { slug: { contains: 'fixture-event', mode: 'insensitive' } } } },
        ],
      },
      orderBy: [{ volume24hr: { sort: 'desc', nulls: 'last' } }, { volume: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      take: 5,
      select: expect.any(Object) as object,
    });
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
      _count: {
        markets: 2,
      },
      markets: [
        marketRecordWithoutEvent(selectedMarket),
        {
          ...marketRecordWithoutEvent(selectedMarket),
          id: 'market_2',
          slug: 'market-two',
          question: 'Will another market resolve?',
          active: false,
          closed: true,
          acceptingOrders: false,
          enableOrderBook: false,
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
        description: 'Parent event description',
        rules: 'Selected market description',
        marketsCount: 2,
        marketsReturned: 2,
        hasMoreMarkets: false,
      },
      selectedMarket: {
        id: 'market_1',
        title: 'Will selected market resolve?',
        eventTitle: 'Parent Event Title',
        description: 'Selected market description',
        rules: 'Selected market description',
      },
      markets: [
        {
          id: 'market_1',
          title: 'Will selected market resolve?',
        },
        {
          id: 'market_2',
          title: 'Will another market resolve?',
          active: false,
          closed: true,
          acceptingOrders: false,
          enableOrderBook: false,
        },
      ],
    });
  });

  it('serves repeated event detail requests from a short in-memory cache', async () => {
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
      _count: {
        markets: 1,
      },
      markets: [marketRecordWithoutEvent(selectedMarket)],
    };
    const refreshedEventRecord = {
      ...eventRecord,
      title: 'Refreshed Parent Event Title',
      syncedAt: new Date('2026-05-18T00:00:20.000Z'),
      markets: [
        {
          ...marketRecordWithoutEvent(selectedMarket),
          volume: '200',
        },
      ],
    };
    const marketFindUnique = vi.fn().mockResolvedValue(selectedMarket);
    const eventFindUnique = vi.fn()
      .mockResolvedValueOnce(eventRecord)
      .mockResolvedValueOnce(refreshedEventRecord);
    const service = createService({
      polymarketMarket: {
        findUnique: marketFindUnique,
      },
      polymarketEvent: {
        findUnique: eventFindUnique,
      },
    });

    const first = await service.getEventDetail({ marketId: 'market_1' });
    const second = await service.getEventDetail({ marketId: 'market_1' });

    expect(first).toBe(second);
    expect(marketFindUnique).toHaveBeenCalledTimes(1);
    expect(eventFindUnique).toHaveBeenCalledTimes(1);

    const refreshed = await service.getEventDetail({ marketId: 'market_1', refresh: 'true' });
    const afterRefresh = await service.getEventDetail({ marketId: 'market_1' });

    expect(marketFindUnique).toHaveBeenCalledTimes(2);
    expect(eventFindUnique).toHaveBeenCalledTimes(2);
    expect(refreshed).toBe(afterRefresh);
    expect(refreshed.event?.title).toBe('Refreshed Parent Event Title');
    expect(refreshed.markets[0]?.volume).toBe(200);
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

    const result = await service.getMarketNetwork({ limit: 10, nodeType: 'market' });

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
    expect(result.nodes).toMatchObject([
      {
        id: 'market_1',
        marketId: 'market_1',
        title: 'First market',
        description: 'First market description',
        rules: 'First market rules',
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
        description: 'Second market description',
        rules: 'Second market rules',
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
        description: 'Third market description',
        rules: 'Third market rules',
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

  it('returns event-first network nodes by default', async () => {
    const networkNodeFindMany = vi.fn().mockResolvedValue([]);
    const marketCount = vi.fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(0);
    const marketGroupBy = vi.fn().mockResolvedValue([{ eventId: 'event_1' }, { eventId: 'event_2' }]);
    const marketFindMany = vi.fn().mockResolvedValue([
      networkMarket('market_1', 'event_1', 'Will Ecuador win the 2026 FIFA World Cup?', '0.55', ['sports'], {
        eventTitle: '2026 FIFA World Cup Winner',
        eventMarketsCount: 2,
      }),
      networkMarket('market_2', 'event_1', 'Will Brazil win the 2026 FIFA World Cup?', '0.35', ['sports'], {
        eventTitle: '2026 FIFA World Cup Winner',
        eventMarketsCount: 2,
      }),
      networkMarket('market_3', 'event_2', 'Will selected market resolve?', '0.15', ['politics'], {
        eventTitle: 'Fixture Election',
      }),
    ]);
    const service = createService({
      marketNetworkNode: {
        findMany: networkNodeFindMany,
      },
      polymarketMarket: {
        count: marketCount,
        groupBy: marketGroupBy,
        findMany: marketFindMany,
      },
    });

    const result = await service.getMarketNetwork({ limit: 10 });

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]).toMatchObject({
      nodeType: 'event',
      id: 'event_1',
      marketId: 'market_1',
      eventId: 'event_1',
      title: '2026 FIFA World Cup Winner',
      groupItemTitle: 'Ecuador',
      category: 'sports',
      marketsCount: 2,
      topMarkets: [
        {
          marketId: 'market_1',
          groupItemTitle: 'Ecuador',
          price: 0.55,
        },
        {
          marketId: 'market_2',
          groupItemTitle: 'Brazil',
          price: 0.35,
        },
      ],
    });
    expect(result.edges).toHaveLength(1);
    expect(result).toMatchObject({
      total: 3,
      totalEvents: 2,
      totalMarkets: 3,
      returned: 2,
      limit: 10,
      hasMore: false,
      nodeType: 'event',
      topologySource: 'deterministic',
    });
  });

  it('uses exact event identity filters for selected search results', async () => {
    const networkNodeFindMany = vi.fn().mockResolvedValue([]);
    const marketCount = vi.fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    const marketGroupBy = vi.fn().mockResolvedValue([{ eventId: 'event_1' }]);
    const marketFindMany = vi.fn().mockResolvedValue([
      networkMarket('market_1', 'event_1', 'First event market', '0.55', ['sports'], {
        eventTitle: 'Fixture Event',
        eventSlug: 'fixture-event',
      }),
    ]);
    const service = createService({
      marketNetworkNode: {
        findMany: networkNodeFindMany,
      },
      polymarketMarket: {
        count: marketCount,
        groupBy: marketGroupBy,
        findMany: marketFindMany,
      },
    });

    const result = await service.getMarketNetwork({ eventSlug: 'fixture-event', limit: 10 });

    const eventWhere = {
      active: true,
      closed: false,
      archived: false,
      staleDetectedAt: null,
      AND: [
        {
          event: {
            is: {
              slug: 'fixture-event',
            },
          },
        },
      ],
    };
    expect(networkNodeFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        market: eventWhere,
        OR: undefined,
      },
    }));
    expect(marketFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: eventWhere,
    }));
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      id: 'event_1',
      eventSlug: 'fixture-event',
      title: 'Fixture Event',
    });
  });

  it('serves repeated market network requests from the in-memory cache', async () => {
    const networkNodeFindMany = vi.fn().mockResolvedValue([]);
    const marketCount = vi.fn().mockResolvedValue(0);
    const marketGroupBy = vi.fn().mockResolvedValue([{ eventId: 'event_1' }]);
    const marketFindMany = vi.fn().mockResolvedValue([
      networkMarket('market_1', 'event_1', 'First hot market', '0.55', ['politics']),
    ]);
    const service = createService({
      marketNetworkNode: {
        findMany: networkNodeFindMany,
      },
      polymarketMarket: {
        count: marketCount,
        groupBy: marketGroupBy,
        findMany: marketFindMany,
      },
    });

    const first = await service.getMarketNetwork({ category: 'hot', limit: 10 });
    const second = await service.getMarketNetwork({ category: 'hot', limit: 10 });

    expect(first.nodes.map((node) => node.id)).toEqual(['event_1']);
    expect(second.nodes.map((node) => node.id)).toEqual(['event_1']);
    expect(second.cacheStatus).toBe('fresh');
    expect(networkNodeFindMany).toHaveBeenCalledTimes(1);
    expect(marketFindMany).toHaveBeenCalledTimes(1);
  });

  it('serves stale market network cache during Prisma connection pool exhaustion', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-05-22T00:00:00.000Z'));
      const networkNodeFindMany = vi.fn().mockResolvedValue([]);
      const marketCount = vi.fn().mockResolvedValue(0);
      const marketGroupBy = vi.fn().mockResolvedValue([{ eventId: 'event_1' }]);
      const marketFindMany = vi.fn().mockResolvedValue([
        networkMarket('market_1', 'event_1', 'First hot market', '0.55', ['politics']),
      ]);
      const service = createService({
        marketNetworkNode: {
          findMany: networkNodeFindMany,
        },
        polymarketMarket: {
          count: marketCount,
          groupBy: marketGroupBy,
          findMany: marketFindMany,
        },
      });

      await service.getMarketNetwork({ category: 'hot', limit: 10 });
      vi.setSystemTime(new Date('2026-05-22T00:06:00.000Z'));
      networkNodeFindMany.mockRejectedValueOnce(new Error('Timed out fetching a new connection from the connection pool'));

      const stale = await service.getMarketNetwork({ category: 'hot', limit: 10 });

      expect(stale.nodes.map((node) => node.id)).toEqual(['event_1']);
      expect(stale.cacheStatus).toBe('stale');
      expect(networkNodeFindMany).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns bounded network node copy for market hover cards', async () => {
    const longRules = `${'Resolution rules '.repeat(120)}Final sentence.`;
    const networkNodeFindMany = vi.fn().mockResolvedValue([]);
    const marketCount = vi.fn().mockResolvedValue(1);
    const marketFindMany = vi.fn().mockResolvedValue([
      networkMarket('market_1', 'event_1', 'First market', '0.55', ['politics'], {
        description: 'Short market description.',
        rules: longRules,
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

    const result = await service.getMarketNetwork({ limit: 10, nodeType: 'market' });

    expect(result.nodes[0]).toMatchObject({
      id: 'market_1',
      description: 'Short market description.',
    });
    expect(result.nodes[0]?.rules).toHaveLength(1200);
    expect(result.nodes[0]?.rules?.endsWith('...')).toBe(true);
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

    const result = await service.getMarketNetwork({ category: 'hot', limit: 10, nodeType: 'market' });

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

    const result = await service.getMarketNetwork({ category: 'new', limit: 10, nodeType: 'market' });

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

    const result = await service.getMarketNetwork({ limit: 5, nodeType: 'market' });

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

  it('serves repeated price history requests from a short in-memory cache', async () => {
    const getPriceHistory = vi.fn().mockResolvedValue({
      history: {
        '11111111111111111111': [{ t: 1, p: 0.42 }],
      },
      source: 'clob',
      generatedAt: '2026-05-18T00:00:00.000Z',
    });
    const service = createService({}, { getPriceHistory });

    const first = await service.getMarketPriceHistory({
      tokenIds: '11111111111111111111,22222222222222222222',
      interval: 'all',
      fidelity: 1440,
    });
    const second = await service.getMarketPriceHistory({
      tokenIds: '11111111111111111111,22222222222222222222',
      interval: 'all',
      fidelity: 1440,
    });

    expect(first).toBe(second);
    expect(getPriceHistory).toHaveBeenCalledTimes(1);
    expect(getPriceHistory).toHaveBeenCalledWith({
      tokenIds: ['11111111111111111111', '22222222222222222222'],
      interval: 'all',
      fidelity: 1440,
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

function createService(prisma: unknown, clobOverrides: Partial<ClobClient> = {}, gammaOverrides: Partial<GammaClient> = {}) {
  const clobClient = {
    getOrderBook: vi.fn(),
    ...clobOverrides,
  } as unknown as ClobClient;
  const gammaClient = {
    searchV2: vi.fn(),
    ...gammaOverrides,
  } as unknown as GammaClient;
  return new MarketsService(clobClient, gammaClient, prisma as PrismaService);
}

function networkMarket(
  id: string,
  eventId: string,
  question: string,
  price: string,
  tags: string[],
  options: {
    volume?: string;
    volume24hr?: string;
    liquidity?: string;
    discoveredAt?: Date;
    description?: string | null;
    rules?: string | null;
    eventTitle?: string;
    eventSlug?: string;
    eventDescription?: string | null;
    eventMarketsCount?: number;
  } = {},
) {
  const eventTitle = options.eventTitle ?? eventId;
  return {
    id,
    eventId,
    slug: id,
    question,
    description: options.description ?? `${question} description`,
    rules: options.rules ?? `${question} rules`,
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
    endDate: new Date('2026-12-31T00:00:00.000Z'),
    discoveredAt: options.discoveredAt ?? new Date('2026-05-18T00:00:00.000Z'),
    syncedAt: new Date('2026-05-18T00:00:00.000Z'),
    event: {
      id: eventId,
      slug: options.eventSlug ?? eventId,
      title: eventTitle,
      description: options.eventDescription ?? `${eventTitle} description`,
      icon: null,
      image: null,
      tags,
      volume: '1000',
      liquidity: '500',
      endDate: new Date('2026-12-31T00:00:00.000Z'),
      syncedAt: new Date('2026-05-18T00:00:00.000Z'),
      _count: {
        markets: options.eventMarketsCount ?? 1,
      },
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

function marketRecordWithoutEvent<T extends { event?: unknown }>(market: T): Omit<T, 'event'> {
  const { event: _event, ...withoutEvent } = market;
  return withoutEvent;
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
