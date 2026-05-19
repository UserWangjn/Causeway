import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ApiException } from '../../common/errors/api.exception';
import {
  decodeOpaqueCursor,
  encodeOpaqueCursor,
  invalidPaginationCursor,
  isRecord,
} from '../../common/pagination/opaque-cursor';
import { toNullableNumber } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';
import { ClobClient } from '../../integrations/polymarket/services/clob.client';
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

const MARKET_DETAIL_INCLUDE = Prisma.validator<Prisma.PolymarketMarketInclude>()({
  event: true,
  outcomes: {
    orderBy: { outcomeIndex: 'asc' },
  },
});

const NETWORK_MARKET_SELECT = Prisma.validator<Prisma.PolymarketMarketSelect>()({
  id: true,
  eventId: true,
  slug: true,
  question: true,
  icon: true,
  image: true,
  bestBid: true,
  bestAsk: true,
  lastTradePrice: true,
  volume: true,
  event: {
    select: {
      tags: true,
    },
  },
});

type MarketListRecord = Prisma.PolymarketMarketGetPayload<{ select: typeof MARKET_LIST_SELECT }>;
type MarketDetailRecord = Prisma.PolymarketMarketGetPayload<{ include: typeof MARKET_DETAIL_INCLUDE }>;
type NetworkMarketRecord = Prisma.PolymarketMarketGetPayload<{ select: typeof NETWORK_MARKET_SELECT }>;

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

  async getMarket(marketId: string) {
    const market = await this.prisma.polymarketMarket.findUnique({
      where: { id: marketId },
      include: MARKET_DETAIL_INCLUDE,
    });
    if (!market) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'MARKET_NOT_FOUND', 'Market was not found');
    }
    return this.formatMarketDetail(market);
  }

  async getMarketBySlug(slug: string) {
    const market = await this.prisma.polymarketMarket.findUnique({
      where: { slug },
      include: MARKET_DETAIL_INCLUDE,
    });
    if (!market) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'MARKET_NOT_FOUND', 'Market was not found');
    }
    return this.formatMarketDetail(market);
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

  async getMarketNetwork(query: MarketQueryDto) {
    const limit = query.limit ?? 100;
    const nodes = await this.prisma.marketNetworkNode.findMany({
      where: this.buildNetworkNodeWhere(query),
      orderBy: { score: 'desc' },
      take: limit,
      include: {
        market: {
          select: NETWORK_MARKET_SELECT,
        },
      },
    });
    if (!nodes.length) {
      return this.buildDeterministicMarketNetwork(query, limit);
    }

    const nodeMarketIds = nodes.map((node) => node.marketId);
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
      nodes: nodes.map((node) => this.formatNetworkNode(node.market, node.category)),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceMarketId,
        target: edge.targetMarketId,
        relationType: formatNetworkRelationType(edge.relationType),
        weight: toNullableNumber(edge.weight) ?? 0,
      })),
    };
  }

  private buildWhere(query: MarketQueryDto, options: { includeCategory?: boolean } = {}): Prisma.PolymarketMarketWhereInput {
    const includeCategory = options.includeCategory ?? true;
    const search = trimToUndefined(query.q);
    const category = trimToUndefined(query.category);
    return {
      active: parseBoolean(query.active),
      closed: parseBoolean(query.closed),
      OR: search
        ? [
            { question: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
      event: includeCategory && category
        ? {
            tags: {
              array_contains: [category],
            },
          }
        : undefined,
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
    const category = trimToUndefined(query.category);
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

  private async buildDeterministicMarketNetwork(query: MarketQueryDto, limit: number) {
    const markets = await this.prisma.polymarketMarket.findMany({
      where: this.buildWhere(query),
      orderBy: [{ volume: 'desc' }, { id: 'asc' }],
      take: limit,
      select: NETWORK_MARKET_SELECT,
    });

    return {
      nodes: markets.map((market) => this.formatNetworkNode(market, null)),
      edges: buildEventEdges(markets),
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
      category: category ?? firstStringTag(market.event?.tags),
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

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toNullableNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function firstStringTag(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const tag = value.find((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return tag?.trim() ?? null;
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
