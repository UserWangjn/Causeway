import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../common/errors/api.exception';
import {
  MARKET_CATEGORY_KEYS,
  marketCategoryLabel,
  normalizeMarketCategoryKey,
  readMarketCategoryKey,
} from '../../common/markets/market-category.util';
import {
  decodeOpaqueCursor,
  encodeOpaqueCursor,
  invalidPaginationCursor,
  isRecord,
} from '../../common/pagination/opaque-cursor';
import { toNullableNumber } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';
import { ClobClient } from '../../integrations/polymarket/services/clob.client';
import { EventDetailQueryDto, MarketHistoryQueryDto, MarketSearchQueryDto } from './dto/market-explorer-query.dto';
import { MarketQueryDto } from './dto/market-query.dto';

const MARKET_OUTCOME_SELECT = Prisma.validator<Prisma.PolymarketOutcomeSelect>()({
  id: true,
  outcomeIndex: true,
  label: true,
  clobTokenId: true,
  price: true,
  bestBid: true,
  bestAsk: true,
  lastTradePrice: true,
  syncedAt: true,
});

const MARKET_LIST_SELECT = Prisma.validator<Prisma.PolymarketMarketSelect>()({
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
  outcomes: {
    orderBy: { outcomeIndex: 'asc' },
    select: MARKET_OUTCOME_SELECT,
  },
});

const MARKET_DETAIL_SELECT = Prisma.validator<Prisma.PolymarketMarketSelect>()({
  ...MARKET_LIST_SELECT,
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
  event: {
    select: {
      id: true,
      slug: true,
      title: true,
      icon: true,
      image: true,
    },
  },
});

const NETWORK_MARKET_SELECT = Prisma.validator<Prisma.PolymarketMarketSelect>()({
  id: true,
  eventId: true,
  slug: true,
  question: true,
  icon: true,
  image: true,
  acceptingOrders: true,
  enableOrderBook: true,
  bestBid: true,
  bestAsk: true,
  lastTradePrice: true,
  volume: true,
  volume24hr: true,
  liquidity: true,
  discoveredAt: true,
  syncedAt: true,
  event: {
    select: {
      slug: true,
      title: true,
      tags: true,
    },
  },
});

const EXPLORER_MARKET_SELECT = Prisma.validator<Prisma.PolymarketMarketSelect>()({
  ...MARKET_LIST_SELECT,
  description: true,
  rules: true,
  orderMinSize: true,
  orderPriceMinTickSize: true,
  event: {
    select: {
      id: true,
      slug: true,
      title: true,
      tags: true,
      icon: true,
      image: true,
      volume: true,
      liquidity: true,
      endDate: true,
      syncedAt: true,
      description: true,
    },
  },
});

const EVENT_DETAIL_SELECT = Prisma.validator<Prisma.PolymarketEventSelect>()({
  id: true,
  slug: true,
  title: true,
  description: true,
  icon: true,
  image: true,
  tags: true,
  endDate: true,
  volume: true,
  liquidity: true,
  syncedAt: true,
  markets: {
    where: {
      active: true,
      closed: false,
      archived: false,
      staleDetectedAt: null,
    },
    orderBy: [{ volume24hr: { sort: 'desc', nulls: 'last' } }, { volume: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
    take: 50,
    select: EXPLORER_MARKET_SELECT,
  },
});

type MarketListRecord = Prisma.PolymarketMarketGetPayload<{ select: typeof MARKET_LIST_SELECT }>;
type MarketDetailRecord = Prisma.PolymarketMarketGetPayload<{ select: typeof MARKET_DETAIL_SELECT }>;
type NetworkMarketRecord = Prisma.PolymarketMarketGetPayload<{ select: typeof NETWORK_MARKET_SELECT }>;
type ExplorerMarketRecord = Prisma.PolymarketMarketGetPayload<{ select: typeof EXPLORER_MARKET_SELECT }>;
type EventDetailRecord = Prisma.PolymarketEventGetPayload<{ select: typeof EVENT_DETAIL_SELECT }>;
type NetworkTopologySource = 'precomputed' | 'deterministic';
type NetworkMarketCandidate = {
  market: NetworkMarketRecord;
  category: string | null;
  graphScore: number;
  rank: number;
};
type MarketCategoryCountRow = { category: string | null; count: bigint | number | string };

const NETWORK_CANDIDATE_MIN = 80;
const NETWORK_CANDIDATE_MAX = 400;
const NETWORK_CANDIDATE_MULTIPLIER = 8;
const NEW_MARKET_WINDOW_DAYS = 14;

const HOT_MARKET_ACTIVITY_WHERE = Prisma.validator<Prisma.PolymarketMarketWhereInput>()({
  OR: [
    { volume24hr: { gt: 0 } },
    { volume: { gt: 0 } },
    { liquidity: { gt: 0 } },
  ],
});

@Injectable()
export class MarketsService {
  constructor(
    @Inject(ClobClient)
    private readonly clobClient: ClobClient,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async listMarkets(query: MarketQueryDto) {
    const limit = query.limit ?? 50;
    const sort = normalizeMarketSort(query.sort);
    const cursor = decodeMarketCursor(query.cursor, sort);
    const markets = await this.prisma.polymarketMarket.findMany({
      where: this.buildListMarketsWhere(query, cursor),
      orderBy: this.buildOrderBy(sort),
      take: limit + 1,
      select: MARKET_LIST_SELECT,
    });
    const items = markets.slice(0, limit);

    return {
      items: items.map((market) => this.formatMarketListItem(market)),
      nextCursor: markets.length > limit ? encodeMarketCursor(sort, items.at(-1)) : null,
      hasMore: markets.length > limit,
    };
  }

  async getMarketCategories() {
    const baseWhere = this.baseOpenMarketWhere();
    const newWhere = this.buildNewMarketWhere(baseWhere);
    const [totalCount, hotCount, newCount, categoryCounts] = await Promise.all([
      this.prisma.polymarketMarket.count({
        where: baseWhere,
      }),
      this.prisma.polymarketMarket.count({
        where: {
          AND: [baseWhere, HOT_MARKET_ACTIVITY_WHERE],
        },
      }),
      this.prisma.polymarketMarket.count({
        where: newWhere,
      }),
      this.countOpenMarketsByCategory(),
    ]);

    const categoryItems = [...categoryCounts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 12)
      .map(([category, count]) => ({
        key: category,
        label: marketCategoryLabel(category),
        count,
      }));

    return {
      categories: [
        { key: 'all', label: 'All', count: totalCount },
        { key: 'hot', label: 'Hot', count: hotCount },
        { key: 'new', label: 'New', count: newCount },
        ...categoryItems,
      ],
      generatedAt: new Date().toISOString(),
      source: 'database',
    };
  }

  private async countOpenMarketsByCategory(): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<MarketCategoryCountRow[]>`
      SELECT category, COUNT(*)::bigint AS count
      FROM (
        SELECT COALESCE(
          (
            SELECT lower(tag.value)
            FROM jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(COALESCE(e."tags"::jsonb, '[]'::jsonb)) = 'array'
                  THEN COALESCE(e."tags"::jsonb, '[]'::jsonb)
                ELSE '[]'::jsonb
              END
            ) WITH ORDINALITY AS tag(value, ord)
            WHERE lower(tag.value) IN (${Prisma.join(MARKET_CATEGORY_KEYS)})
            ORDER BY tag.ord
            LIMIT 1
          ),
          'other'
        ) AS category
        FROM "PolymarketMarket" m
        LEFT JOIN "PolymarketEvent" e ON e."id" = m."eventId"
        WHERE m."active" = true
          AND m."closed" = false
          AND m."archived" = false
          AND m."staleDetectedAt" IS NULL
      ) categorized
      GROUP BY category
    `;
    const counts = new Map<string, number>();
    for (const row of rows) {
      const category = normalizeMarketCategoryKey(row.category) ?? 'other';
      counts.set(category, (counts.get(category) ?? 0) + Number(row.count));
    }
    return counts;
  }

  async searchMarkets(query: MarketSearchQueryDto) {
    const q = query.q.trim();
    const limit = query.limit ?? 8;
    const [markets, events] = await Promise.all([
      this.prisma.polymarketMarket.findMany({
        where: {
          active: true,
          closed: false,
          archived: false,
          staleDetectedAt: null,
          OR: [
            { question: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: [{ volume24hr: { sort: 'desc', nulls: 'last' } }, { volume: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
        take: limit,
        select: EXPLORER_MARKET_SELECT,
      }),
      this.prisma.polymarketEvent.findMany({
        where: {
          active: true,
          closed: false,
          archived: false,
          staleDetectedAt: null,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: [{ volume: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
        take: Math.min(4, limit),
        select: {
          id: true,
          slug: true,
          title: true,
          tags: true,
          icon: true,
          image: true,
          volume: true,
          liquidity: true,
          endDate: true,
          _count: {
            select: {
              markets: true,
            },
          },
        },
      }),
    ]);

    const marketResults = markets.map((market, index) => {
      const category = readMarketCategoryKey(market.event?.tags, [
        market.question,
        market.slug,
        market.event?.title,
        market.event?.slug,
    ]);
      return {
        type: 'market' as const,
        id: `market:${market.id}`,
        marketId: market.id,
        eventId: market.event?.id ?? market.eventId,
        eventSlug: market.event?.slug ?? null,
        slug: market.slug,
        title: market.question,
        subtitle: market.event?.title ?? marketCategoryLabel(category),
        category,
        categoryKey: category,
        icon: market.icon ?? market.image ?? market.event?.icon ?? market.event?.image,
        image: market.image ?? market.icon ?? market.event?.image ?? market.event?.icon,
        price: firstNumber(market.lastTradePrice, market.bestAsk, market.bestBid, market.outcomes[0]?.price),
        volume: toNullableNumber(market.volume),
        liquidity: toNullableNumber(market.liquidity),
        endDate: market.endDate?.toISOString() ?? null,
        score: scoreByVolume(market.volume, index),
        matchedBy: 'market',
      };
    });

    const eventResults = events.map((event, index) => {
      const category = readMarketCategoryKey(event.tags, [event.title, event.slug]);
      return {
        type: 'event' as const,
        id: `event:${event.id}`,
        marketId: null,
        eventId: event.id,
        eventSlug: event.slug,
        slug: null,
        title: event.title,
        subtitle: `${event._count.markets} markets`,
        category,
        categoryKey: category,
        icon: event.icon ?? event.image,
        image: event.image ?? event.icon,
        price: null,
        volume: toNullableNumber(event.volume),
        liquidity: toNullableNumber(event.liquidity),
        endDate: event.endDate?.toISOString() ?? null,
        score: scoreByVolume(event.volume, index),
        matchedBy: 'event',
      };
    });

    return {
      results: [...marketResults, ...eventResults]
        .sort((left, right) => right.score - left.score)
        .slice(0, limit),
      generatedAt: new Date().toISOString(),
      source: 'database',
    };
  }

  async getMarket(marketId: string) {
    const market = await this.prisma.polymarketMarket.findUnique({
      where: { id: marketId },
      select: MARKET_DETAIL_SELECT,
    });
    if (!market) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'MARKET_NOT_FOUND', 'Market was not found');
    }
    return this.formatMarketDetail(market);
  }

  async getMarketBySlug(slug: string) {
    const market = await this.prisma.polymarketMarket.findUnique({
      where: { slug },
      select: MARKET_DETAIL_SELECT,
    });
    if (!market) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'MARKET_NOT_FOUND', 'Market was not found');
    }
    return this.formatMarketDetail(market);
  }

  async getEventDetail(query: EventDetailQueryDto) {
    const marketId = trimToUndefined(query.marketId);
    const eventId = trimToUndefined(query.eventId);
    const eventSlug = trimToUndefined(query.eventSlug);
    if (!marketId && !eventId && !eventSlug) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'REQUEST_VALIDATION_FAILED',
        'marketId, eventId, or eventSlug query parameter is required',
      );
    }

    if (marketId) {
      const market = await this.prisma.polymarketMarket.findUnique({
        where: { id: marketId },
        select: EXPLORER_MARKET_SELECT,
      });
      if (!market) {
        throw new ApiException(HttpStatus.NOT_FOUND, 'MARKET_NOT_FOUND', 'Market was not found');
      }
      if (!market.eventId) {
        const selectedMarket = this.formatExplorerMarketNode(market, 0);
        return {
          event: null,
          selectedMarket,
          markets: [selectedMarket],
          source: 'database',
          generatedAt: new Date().toISOString(),
        };
      }

      const event = await this.prisma.polymarketEvent.findUnique({
        where: { id: market.eventId },
        select: EVENT_DETAIL_SELECT,
      });
      if (!event) {
        const selectedMarket = this.formatExplorerMarketNode(market, 0);
        return {
          event: null,
          selectedMarket,
          markets: [selectedMarket],
          source: 'database',
          generatedAt: new Date().toISOString(),
        };
      }

      return this.formatEventDetail(event, market);
    }

    const event = await this.prisma.polymarketEvent.findUnique({
      where: eventId ? { id: eventId } : { slug: eventSlug },
      select: EVENT_DETAIL_SELECT,
    });
    if (!event) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'EVENT_NOT_FOUND', 'Event was not found');
    }

    return this.formatEventDetail(event);
  }

  async getOrderBook(marketId: string, tokenId: string) {
    if (!tokenId) {
      throw new ApiException(HttpStatus.BAD_REQUEST, 'REQUEST_VALIDATION_FAILED', 'tokenId query parameter is required');
    }

    const market = await this.prisma.polymarketMarket.findUnique({
      where: { id: marketId },
      select: {
        id: true,
        negRisk: true,
        orderMinSize: true,
        orderPriceMinTickSize: true,
        outcomes: {
          where: { clobTokenId: tokenId },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!market) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'MARKET_NOT_FOUND', 'Market was not found');
    }
    if (!market.outcomes.length) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'OUTCOME_NOT_FOUND', 'Outcome token does not belong to this market');
    }

    const orderBook = await this.clobClient.getOrderBook(tokenId);
    const tickSize = orderBook.tickSize ?? toNullableNumber(market.orderPriceMinTickSize);
    const minOrderSize = orderBook.minOrderSize ?? toNullableNumber(market.orderMinSize);
    if (tickSize == null || minOrderSize == null) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'ORDERBOOK_UNAVAILABLE',
        'Order book is missing required trading constraints',
        {
          marketId,
          tokenId,
          tickSize,
          minOrderSize,
        },
      );
    }

    return {
      marketId,
      tokenId,
      bids: orderBook.bids,
      asks: orderBook.asks,
      tickSize,
      minOrderSize,
      negRisk: market.negRisk,
      refreshedAt: orderBook.refreshedAt,
    };
  }

  async getMarketPriceHistory(query: MarketHistoryQueryDto) {
    const tokenIds = query.tokenIds
      .split(',')
      .map((tokenId) => tokenId.trim())
      .filter((tokenId) => /^\d{20,}$/.test(tokenId))
      .slice(0, 12);
    if (!tokenIds.length) {
      return {
        history: {},
        source: 'clob',
        generatedAt: new Date().toISOString(),
      };
    }

    return this.clobClient.getPriceHistory({
      tokenIds,
      interval: normalizeHistoryInterval(query.interval),
      fidelity: query.fidelity ?? 1440,
    });
  }

  async getMarketNetwork(query: MarketQueryDto) {
    const limit = query.limit ?? 100;
    const marketWhere = this.buildWhere(query);
    const candidateLimit = networkCandidateLimit(limit);
    const [total, nodes] = await Promise.all([
      this.prisma.polymarketMarket.count({
        where: marketWhere,
      }),
      this.prisma.marketNetworkNode.findMany({
        where: this.buildNetworkNodeWhere(query),
        orderBy: { score: 'desc' },
        take: candidateLimit,
        include: {
          market: {
            select: NETWORK_MARKET_SELECT,
          },
        },
      }),
    ]);
    if (!nodes.length) {
      return this.buildDeterministicMarketNetwork(query, limit, total);
    }
    const graphCandidates = nodes.map((node, index) => ({
      market: node.market,
      category: node.category,
      graphScore: toNullableNumber(node.score) ?? 0,
      rank: index,
    }));
    const selectedNodes = selectNetworkCandidates(
      mergeNetworkCandidates(
        graphCandidates,
        await this.loadActivityNetworkCandidates(query, candidateLimit, nodes.length),
      ),
      query,
      limit,
    );

    const nodeMarketIds = selectedNodes.map((node) => node.market.id);
    const edges = nodeMarketIds.length
      ? await this.prisma.marketNetworkEdge.findMany({
          where: {
            sourceMarketId: { in: nodeMarketIds },
            targetMarketId: { in: nodeMarketIds },
          },
          orderBy: { weight: 'desc' },
          take: limit * 2,
        })
      : [];

    return {
      nodes: selectedNodes.map((node) => this.formatNetworkNode(node.market, node.category)),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceMarketId,
        target: edge.targetMarketId,
        relationType: formatNetworkRelationType(edge.relationType),
        weight: toNullableNumber(edge.weight) ?? 0,
      })),
      ...this.formatNetworkMeta(query, limit, total, selectedNodes.length, 'precomputed'),
    };
  }

  private baseOpenMarketWhere(): Prisma.PolymarketMarketWhereInput {
    return {
      active: true,
      closed: false,
      archived: false,
      staleDetectedAt: null,
    };
  }

  private buildNewMarketWhere(baseWhere: Prisma.PolymarketMarketWhereInput): Prisma.PolymarketMarketWhereInput {
    return {
      AND: [
        baseWhere,
        {
          discoveredAt: {
            gte: newMarketCutoff(),
          },
        },
      ],
    };
  }

  private buildWhere(query: MarketQueryDto, options: { includeCategory?: boolean } = {}): Prisma.PolymarketMarketWhereInput {
    const includeCategory = options.includeCategory ?? true;
    const search = trimToUndefined(query.q);
    const category = normalizeCategoryFilter(query.category);
    const hot = isHotCategory(query.category);
    const closed = parseBoolean(query.closed);
    const active = parseBoolean(query.active);
    const filters: Prisma.PolymarketMarketWhereInput[] = [];
    if (search) {
      filters.push({
        OR: [
          { question: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (includeCategory && category) {
      filters.push({
        event: {
          tags: {
            array_contains: [category],
          },
        },
      });
    }
    if (hot) {
      filters.push(HOT_MARKET_ACTIVITY_WHERE);
    }
    if (isNewCategory(query.category)) {
      filters.push({
        discoveredAt: {
          gte: newMarketCutoff(),
        },
      });
    }

    return {
      active: active ?? (closed === true ? undefined : true),
      closed: closed ?? false,
      archived: false,
      staleDetectedAt: null,
      AND: filters.length ? filters : undefined,
    };
  }

  private buildListMarketsWhere(
    query: MarketQueryDto,
    cursor: DecodedMarketCursor | null,
  ): Prisma.PolymarketMarketWhereInput {
    const base = this.buildWhere(query);
    if (!cursor) return base;
    return {
      AND: [
        base,
        buildMarketCursorWhere(cursor),
      ],
    };
  }

  private buildNetworkNodeWhere(query: MarketQueryDto): Prisma.MarketNetworkNodeWhereInput {
    const category = normalizeCategoryFilter(query.category);
    return {
      market: this.buildWhere(query, { includeCategory: false }),
      OR: category
        ? [
            { category },
            {
              market: {
                event: {
                  tags: {
                    array_contains: [category],
                  },
                },
              },
            },
          ]
        : undefined,
    };
  }

  private buildOrderBy(sort: MarketSort): Prisma.PolymarketMarketOrderByWithRelationInput[] {
    if (sort === 'endDate') return [{ endDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];
    if (sort === 'volume') return [{ volume: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }];
    if (sort === 'volume24hr') return [{ volume24hr: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }];
    return [{ syncedAt: 'desc' }, { id: 'asc' }];
  }

  private buildNetworkOrderBy(query: MarketQueryDto): Prisma.PolymarketMarketOrderByWithRelationInput[] {
    if (isNewCategory(query.category)) {
      return [
        { discoveredAt: 'desc' },
        { volume24hr: { sort: 'desc', nulls: 'last' } },
        { liquidity: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ];
    }
    if (isHotCategory(query.category)) {
      return [
        { volume24hr: { sort: 'desc', nulls: 'last' } },
        { volume: { sort: 'desc', nulls: 'last' } },
        { liquidity: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ];
    }
    return [
      { volume24hr: { sort: 'desc', nulls: 'last' } },
      { volume: { sort: 'desc', nulls: 'last' } },
      { liquidity: { sort: 'desc', nulls: 'last' } },
      { syncedAt: 'desc' },
      { id: 'asc' },
    ];
  }

  private async loadActivityNetworkCandidates(
    query: MarketQueryDto,
    candidateLimit: number,
    rankOffset = 0,
  ): Promise<NetworkMarketCandidate[]> {
    const markets = await this.prisma.polymarketMarket.findMany({
      where: this.buildWhere(query),
      orderBy: this.buildNetworkOrderBy(query),
      take: candidateLimit,
      select: NETWORK_MARKET_SELECT,
    });
    return markets.map((market, index) => ({
      market,
      category: null,
      graphScore: 0,
      rank: rankOffset + index,
    }));
  }

  private formatNetworkMeta(
    query: MarketQueryDto,
    limit: number,
    total: number,
    returned: number,
    topologySource: NetworkTopologySource,
  ) {
    return {
      total,
      returned,
      limit,
      hasMore: total > returned,
      category: trimToUndefined(query.category) ?? 'all',
      source: 'database',
      topologySource,
      generatedAt: new Date().toISOString(),
    };
  }

  private async formatMarketDetail(
    market: MarketDetailRecord,
  ) {
    const listItem = this.formatMarketListItem(market);
    return {
      ...listItem,
      externalMarketId: market.externalMarketId,
      conditionId: market.conditionId,
      questionId: market.questionId,
      description: market.description,
      rules: market.rules,
      archived: market.archived,
      negRisk: market.negRisk,
      orderMinSize: toNullableNumber(market.orderMinSize),
      orderPriceMinTickSize: toNullableNumber(market.orderPriceMinTickSize),
      spread: toNullableNumber(market.spread),
      event: market.event
        ? {
            id: market.event.id,
            slug: market.event.slug,
            title: market.event.title,
            icon: market.event.icon,
            image: market.event.image,
        }
        : null,
      relatedMarkets: await this.listRelatedMarkets(market),
    };
  }

  private formatMarketListItem(market: MarketListRecord) {
    return {
      id: market.id,
      eventId: market.eventId,
      slug: market.slug,
      question: market.question,
      icon: market.icon,
      image: market.image,
      active: market.active,
      closed: market.closed,
      acceptingOrders: market.acceptingOrders,
      enableOrderBook: market.enableOrderBook,
      bestBid: toNullableNumber(market.bestBid),
      bestAsk: toNullableNumber(market.bestAsk),
      lastTradePrice: toNullableNumber(market.lastTradePrice),
      volume: toNullableNumber(market.volume),
      volume24hr: toNullableNumber(market.volume24hr),
      liquidity: toNullableNumber(market.liquidity),
      endDate: market.endDate?.toISOString() ?? null,
      syncedAt: market.syncedAt.toISOString(),
      outcomes: market.outcomes.map((outcome) => ({
        outcomeId: outcome.id,
        label: outcome.label,
        tokenId: outcome.clobTokenId,
        price: toNullableNumber(outcome.price),
        bestBid: toNullableNumber(outcome.bestBid),
        bestAsk: toNullableNumber(outcome.bestAsk),
        lastTradePrice: toNullableNumber(outcome.lastTradePrice),
      })),
    };
  }

  private formatEventDetail(event: EventDetailRecord, selectedMarket: ExplorerMarketRecord | null = null) {
    const category = readMarketCategoryKey(event.tags, [event.title, event.slug]);
    const markets = event.markets.map((market, index) => this.formatExplorerMarketNode(market, index));
    const selectedMarketIndex = selectedMarket
      ? event.markets.findIndex((market) => market.id === selectedMarket.id)
      : -1;
    const selectedMarketNode = selectedMarket
      ? selectedMarketIndex >= 0
        ? markets[selectedMarketIndex]
        : this.formatExplorerMarketNode(selectedMarket, 0)
      : null;
    return {
      event: {
        id: event.id,
        slug: event.slug,
        title: event.title,
        category,
        categoryKey: category,
        officialCategory: category,
        tags: marketCategoryTagsForResponse(event.tags, category),
        icon: event.icon ?? event.image,
        image: event.image ?? event.icon,
        endDate: event.endDate?.toISOString() ?? null,
        volume: toNullableNumber(event.volume),
        volume24hr: null,
        liquidity: toNullableNumber(event.liquidity),
        description: event.description,
        rules: null,
        marketsCount: event.markets.length,
        syncedAt: event.syncedAt.toISOString(),
      },
      selectedMarket: selectedMarketNode,
      markets,
      source: 'database',
      generatedAt: new Date().toISOString(),
    };
  }

  private formatExplorerMarketNode(market: ExplorerMarketRecord, index: number) {
    const category = readMarketCategoryKey(market.event?.tags, [
      market.question,
      market.slug,
      market.event?.title,
      market.event?.slug,
    ]);
    return {
      id: market.id,
      slug: market.slug,
      title: market.question,
      groupItemTitle: null,
      eventId: market.eventId,
      eventSlug: market.event?.slug ?? null,
      eventTitle: market.event?.title ?? null,
      category,
      categoryKey: category,
      officialCategory: category,
      tags: marketCategoryTagsForResponse(market.event?.tags, category),
      icon: market.icon ?? market.image ?? market.event?.icon ?? market.event?.image,
      image: market.image ?? market.icon ?? market.event?.image ?? market.event?.icon,
      price: firstNumber(market.lastTradePrice, market.bestAsk, market.bestBid, market.outcomes[0]?.price),
      volume: toNullableNumber(market.volume),
      volume24hr: toNullableNumber(market.volume24hr),
      liquidity: toNullableNumber(market.liquidity),
      endDate: market.endDate?.toISOString() ?? null,
      description: market.description,
      rules: market.rules,
      acceptingOrders: market.acceptingOrders,
      outcomes: market.outcomes.map((outcome) => ({
        outcomeId: outcome.id,
        label: outcome.label,
        price: toNullableNumber(outcome.price),
        tokenId: outcome.clobTokenId,
      })),
      bestBid: toNullableNumber(market.bestBid),
      bestAsk: toNullableNumber(market.bestAsk),
      lastTradePrice: toNullableNumber(market.lastTradePrice),
      orderMinSize: toNullableNumber(market.orderMinSize),
      tickSize: toNullableNumber(market.orderPriceMinTickSize),
      syncedAt: market.syncedAt.toISOString(),
      x: 50 + (index % 5) * 8,
      y: 50 + Math.floor(index / 5) * 8,
    };
  }

  private async buildDeterministicMarketNetwork(query: MarketQueryDto, limit: number, total: number) {
    const selectedMarkets = selectNetworkCandidates(
      await this.loadActivityNetworkCandidates(query, networkCandidateLimit(limit)),
      query,
      limit,
    );

    return {
      nodes: selectedMarkets.map((candidate) => this.formatNetworkNode(candidate.market, candidate.category)),
      edges: buildEventEdges(selectedMarkets.map((candidate) => candidate.market)),
      ...this.formatNetworkMeta(query, limit, total, selectedMarkets.length, 'deterministic'),
    };
  }

  private formatNetworkNode(market: NetworkMarketRecord, category: string | null) {
    return {
      id: market.id,
      marketId: market.id,
      title: market.question,
      icon: market.icon ?? market.image,
      price: firstNumber(market.lastTradePrice, market.bestAsk, market.bestBid),
      volume: toNullableNumber(market.volume),
      volume24hr: toNullableNumber(market.volume24hr),
      liquidity: toNullableNumber(market.liquidity),
      category: category ?? readMarketCategoryKey(market.event?.tags, [
        market.question,
        market.slug,
        market.event?.title,
        market.event?.slug,
      ]),
    };
  }

  private async listRelatedMarkets(market: MarketDetailRecord) {
    if (!market.eventId) return [];

    const relatedMarkets = await this.prisma.polymarketMarket.findMany({
      where: {
        eventId: market.eventId,
        id: { not: market.id },
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
      },
      orderBy: [{ volume24hr: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      take: 6,
      select: MARKET_LIST_SELECT,
    });

    return relatedMarkets.map((relatedMarket) => this.formatMarketListItem(relatedMarket));
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

type MarketSort = 'volume' | 'volume24hr' | 'endDate' | 'syncedAt';

type DecodedMarketCursor = {
  sort: MarketSort;
  id: string;
  value: string | null;
};

function normalizeMarketSort(sort: string | undefined): MarketSort {
  if (sort === 'volume' || sort === 'volume24hr' || sort === 'endDate' || sort === 'syncedAt') {
    return sort;
  }
  return 'syncedAt';
}

function encodeMarketCursor(sort: MarketSort, market: MarketListRecord | undefined): string | null {
  if (!market) return null;
  return encodeOpaqueCursor({
    v: 1,
    scope: 'markets',
    sort,
    id: market.id,
    value: readMarketCursorValue(sort, market),
  });
}

function decodeMarketCursor(cursor: string | undefined, expectedSort: MarketSort): DecodedMarketCursor | null {
  if (!cursor) return null;
  const decoded = decodeOpaqueCursor(cursor);
  if (
    !isRecord(decoded)
    || decoded.v !== 1
    || decoded.scope !== 'markets'
    || decoded.sort !== expectedSort
    || typeof decoded.id !== 'string'
    || !isValidMarketCursorValue(expectedSort, decoded.value)
  ) {
    throw invalidPaginationCursor();
  }

  return {
    sort: expectedSort,
    id: decoded.id,
    value: decoded.value,
  };
}

function buildMarketCursorWhere(cursor: DecodedMarketCursor): Prisma.PolymarketMarketWhereInput {
  if (cursor.sort === 'volume') return decimalDescCursorWhere('volume', cursor);
  if (cursor.sort === 'volume24hr') return decimalDescCursorWhere('volume24hr', cursor);
  if (cursor.sort === 'endDate') return nullableDateAscCursorWhere('endDate', cursor);
  return dateDescCursorWhere('syncedAt', cursor);
}

function decimalDescCursorWhere(
  field: 'volume' | 'volume24hr',
  cursor: DecodedMarketCursor,
): Prisma.PolymarketMarketWhereInput {
  if (cursor.value == null) {
    return {
      AND: [
        { [field]: null },
        { id: { gt: cursor.id } },
      ],
    };
  }

  return {
    OR: [
      { [field]: { lt: cursor.value } },
      { [field]: null },
      {
        AND: [
          { [field]: cursor.value },
          { id: { gt: cursor.id } },
        ],
      },
    ],
  };
}

function nullableDateAscCursorWhere(
  field: 'endDate',
  cursor: DecodedMarketCursor,
): Prisma.PolymarketMarketWhereInput {
  if (cursor.value == null) {
    return {
      AND: [
        { [field]: null },
        { id: { gt: cursor.id } },
      ],
    };
  }
  const value = new Date(cursor.value);
  return {
    OR: [
      { [field]: { gt: value } },
      { [field]: null },
      {
        AND: [
          { [field]: value },
          { id: { gt: cursor.id } },
        ],
      },
    ],
  };
}

function dateDescCursorWhere(field: 'syncedAt', cursor: DecodedMarketCursor): Prisma.PolymarketMarketWhereInput {
  if (cursor.value == null) throw invalidPaginationCursor();
  const value = new Date(cursor.value);
  return {
    OR: [
      { [field]: { lt: value } },
      {
        AND: [
          { [field]: value },
          { id: { gt: cursor.id } },
        ],
      },
    ],
  };
}

function readMarketCursorValue(sort: MarketSort, market: MarketListRecord): string | null {
  if (sort === 'endDate') return market.endDate?.toISOString() ?? null;
  if (sort === 'syncedAt') return market.syncedAt.toISOString();
  const value = sort === 'volume' ? market.volume : market.volume24hr;
  return value == null ? null : String(value);
}

function isValidMarketCursorValue(sort: MarketSort, value: unknown): value is string | null {
  if (value == null) return sort !== 'syncedAt';
  if (typeof value !== 'string') return false;
  if (sort === 'endDate' || sort === 'syncedAt') return !Number.isNaN(new Date(value).getTime());
  return Number.isFinite(Number(value));
}

function trimToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeCategoryFilter(value: string | undefined): string | undefined {
  const category = trimToUndefined(value);
  if (!category || category === 'all' || category === 'hot' || category === 'new') return undefined;
  return category;
}

function isHotCategory(value: string | undefined): boolean {
  return trimToUndefined(value) === 'hot';
}

function isNewCategory(value: string | undefined): boolean {
  return trimToUndefined(value) === 'new';
}

function newMarketCutoff(): Date {
  return new Date(Date.now() - NEW_MARKET_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toNullableNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function stringTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
}

function marketCategoryTagsForResponse(value: unknown, category: string): string[] {
  const tags = stringTags(value);
  return tags.includes(category) ? tags : [category, ...tags];
}

function networkCandidateLimit(limit: number): number {
  return Math.min(
    NETWORK_CANDIDATE_MAX,
    Math.max(NETWORK_CANDIDATE_MIN, limit * NETWORK_CANDIDATE_MULTIPLIER),
  );
}

function selectNetworkCandidates(
  candidates: NetworkMarketCandidate[],
  query: MarketQueryDto,
  limit: number,
): NetworkMarketCandidate[] {
  if (candidates.length <= limit) return candidates;

  const rankedCandidates = candidates
    .map((candidate) => ({
      ...candidate,
      category: candidate.category ?? networkCandidateCategory(candidate.market),
      score: scoreNetworkCandidate(candidate),
    }))
    .sort((left, right) => compareNetworkCandidates(left, right, query));
  const selected: typeof rankedCandidates = [];
  const selectedIds = new Set<string>();
  const eventCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const focusedSearch = Boolean(trimToUndefined(query.q));
  const categoryFilter = normalizeCategoryFilter(query.category);
  const diversifyEvents = !focusedSearch;
  const diversifyCategories = !focusedSearch && !categoryFilter;
  const maxPerEvent = Math.max(2, Math.ceil(limit * 0.12));
  const maxPerCategory = Math.max(3, Math.ceil(limit * 0.36));

  for (const candidate of rankedCandidates) {
    if (selected.length >= limit) break;
    if (canAddNetworkCandidate(candidate, {
      diversifyEvents,
      diversifyCategories,
      eventCounts,
      categoryCounts,
      maxPerEvent,
      maxPerCategory,
    })) {
      selected.push(candidate);
      selectedIds.add(candidate.market.id);
      incrementNetworkCandidateCounts(candidate, eventCounts, categoryCounts);
    }
  }

  for (const candidate of rankedCandidates) {
    if (selected.length >= limit) break;
    if (selectedIds.has(candidate.market.id)) continue;
    selected.push(candidate);
    selectedIds.add(candidate.market.id);
  }

  return selected;
}

function mergeNetworkCandidates(...candidateGroups: NetworkMarketCandidate[][]): NetworkMarketCandidate[] {
  const merged = new Map<string, NetworkMarketCandidate>();
  for (const candidates of candidateGroups) {
    for (const candidate of candidates) {
      const existing = merged.get(candidate.market.id);
      if (!existing) {
        merged.set(candidate.market.id, candidate);
        continue;
      }
      merged.set(candidate.market.id, {
        market: existing.market,
        category: existing.category ?? candidate.category,
        graphScore: Math.max(existing.graphScore, candidate.graphScore),
        rank: Math.min(existing.rank, candidate.rank),
      });
    }
  }
  return [...merged.values()];
}

function compareNetworkCandidates(
  left: NetworkMarketCandidate & { score: number },
  right: NetworkMarketCandidate & { score: number },
  query: MarketQueryDto,
): number {
  if (isNewCategory(query.category)) {
    return (
      networkMarketDiscoveredAt(right.market) - networkMarketDiscoveredAt(left.market)
      || right.score - left.score
      || left.rank - right.rank
      || left.market.id.localeCompare(right.market.id)
    );
  }
  return (
    right.score - left.score
    || networkMarketSyncedAt(right.market) - networkMarketSyncedAt(left.market)
    || left.rank - right.rank
    || left.market.id.localeCompare(right.market.id)
  );
}

function canAddNetworkCandidate(
  candidate: NetworkMarketCandidate,
  options: {
    diversifyEvents: boolean;
    diversifyCategories: boolean;
    eventCounts: Map<string, number>;
    categoryCounts: Map<string, number>;
    maxPerEvent: number;
    maxPerCategory: number;
  },
): boolean {
  if (options.diversifyEvents && candidate.market.eventId) {
    if ((options.eventCounts.get(candidate.market.eventId) ?? 0) >= options.maxPerEvent) return false;
  }
  if (options.diversifyCategories && candidate.category) {
    if ((options.categoryCounts.get(candidate.category) ?? 0) >= options.maxPerCategory) return false;
  }
  return true;
}

function incrementNetworkCandidateCounts(
  candidate: NetworkMarketCandidate,
  eventCounts: Map<string, number>,
  categoryCounts: Map<string, number>,
) {
  if (candidate.market.eventId) {
    eventCounts.set(candidate.market.eventId, (eventCounts.get(candidate.market.eventId) ?? 0) + 1);
  }
  if (candidate.category) {
    categoryCounts.set(candidate.category, (categoryCounts.get(candidate.category) ?? 0) + 1);
  }
}

function scoreNetworkCandidate(candidate: NetworkMarketCandidate): number {
  const market = candidate.market;
  const volume24hr = positiveNumber(market.volume24hr);
  const volume = positiveNumber(market.volume);
  const liquidity = positiveNumber(market.liquidity);
  const price = firstNumber(market.lastTradePrice, market.bestAsk, market.bestBid);
  const tradingSignal = market.acceptingOrders && market.enableOrderBook
    ? 0.42
    : market.acceptingOrders || market.enableOrderBook
      ? 0.16
      : -0.18;

  return (
    Math.log1p(volume24hr) * 1.15
    + Math.log1p(liquidity) * 0.55
    + Math.log1p(volume) * 0.35
    + Math.log1p(Math.max(candidate.graphScore, 0)) * 0.2
    + networkPriceSignal(price) * 0.32
    + tradingSignal
  );
}

function networkPriceSignal(price: number | null): number {
  if (price == null) return 0.25;
  if (price <= 0 || price >= 1) return 0;
  return Math.max(0, 1 - Math.abs(price - 0.5) * 2);
}

function positiveNumber(value: unknown): number {
  return Math.max(0, toNullableNumber(value) ?? 0);
}

function networkMarketSyncedAt(market: NetworkMarketRecord): number {
  return market.syncedAt instanceof Date ? market.syncedAt.getTime() : 0;
}

function networkMarketDiscoveredAt(market: NetworkMarketRecord): number {
  return market.discoveredAt instanceof Date ? market.discoveredAt.getTime() : 0;
}

function networkCandidateCategory(market: NetworkMarketRecord): string {
  return readMarketCategoryKey(market.event?.tags, [
    market.question,
    market.slug,
    market.event?.title,
    market.event?.slug,
  ]);
}

function scoreByVolume(value: unknown, index: number): number {
  const volume = toNullableNumber(value) ?? 0;
  return volume + Math.max(0, 1000 - index);
}

function normalizeHistoryInterval(value: string | undefined): '1h' | '6h' | '1d' | '1w' | '1m' | 'all' {
  if (value === '1h' || value === '6h' || value === '1d' || value === '1w' || value === '1m' || value === 'all') {
    return value;
  }
  return 'all';
}

function buildEventEdges(markets: NetworkMarketRecord[]) {
  const groups = new Map<string, NetworkMarketRecord[]>();
  for (const market of markets) {
    if (!market.eventId) continue;
    const group = groups.get(market.eventId) ?? [];
    group.push(market);
    groups.set(market.eventId, group);
  }

  return [...groups.entries()].flatMap(([eventId, group]) => {
    const [root, ...related] = group;
    if (!root) return [];
    return related.map((market) => ({
      id: `event:${eventId}:${root.id}:${market.id}`,
      source: root.id,
      target: market.id,
      relationType: 'event' as const,
      weight: 0.8,
    }));
  });
}

const NETWORK_RELATION_TYPES = ['tag', 'event', 'semantic', 'price_correlation', 'ai'] as const;
type NetworkRelationType = (typeof NETWORK_RELATION_TYPES)[number];

function formatNetworkRelationType(value: string): NetworkRelationType {
  return NETWORK_RELATION_TYPES.includes(value as NetworkRelationType) ? (value as NetworkRelationType) : 'semantic';
}
