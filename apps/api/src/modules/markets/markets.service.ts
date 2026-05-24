import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
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
import { GammaClient } from '../../integrations/polymarket/services/gamma.client';
import { EventDetailQueryDto, MarketHistoryQueryDto, MarketSearchQueryDto } from './dto/market-explorer-query.dto';
import { MarketQueryDto } from './dto/market-query.dto';

const OPEN_MARKET_WHERE = Prisma.validator<Prisma.PolymarketMarketWhereInput>()({
  active: true,
  closed: false,
  archived: false,
  staleDetectedAt: null,
});
const EVENT_DETAIL_MARKET_WHERE = Prisma.validator<Prisma.PolymarketMarketWhereInput>()({
  archived: false,
  staleDetectedAt: null,
});
const EVENT_DETAIL_MARKET_LIMIT = 200;
const DETAIL_CACHE_TTL_MS = 20 * 1000;
const DETAIL_CACHE_MAX_ENTRIES = 240;

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
  description: true,
  rules: true,
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
  endDate: true,
  discoveredAt: true,
  syncedAt: true,
  event: {
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      icon: true,
      image: true,
      tags: true,
      volume: true,
      liquidity: true,
      endDate: true,
      syncedAt: true,
      _count: {
        select: {
          markets: {
            where: OPEN_MARKET_WHERE,
          },
        },
      },
    },
  },
});

const EXPLORER_MARKET_SELECT = Prisma.validator<Prisma.PolymarketMarketSelect>()({
  ...MARKET_LIST_SELECT,
  description: true,
  rules: true,
  archived: true,
  staleDetectedAt: true,
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

const EVENT_DETAIL_MARKET_SELECT = Prisma.validator<Prisma.PolymarketMarketSelect>()({
  ...MARKET_LIST_SELECT,
  description: true,
  rules: true,
  archived: true,
  staleDetectedAt: true,
  orderMinSize: true,
  orderPriceMinTickSize: true,
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
  _count: {
    select: {
      markets: {
        where: EVENT_DETAIL_MARKET_WHERE,
      },
    },
  },
  markets: {
    where: EVENT_DETAIL_MARKET_WHERE,
    orderBy: [
      { closed: 'asc' },
      { active: 'desc' },
      { acceptingOrders: 'desc' },
      { enableOrderBook: 'desc' },
      { volume24hr: { sort: 'desc', nulls: 'last' } },
      { volume: { sort: 'desc', nulls: 'last' } },
      { id: 'asc' },
    ],
    take: EVENT_DETAIL_MARKET_LIMIT,
    select: EVENT_DETAIL_MARKET_SELECT,
  },
});

type MarketListRecord = Prisma.PolymarketMarketGetPayload<{ select: typeof MARKET_LIST_SELECT }>;
type MarketDetailRecord = Prisma.PolymarketMarketGetPayload<{ select: typeof MARKET_DETAIL_SELECT }>;
type NetworkMarketRecord = Prisma.PolymarketMarketGetPayload<{ select: typeof NETWORK_MARKET_SELECT }>;
type ExplorerMarketRecord = Prisma.PolymarketMarketGetPayload<{ select: typeof EXPLORER_MARKET_SELECT }>;
type EventDetailMarketRecord = Prisma.PolymarketMarketGetPayload<{ select: typeof EVENT_DETAIL_MARKET_SELECT }>;
type EventDetailRecord = Prisma.PolymarketEventGetPayload<{ select: typeof EVENT_DETAIL_SELECT }>;
type ExplorerMarketEventRecord = NonNullable<ExplorerMarketRecord['event']>;
type ExplorerMarketFormatRecord = (ExplorerMarketRecord | EventDetailMarketRecord) & {
  event?: ExplorerMarketEventRecord | null;
};
type NetworkTopologySource = 'precomputed' | 'deterministic';
type NetworkNodeType = 'event' | 'market';
type NetworkMarketCandidate = {
  market: NetworkMarketRecord;
  category: string | null;
  graphScore: number;
  rank: number;
};
type RankedNetworkMarketCandidate = NetworkMarketCandidate & {
  category: string;
  score: number;
};
type NetworkEventGroup = {
  id: string;
  eventId: string | null;
  category: string;
  primary: RankedNetworkMarketCandidate;
  candidates: RankedNetworkMarketCandidate[];
  score: number;
  discoveredAt: number;
  syncedAt: number;
  volume: number;
  volume24hr: number;
  liquidity: number;
  rank: number;
};
type NetworkNodePayload = { id: string; rules?: string | null; [key: string]: unknown };
type NetworkEdgePayload = { id: string; source: string; target: string; relationType: string; weight: number };
type MarketNetworkResponse = {
  nodes: NetworkNodePayload[];
  edges: NetworkEdgePayload[];
  total: number;
  totalEvents?: number;
  totalMarkets?: number;
  returned: number;
  limit: number;
  hasMore: boolean;
  category: string;
  nodeType: NetworkNodeType;
  source: 'database';
  topologySource: NetworkTopologySource;
  generatedAt: string;
  cacheStatus?: 'fresh' | 'stale';
};
type MarketNetworkCacheEntry = {
  value: MarketNetworkResponse;
  freshUntil: number;
  staleUntil: number;
};
type DetailCacheEntry<T> = {
  value: T;
  expiresAt: number;
  loadedAt: number;
};
type MarketCategoryCountRow = { category: string | null; count: bigint | number | string };
type MarketCategorySummary = {
  totalCount: number;
  hotCount: number;
  newCount: number;
  categoryCounts: Map<string, number>;
};

const NETWORK_CANDIDATE_MIN = 80;
const NETWORK_CANDIDATE_MAX = 400;
const NETWORK_CANDIDATE_MULTIPLIER = 8;
const NETWORK_NODE_TEXT_MAX_LENGTH = 1200;
const NEW_MARKET_WINDOW_DAYS = 14;
const MARKET_NETWORK_CACHE_TTL_MS = 5 * 60 * 1000;
const MARKET_NETWORK_STALE_TTL_MS = 15 * 60 * 1000;
const MARKET_NETWORK_CACHE_MAX_ENTRIES = 60;

const HOT_MARKET_ACTIVITY_WHERE = Prisma.validator<Prisma.PolymarketMarketWhereInput>()({
  OR: [
    { volume24hr: { gt: 0 } },
    { volume: { gt: 0 } },
    { liquidity: { gt: 0 } },
  ],
});

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);
  private readonly marketNetworkCache = new Map<string, MarketNetworkCacheEntry>();
  private readonly marketNetworkInFlight = new Map<string, Promise<MarketNetworkResponse>>();
  private readonly detailCache = new Map<string, DetailCacheEntry<unknown>>();
  private readonly detailInFlight = new Map<string, Promise<unknown>>();

  constructor(
    @Inject(ClobClient)
    private readonly clobClient: ClobClient,
    @Inject(GammaClient)
    private readonly gammaClient: GammaClient,
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
    const { totalCount, hotCount, newCount, categoryCounts } = await this.countOpenMarketCategorySummary();

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

  private async countOpenMarketCategorySummary(): Promise<MarketCategorySummary> {
    const newCutoff = newMarketCutoff();
    const rows = await this.prisma.$queryRaw<MarketCategoryCountRow[]>`
      WITH categorized AS (
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
        ) AS category,
        m."discoveredAt",
        m."volume24hr",
        m."volume",
        m."liquidity"
        FROM "PolymarketMarket" m
        LEFT JOIN "PolymarketEvent" e ON e."id" = m."eventId"
        WHERE m."active" = true
          AND m."closed" = false
          AND m."archived" = false
          AND m."staleDetectedAt" IS NULL
      )
      SELECT category, COUNT(*)::bigint AS count
      FROM categorized
      GROUP BY category
      UNION ALL
      SELECT '__all__' AS category, COUNT(*)::bigint AS count
      FROM categorized
      UNION ALL
      SELECT '__hot__' AS category, COUNT(*)::bigint AS count
      FROM categorized
      WHERE COALESCE("volume24hr", 0) > 0
         OR COALESCE("volume", 0) > 0
         OR COALESCE("liquidity", 0) > 0
      UNION ALL
      SELECT '__new__' AS category, COUNT(*)::bigint AS count
      FROM categorized
      WHERE "discoveredAt" >= ${newCutoff}
    `;
    let totalCount = 0;
    let hotCount = 0;
    let newCount = 0;
    const counts = new Map<string, number>();
    for (const row of rows) {
      const rawCategory = row.category ?? 'other';
      const count = Number(row.count);
      if (rawCategory === '__all__') {
        totalCount = count;
        continue;
      }
      if (rawCategory === '__hot__') {
        hotCount = count;
        continue;
      }
      if (rawCategory === '__new__') {
        newCount = count;
        continue;
      }
      const category = normalizeMarketCategoryKey(row.category) ?? 'other';
      counts.set(category, (counts.get(category) ?? 0) + count);
    }
    return {
      totalCount,
      hotCount,
      newCount,
      categoryCounts: counts,
    };
  }

  async searchMarkets(query: MarketSearchQueryDto) {
    const q = normalizeMarketLookupText(query.q);
    const limit = query.limit ?? 8;
    if (q.length < 2) {
      return {
        results: [],
        generatedAt: new Date().toISOString(),
        source: 'causeway_market_cache',
      };
    }
    try {
      const payload = await this.gammaClient.searchV2({ q, limitPerType: Math.max(6, Math.min(limit, 12)) });
      const results = formatGammaSearchResults(payload, limit);

      if (results.length) {
        return {
          results,
          generatedAt: new Date().toISOString(),
          source: 'polymarket_gamma_search_v2',
        };
      }
    } catch (error) {
      this.logger.warn(`Gamma market search failed for "${q.slice(0, 64)}"; falling back to local cache: ${errorLogMessage(error)}`);
    }

    const results = await this.searchCachedMarkets(q, limit);

    return {
      results,
      generatedAt: new Date().toISOString(),
      source: 'causeway_market_cache',
    };
  }

  private async searchCachedMarkets(q: string, limit: number): Promise<GammaSearchResult[]> {
    const markets = await this.prisma.polymarketMarket.findMany({
      where: {
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
        OR: [
          { question: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { event: { is: { title: { contains: q, mode: 'insensitive' } } } },
          { event: { is: { slug: { contains: q, mode: 'insensitive' } } } },
        ],
      },
      orderBy: [{ volume24hr: { sort: 'desc', nulls: 'last' } }, { volume: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
      take: limit,
      select: EXPLORER_MARKET_SELECT,
    });

    return markets.map((market, index) => formatCachedSearchResult(market, q, index));
  }

  async getMarket(marketId: string) {
    return this.withDetailCache(`market:id:${marketId}`, () => this.loadMarketById(marketId));
  }

  private async loadMarketById(marketId: string) {
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
    return this.withDetailCache(`market:slug:${slug}`, () => this.loadMarketBySlug(slug));
  }

  private async loadMarketBySlug(slug: string) {
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
    const cacheKey = eventDetailCacheKey(query);
    return this.withDetailCache(cacheKey, () => this.loadEventDetail(query), {
      force: parseBoolean(query.refresh) === true,
    });
  }

  private async loadEventDetail(query: EventDetailQueryDto) {
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

    const interval = normalizeHistoryInterval(query.interval);
    const fidelity = query.fidelity ?? 1440;
    return this.withDetailCache(`history:${interval}:${fidelity}:${tokenIds.join(',')}`, () => this.clobClient.getPriceHistory({
      tokenIds,
      interval,
      fidelity,
    }));
  }

  async getMarketNetwork(query: MarketQueryDto): Promise<MarketNetworkResponse> {
    const cacheKey = marketNetworkCacheKey(query);
    const cached = this.marketNetworkCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.freshUntil > now) {
      return {
        ...cached.value,
        cacheStatus: 'fresh',
      };
    }

    const inFlight = this.marketNetworkInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const request = this.loadMarketNetwork(query)
      .then((result) => {
        this.writeMarketNetworkCache(cacheKey, result);
        return result;
      })
      .catch((error: unknown) => {
        const stale = this.marketNetworkCache.get(cacheKey);
        if (stale && stale.staleUntil > Date.now() && isPrismaConnectionPoolTimeout(error)) {
          this.logger.warn(`Serving stale market network cache after database pool timeout: ${cacheKey}`);
          return {
            ...stale.value,
            cacheStatus: 'stale' as const,
          };
        }
        throw error;
      })
      .finally(() => {
        this.marketNetworkInFlight.delete(cacheKey);
      });
    this.marketNetworkInFlight.set(cacheKey, request);
    return request;
  }

  private async loadMarketNetwork(query: MarketQueryDto): Promise<MarketNetworkResponse> {
    const nodeType = normalizeNetworkNodeType(query.nodeType);
    if (nodeType === 'market') {
      return this.getMarketLevelNetwork(query);
    }
    return this.getEventLevelNetwork(query);
  }

  private writeMarketNetworkCache(cacheKey: string, value: MarketNetworkResponse): void {
    if (this.marketNetworkCache.size >= MARKET_NETWORK_CACHE_MAX_ENTRIES && !this.marketNetworkCache.has(cacheKey)) {
      const oldestKey = this.marketNetworkCache.keys().next().value;
      if (oldestKey) this.marketNetworkCache.delete(oldestKey);
    }
    const now = Date.now();
    this.marketNetworkCache.set(cacheKey, {
      value: {
        ...value,
        cacheStatus: undefined,
      },
      freshUntil: now + MARKET_NETWORK_CACHE_TTL_MS,
      staleUntil: now + MARKET_NETWORK_STALE_TTL_MS,
    });
  }

  private async withDetailCache<T>(
    cacheKey: string,
    load: () => Promise<T>,
    options: { force?: boolean } = {},
  ): Promise<T> {
    const cached = this.detailCache.get(cacheKey) as DetailCacheEntry<T> | undefined;
    const now = Date.now();
    if (!options.force && cached && cached.expiresAt > now) return cached.value;

    const inFlight = this.detailInFlight.get(cacheKey) as Promise<T> | undefined;
    if (!options.force && inFlight) return inFlight;

    const loadedAt = now;
    const request = load()
      .then((result) => {
        this.writeDetailCache(cacheKey, result, loadedAt);
        return result;
      })
      .finally(() => {
        if (this.detailInFlight.get(cacheKey) === request) {
          this.detailInFlight.delete(cacheKey);
        }
      });
    this.detailInFlight.set(cacheKey, request);
    return request;
  }

  private writeDetailCache<T>(cacheKey: string, value: T, loadedAt = Date.now()): void {
    const current = this.detailCache.get(cacheKey);
    if (current && current.loadedAt > loadedAt) return;
    if (this.detailCache.size >= DETAIL_CACHE_MAX_ENTRIES && !this.detailCache.has(cacheKey)) {
      const oldestKey = this.detailCache.keys().next().value;
      if (oldestKey) this.detailCache.delete(oldestKey);
    }
    this.detailCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + DETAIL_CACHE_TTL_MS,
      loadedAt,
    });
  }

  private async getEventLevelNetwork(query: MarketQueryDto): Promise<MarketNetworkResponse> {
    const limit = query.limit ?? 100;
    const marketWhere = this.buildWhere(query);
    const candidateLimit = networkCandidateLimit(limit);
    const nodesPromise = this.prisma.marketNetworkNode.findMany({
      where: this.buildNetworkNodeWhere(query),
      orderBy: { score: 'desc' },
      take: candidateLimit,
      include: {
        market: {
          select: NETWORK_MARKET_SELECT,
        },
      },
    });
    const totalPromise = this.safeNetworkMarketCount(marketWhere, 0);
    const totalEventsPromise = this.safeNetworkEventGroupCount(marketWhere, 0);
    const nodes = await nodesPromise;
    const candidates = nodes.length
      ? mergeNetworkCandidates(
          nodes.map((node, index) => ({
            market: node.market,
            category: node.category,
            graphScore: toNullableNumber(node.score) ?? 0,
            rank: index,
          })),
          await this.loadActivityNetworkCandidates(query, candidateLimit, nodes.length),
        )
      : await this.loadActivityNetworkCandidates(query, candidateLimit);
    const selectedGroups = selectNetworkEventGroups(candidates, query, limit);
    const [countedTotal, countedTotalEvents] = await Promise.all([totalPromise, totalEventsPromise]);
    const total = Math.max(countedTotal, candidates.length);
    const totalEvents = Math.max(countedTotalEvents, selectedGroups.length);

    return {
      nodes: selectedGroups.map((group) => this.formatNetworkEventNode(group)),
      edges: buildEventGroupEdges(selectedGroups),
      ...this.formatNetworkMeta(query, limit, total, selectedGroups.length, nodes.length ? 'precomputed' : 'deterministic', 'event', {
        totalEvents,
        totalMarkets: total,
        hasMore: totalEvents > selectedGroups.length,
      }),
    };
  }

  private async getMarketLevelNetwork(query: MarketQueryDto): Promise<MarketNetworkResponse> {
    const limit = query.limit ?? 100;
    const marketWhere = this.buildWhere(query);
    const candidateLimit = networkCandidateLimit(limit);
    const nodesPromise = this.prisma.marketNetworkNode.findMany({
      where: this.buildNetworkNodeWhere(query),
      orderBy: { score: 'desc' },
      take: candidateLimit,
      include: {
        market: {
          select: NETWORK_MARKET_SELECT,
        },
      },
    });
    const totalPromise = this.safeNetworkMarketCount(marketWhere, 0);
    const nodes = await nodesPromise;
    if (!nodes.length) {
      const activityCandidates = await this.loadActivityNetworkCandidates(query, candidateLimit);
      const selectedMarkets = selectNetworkCandidates(activityCandidates, query, limit);
      const total = Math.max(await totalPromise, activityCandidates.length);
      return this.formatDeterministicMarketLevelNetwork(query, limit, total, selectedMarkets);
    }
    const graphCandidates = nodes.map((node, index) => ({
      market: node.market,
      category: node.category,
      graphScore: toNullableNumber(node.score) ?? 0,
      rank: index,
    }));
    const activityCandidates = await this.loadActivityNetworkCandidates(query, candidateLimit, nodes.length);
    const selectedNodes = selectNetworkCandidates(
      mergeNetworkCandidates(graphCandidates, activityCandidates),
      query,
      limit,
    );
    const [edges, countedTotal] = await Promise.all([
      this.loadNetworkEdges(selectedNodes.map((node) => node.market.id), limit),
      totalPromise,
    ]);
    const total = Math.max(countedTotal, nodes.length, selectedNodes.length);

    return {
      nodes: selectedNodes.map((node) => this.formatNetworkNode(node.market, node.category)),
      edges: edges.length
        ? edges.map((edge) => ({
            id: edge.id,
            source: edge.sourceMarketId,
            target: edge.targetMarketId,
            relationType: formatNetworkRelationType(edge.relationType),
            weight: toNullableNumber(edge.weight) ?? 0,
          }))
        : buildEventEdges(selectedNodes.map((node) => node.market)),
      ...this.formatNetworkMeta(query, limit, total, selectedNodes.length, 'precomputed', 'market'),
    };
  }

  private formatDeterministicMarketLevelNetwork(
    query: MarketQueryDto,
    limit: number,
    total: number,
    selectedMarkets: NetworkMarketCandidate[],
  ): MarketNetworkResponse {
    return {
      nodes: selectedMarkets.map((candidate) => this.formatNetworkNode(candidate.market, candidate.category)),
      edges: buildEventEdges(selectedMarkets.map((candidate) => candidate.market)),
      ...this.formatNetworkMeta(query, limit, total, selectedMarkets.length, 'deterministic', 'market'),
    };
  }

  private async loadNetworkEdges(nodeMarketIds: string[], limit: number) {
    if (!nodeMarketIds.length) return [];
    return this.prisma.marketNetworkEdge.findMany({
      where: {
        sourceMarketId: { in: nodeMarketIds },
        targetMarketId: { in: nodeMarketIds },
      },
      orderBy: { weight: 'desc' },
      take: limit * 2,
    });
  }

  private baseOpenMarketWhere(): Prisma.PolymarketMarketWhereInput {
    return OPEN_MARKET_WHERE;
  }

  private async countNetworkEventGroups(marketWhere: Prisma.PolymarketMarketWhereInput): Promise<number> {
    const [eventGroups, standaloneMarketCount] = await Promise.all([
      this.prisma.polymarketMarket.groupBy({
        by: ['eventId'],
        where: {
          AND: [
            marketWhere,
            { eventId: { not: null } },
          ],
        },
      }),
      this.prisma.polymarketMarket.count({
        where: {
          AND: [
            marketWhere,
            { eventId: null },
          ],
        },
      }),
    ]);
    return eventGroups.length + standaloneMarketCount;
  }

  private async safeNetworkMarketCount(marketWhere: Prisma.PolymarketMarketWhereInput, fallback: number): Promise<number> {
    try {
      return await this.prisma.polymarketMarket.count({ where: marketWhere });
    } catch (error) {
      if (!isPrismaConnectionPoolTimeout(error)) throw error;
      this.logger.warn('Market network total count skipped after database pool timeout');
      return fallback;
    }
  }

  private async safeNetworkEventGroupCount(marketWhere: Prisma.PolymarketMarketWhereInput, fallback: number): Promise<number> {
    try {
      return await this.countNetworkEventGroups(marketWhere);
    } catch (error) {
      if (!isPrismaConnectionPoolTimeout(error)) throw error;
      this.logger.warn('Market network event group count skipped after database pool timeout');
      return fallback;
    }
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
    const identityFilters = marketIdentityFilters(query);
    if (identityFilters.length) {
      filters.push(identityFilters.length === 1 ? identityFilters[0] : { OR: identityFilters });
    }
    if (search) {
      filters.push({
        OR: [
          { question: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { event: { is: { title: { contains: search, mode: 'insensitive' } } } },
          { event: { is: { slug: { contains: search, mode: 'insensitive' } } } },
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
    nodeType: NetworkNodeType,
    options: { totalEvents?: number; totalMarkets?: number; hasMore?: boolean } = {},
  ) {
    return {
      total,
      totalEvents: options.totalEvents,
      totalMarkets: options.totalMarkets ?? total,
      returned,
      limit,
      hasMore: options.hasMore ?? total > returned,
      category: trimToUndefined(query.category) ?? 'all',
      nodeType,
      source: 'database' as const,
      topologySource,
      generatedAt: new Date().toISOString(),
    };
  }

  private async formatMarketDetail(
    market: MarketDetailRecord,
  ) {
    const listItem = this.formatMarketListItem(market);
    const description = firstNonBlankText(market.description);
    return {
      ...listItem,
      externalMarketId: market.externalMarketId,
      conditionId: market.conditionId,
      questionId: market.questionId,
      description,
      rules: firstNonBlankText(market.rules, description),
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
    const eventContext = eventDetailMarketEventContext(event);
    const markets = event.markets.map((market, index) => this.formatExplorerMarketNode(market, index, eventContext));
    const selectedMarketIndex = selectedMarket
      ? event.markets.findIndex((market) => market.id === selectedMarket.id)
      : -1;
    const selectedMarketNode = selectedMarket
      ? selectedMarketIndex >= 0
        ? markets[selectedMarketIndex]
        : this.formatExplorerMarketNode(selectedMarket, 0, eventContext)
      : null;
    const responseMarkets = selectedMarketNode && selectedMarketIndex < 0
      ? [selectedMarketNode, ...markets]
      : markets;
    const eventDescription = firstNonBlankText(event.description);
    const eventRules = firstNonBlankText(
      selectedMarketNode?.rules,
      responseMarkets.find((market) => market.rules)?.rules,
      eventDescription,
    );
    const marketsCount = event._count?.markets ?? responseMarkets.length;
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
        description: eventDescription,
        rules: eventRules,
        marketsCount,
        marketsReturned: responseMarkets.length,
        hasMoreMarkets: marketsCount > responseMarkets.length,
        syncedAt: event.syncedAt.toISOString(),
      },
      selectedMarket: selectedMarketNode,
      markets: responseMarkets,
      source: 'database',
      generatedAt: new Date().toISOString(),
    };
  }

  private formatExplorerMarketNode(
    market: ExplorerMarketFormatRecord,
    index: number,
    eventContext: ExplorerMarketEventRecord | null = null,
  ) {
    const event = market.event ?? eventContext;
    const category = readMarketCategoryKey(event?.tags, [
      market.question,
      market.slug,
      event?.title,
      event?.slug,
    ]);
    const description = firstNonBlankText(market.description);
    return {
      id: market.id,
      slug: market.slug,
      title: market.question,
      groupItemTitle: null,
      eventId: market.eventId,
      eventSlug: event?.slug ?? null,
      eventTitle: event?.title ?? null,
      active: market.active,
      closed: market.closed,
      archived: market.archived,
      staleDetectedAt: market.staleDetectedAt?.toISOString() ?? null,
      category,
      categoryKey: category,
      officialCategory: category,
      tags: marketCategoryTagsForResponse(event?.tags, category),
      icon: market.icon ?? market.image ?? event?.icon ?? event?.image,
      image: market.image ?? market.icon ?? event?.image ?? event?.icon,
      price: firstNumber(market.lastTradePrice, market.bestAsk, market.bestBid, market.outcomes[0]?.price),
      volume: toNullableNumber(market.volume),
      volume24hr: toNullableNumber(market.volume24hr),
      liquidity: toNullableNumber(market.liquidity),
      endDate: market.endDate?.toISOString() ?? null,
      description,
      rules: firstNonBlankText(market.rules, description),
      acceptingOrders: market.acceptingOrders,
      enableOrderBook: market.enableOrderBook,
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

  private formatNetworkEventNode(group: NetworkEventGroup) {
    const primaryMarket = group.primary.market;
    const event = primaryMarket.event;
    if (!event) {
      return this.formatNetworkNode(primaryMarket, group.category);
    }

    const description = firstNonBlankText(event.description, primaryMarket.description);
    const rules = firstNonBlankText(
      primaryMarket.rules,
      ...group.candidates.slice(0, 12).map((candidate) => candidate.market.rules),
      primaryMarket.description,
      event.description,
    );
    const eventIcon = event.icon ?? event.image ?? primaryMarket.icon ?? primaryMarket.image;
    const topMarkets = group.candidates.slice(0, 6).map((candidate) => ({
      marketId: candidate.market.id,
      title: candidate.market.question,
      groupItemTitle: marketQuestionDisplayLabel(candidate.market.question, event.title),
      price: firstNumber(candidate.market.lastTradePrice, candidate.market.bestAsk, candidate.market.bestBid),
      volume: toNullableNumber(candidate.market.volume),
    }));

    return {
      nodeType: 'event' as const,
      id: event.id,
      marketId: primaryMarket.id,
      eventId: event.id,
      slug: event.slug,
      eventSlug: event.slug,
      eventTitle: event.title,
      title: event.title,
      groupItemTitle: marketQuestionDisplayLabel(primaryMarket.question, event.title),
      description: compactNetworkText(description),
      rules: compactNetworkText(rules),
      icon: eventIcon,
      image: event.image ?? eventIcon,
      price: firstNumber(primaryMarket.lastTradePrice, primaryMarket.bestAsk, primaryMarket.bestBid),
      volume: toNullableNumber(event.volume) ?? group.volume,
      volume24hr: group.volume24hr,
      liquidity: toNullableNumber(event.liquidity) ?? group.liquidity,
      endDate: event.endDate?.toISOString() ?? primaryMarket.endDate?.toISOString() ?? null,
      acceptingOrders: group.candidates.some((candidate) => candidate.market.acceptingOrders),
      category: group.category,
      categoryKey: group.category,
      officialCategory: group.category,
      tags: marketCategoryTagsForResponse(event.tags, group.category),
      marketsCount: event._count?.markets ?? group.candidates.length,
      topMarkets,
      syncedAt: (event.syncedAt ?? primaryMarket.syncedAt).toISOString(),
    };
  }

  private formatNetworkNode(market: NetworkMarketRecord, category: string | null) {
    const normalizedCategory = category ?? readMarketCategoryKey(market.event?.tags, [
      market.question,
      market.slug,
      market.event?.title,
      market.event?.slug,
    ]);
    const description = firstNonBlankText(market.description);
    const rules = firstNonBlankText(market.rules, description);
    return {
      nodeType: 'market' as const,
      id: market.id,
      marketId: market.id,
      eventId: market.eventId,
      slug: market.slug,
      eventSlug: market.event?.slug ?? null,
      eventTitle: market.event?.title ?? null,
      title: market.question,
      groupItemTitle: marketQuestionDisplayLabel(market.question, market.event?.title ?? null),
      description: compactNetworkText(description),
      rules: compactNetworkText(rules),
      icon: market.icon ?? market.image ?? market.event?.icon ?? market.event?.image,
      image: market.image ?? market.icon ?? market.event?.image ?? market.event?.icon,
      price: firstNumber(market.lastTradePrice, market.bestAsk, market.bestBid),
      volume: toNullableNumber(market.volume),
      volume24hr: toNullableNumber(market.volume24hr),
      liquidity: toNullableNumber(market.liquidity),
      endDate: market.endDate?.toISOString() ?? market.event?.endDate?.toISOString() ?? null,
      acceptingOrders: market.acceptingOrders,
      category: normalizedCategory,
      categoryKey: normalizedCategory,
      officialCategory: normalizedCategory,
      tags: marketCategoryTagsForResponse(market.event?.tags, normalizedCategory),
      marketsCount: null,
      topMarkets: [],
      syncedAt: market.syncedAt.toISOString(),
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

function eventDetailCacheKey(query: EventDetailQueryDto): string {
  return JSON.stringify({
    eventId: trimToUndefined(query.eventId) ?? null,
    eventSlug: normalizeOptionalSlug(query.eventSlug) ?? null,
    marketId: trimToUndefined(query.marketId) ?? null,
  });
}

function eventDetailMarketEventContext(event: EventDetailRecord): ExplorerMarketEventRecord {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    tags: event.tags,
    icon: event.icon,
    image: event.image,
    volume: event.volume,
    liquidity: event.liquidity,
    endDate: event.endDate,
    syncedAt: event.syncedAt,
    description: event.description,
  };
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

function normalizeMarketLookupText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const polymarketSlug = extractPolymarketSlug(trimmed);
  return (polymarketSlug ?? trimmed).slice(0, 200);
}

function extractPolymarketSlug(value: string): string | null {
  const urlText = /^https?:\/\//i.test(value)
    ? value
    : /^(?:www\.)?polymarket\.com\//i.test(value)
      ? `https://${value}`
      : null;
  if (!urlText) return null;
  try {
    const url = new URL(urlText);
    if (!/(^|\.)polymarket\.com$/i.test(url.hostname)) return null;
    const segments = url.pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment.trim()))
      .filter(Boolean);
    const route = segments[0]?.toLowerCase();
    if ((route === 'event' || route === 'market') && segments[1]) return segments[1];
    return segments.at(-1) ?? null;
  } catch {
    return null;
  }
}

function marketIdentityFilters(query: MarketQueryDto): Prisma.PolymarketMarketWhereInput[] {
  const marketId = trimToUndefined(query.marketId);
  const marketSlug = normalizeOptionalSlug(query.marketSlug);
  const eventId = trimToUndefined(query.eventId);
  const eventSlug = normalizeOptionalSlug(query.eventSlug);
  const filters: Prisma.PolymarketMarketWhereInput[] = [];
  if (marketId) filters.push({ id: marketId });
  if (marketSlug) filters.push({ slug: marketSlug });
  if (eventId) filters.push({ eventId });
  if (eventSlug) filters.push({ event: { is: { slug: eventSlug } } });
  return filters;
}

function hasMarketIdentityFilter(query: MarketQueryDto): boolean {
  return marketIdentityFilters(query).length > 0;
}

function normalizeOptionalSlug(value: string | undefined): string | undefined {
  const normalized = value ? normalizeMarketLookupText(value) : '';
  return trimToUndefined(normalized);
}

function firstNonBlankText(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function compactNetworkText(value: string | null): string | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  if (normalized.length <= NETWORK_NODE_TEXT_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, NETWORK_NODE_TEXT_MAX_LENGTH - 3).trimEnd()}...`;
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

function normalizeNetworkNodeType(value: string | undefined): NetworkNodeType {
  return value === 'market' ? 'market' : 'event';
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

function marketNetworkCacheKey(query: MarketQueryDto): string {
  return JSON.stringify({
    active: query.active ?? null,
    category: query.category ?? null,
    closed: query.closed ?? null,
    eventId: query.eventId ?? null,
    eventSlug: normalizeOptionalSlug(query.eventSlug) ?? null,
    limit: query.limit ?? 100,
    marketId: query.marketId ?? null,
    marketSlug: normalizeOptionalSlug(query.marketSlug) ?? null,
    nodeType: normalizeNetworkNodeType(query.nodeType),
    q: trimToUndefined(query.q) ?? null,
  });
}

function isPrismaConnectionPoolTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('Timed out fetching a new connection from the connection pool');
}

function selectNetworkCandidates(
  candidates: NetworkMarketCandidate[],
  query: MarketQueryDto,
  limit: number,
): NetworkMarketCandidate[] {
  if (candidates.length <= limit) return candidates;

  const rankedCandidates = rankNetworkCandidates(candidates, query);
  const selected: typeof rankedCandidates = [];
  const selectedIds = new Set<string>();
  const eventCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const focusedSearch = Boolean(trimToUndefined(query.q) || hasMarketIdentityFilter(query));
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

function rankNetworkCandidates(
  candidates: NetworkMarketCandidate[],
  query: MarketQueryDto,
): RankedNetworkMarketCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      category: candidate.category ?? networkCandidateCategory(candidate.market),
      score: scoreNetworkCandidate(candidate),
    }))
    .sort((left, right) => compareNetworkCandidates(left, right, query));
}

function selectNetworkEventGroups(
  candidates: NetworkMarketCandidate[],
  query: MarketQueryDto,
  limit: number,
): NetworkEventGroup[] {
  const rankedCandidates = rankNetworkCandidates(candidates, query);
  const grouped = new Map<string, RankedNetworkMarketCandidate[]>();
  for (const candidate of rankedCandidates) {
    const groupId = networkEventGroupId(candidate.market);
    const group = grouped.get(groupId) ?? [];
    group.push(candidate);
    grouped.set(groupId, group);
  }

  const rankedGroups = [...grouped.entries()]
    .map(([id, groupCandidates]) => buildNetworkEventGroup(id, groupCandidates))
    .sort((left, right) => compareNetworkEventGroups(left, right, query));
  if (rankedGroups.length <= limit) return rankedGroups;

  const selected: NetworkEventGroup[] = [];
  const selectedIds = new Set<string>();
  const categoryCounts = new Map<string, number>();
  const focusedSearch = Boolean(trimToUndefined(query.q) || hasMarketIdentityFilter(query));
  const categoryFilter = normalizeCategoryFilter(query.category);
  const diversifyCategories = !focusedSearch && !categoryFilter;
  const maxPerCategory = Math.max(3, Math.ceil(limit * 0.36));

  for (const group of rankedGroups) {
    if (selected.length >= limit) break;
    if (diversifyCategories && (categoryCounts.get(group.category) ?? 0) >= maxPerCategory) continue;
    selected.push(group);
    selectedIds.add(group.id);
    categoryCounts.set(group.category, (categoryCounts.get(group.category) ?? 0) + 1);
  }

  for (const group of rankedGroups) {
    if (selected.length >= limit) break;
    if (selectedIds.has(group.id)) continue;
    selected.push(group);
    selectedIds.add(group.id);
  }

  return selected;
}

function networkEventGroupId(market: NetworkMarketRecord): string {
  return market.event?.id ?? market.eventId ?? `market:${market.id}`;
}

function buildNetworkEventGroup(id: string, candidates: RankedNetworkMarketCandidate[]): NetworkEventGroup {
  const primary = candidates[0];
  const volume = sumNetworkNumbers(candidates, (candidate) => candidate.market.volume);
  const volume24hr = sumNetworkNumbers(candidates, (candidate) => candidate.market.volume24hr);
  const liquidity = sumNetworkNumbers(candidates, (candidate) => candidate.market.liquidity);
  const score = Math.max(...candidates.map((candidate) => candidate.score))
    + Math.log1p(volume24hr) * 0.28
    + Math.log1p(liquidity) * 0.14
    + Math.log1p(candidates.length) * 0.1;
  return {
    id,
    eventId: primary.market.eventId,
    category: primary.category,
    primary,
    candidates,
    score,
    discoveredAt: Math.max(...candidates.map((candidate) => networkMarketDiscoveredAt(candidate.market))),
    syncedAt: Math.max(...candidates.map((candidate) => networkMarketSyncedAt(candidate.market))),
    volume,
    volume24hr,
    liquidity,
    rank: Math.min(...candidates.map((candidate) => candidate.rank)),
  };
}

function compareNetworkEventGroups(left: NetworkEventGroup, right: NetworkEventGroup, query: MarketQueryDto): number {
  if (isNewCategory(query.category)) {
    return (
      right.discoveredAt - left.discoveredAt
      || right.score - left.score
      || left.rank - right.rank
      || networkEventGroupTitle(left).localeCompare(networkEventGroupTitle(right))
    );
  }
  return (
    right.score - left.score
    || right.syncedAt - left.syncedAt
    || left.rank - right.rank
    || networkEventGroupTitle(left).localeCompare(networkEventGroupTitle(right))
  );
}

function networkEventGroupTitle(group: NetworkEventGroup): string {
  return group.primary.market.event?.title ?? group.primary.market.question;
}

function sumNetworkNumbers(
  candidates: RankedNetworkMarketCandidate[],
  read: (candidate: RankedNetworkMarketCandidate) => unknown,
): number {
  return candidates.reduce((sum, candidate) => sum + positiveNumber(read(candidate)), 0);
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

function buildEventGroupEdges(groups: NetworkEventGroup[]) {
  const edges: Array<{
    id: string;
    source: string;
    target: string;
    relationType: 'tag' | 'semantic';
    weight: number;
  }> = [];
  const categoryGroups = new Map<string, NetworkEventGroup[]>();
  for (const group of groups) {
    const categoryGroup = categoryGroups.get(group.category) ?? [];
    categoryGroup.push(group);
    categoryGroups.set(group.category, categoryGroup);
  }

  for (const [category, categoryGroup] of categoryGroups.entries()) {
    for (let index = 1; index < categoryGroup.length; index += 1) {
      const previous = categoryGroup[index - 1];
      const current = categoryGroup[index];
      edges.push({
        id: `category:${category}:${previous.id}:${current.id}`,
        source: previous.id,
        target: current.id,
        relationType: 'tag',
        weight: 0.52,
      });
    }
  }

  if (!edges.length) {
    for (let index = 1; index < groups.length; index += 1) {
      const previous = groups[index - 1];
      const current = groups[index];
      edges.push({
        id: `event-rank:${previous.id}:${current.id}`,
        source: previous.id,
        target: current.id,
        relationType: 'semantic',
        weight: 0.32,
      });
    }
  }

  return edges.slice(0, Math.max(0, groups.length * 2));
}

function marketQuestionDisplayLabel(question: string, eventTitle: string | null): string | null {
  let label = question.trim();
  if (!label) return null;
  label = label.replace(/^Will\s+/i, '');
  label = label.replace(/\?$/, '');
  if (eventTitle) {
    const escapedEventTitle = eventTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    label = label.replace(new RegExp(`\\s+(?:become|be|win)\\s+(?:the\\s+)?${escapedEventTitle}\\??$`, 'i'), '');
  }
  label = label.replace(/\s+win\s+the\s+\d{4}\s+FIFA\s+World\s+Cup\??$/i, '');
  label = label.replace(/\s+be\s+the\s+top\s+grossing\s+movie\s+of\s+\d{4}\??$/i, '');
  label = label.replace(/\s+win\s+on\s+\d{4}-\d{2}-\d{2}\??$/i, '');
  label = label.trim();
  return label && label !== question ? label : null;
}

function normalizeHistoryInterval(value: string | undefined): '1h' | '6h' | '1d' | '1w' | '1m' | 'all' {
  if (value === '1h' || value === '6h' || value === '1d' || value === '1w' || value === '1m' || value === 'all') {
    return value;
  }
  return 'all';
}

type GammaSearchResult = {
  type: 'market' | 'event' | 'topic';
  id: string;
  marketId: string | null;
  eventId: string | null;
  eventSlug: string | null;
  topic: string | null;
  slug: string | null;
  title: string;
  subtitle: string | null;
  category: string | null;
  categoryKey: string | null;
  icon: string | null;
  image: string | null;
  price: number | null;
  volume: number | null;
  liquidity: number | null;
  endDate: string | null;
  score: number;
  matchedBy: 'market' | 'event' | 'topic' | 'cache';
};

function formatCachedSearchResult(market: ExplorerMarketRecord, q: string, index: number): GammaSearchResult {
  const categoryKey = readMarketCategoryKey(market.event?.tags, [market.question, market.slug, market.event?.title]);
  const eventTitle = market.event?.title ?? null;
  const icon = market.icon ?? market.event?.icon ?? null;
  const image = market.image ?? market.event?.image ?? icon;
  return {
    type: 'market',
    id: `market:${market.id}`,
    marketId: market.id,
    eventId: market.eventId,
    eventSlug: market.event?.slug ?? null,
    topic: null,
    slug: market.slug,
    title: market.question,
    subtitle: eventTitle ?? market.slug,
    category: marketCategoryLabel(categoryKey),
    categoryKey,
    icon,
    image,
    price: firstNumber(market.lastTradePrice, market.bestAsk, market.bestBid, market.outcomes[0]?.price),
    volume: toNullableNumber(market.volume),
    liquidity: toNullableNumber(market.liquidity),
    endDate: market.endDate?.toISOString() ?? market.event?.endDate?.toISOString() ?? null,
    score: gammaScore(
      {
        volume: market.volume,
        liquidity: market.liquidity,
      },
      index,
    ),
    matchedBy: cachedSearchMatchType(market, q),
  };
}

function formatGammaSearchResults(payload: Record<string, unknown>, limit: number): GammaSearchResult[] {
  const results: GammaSearchResult[] = [];
  const events = readRecordArray(payload.events);
  const tags = readRecordArray(payload.tags);

  for (const [eventIndex, event] of events.entries()) {
    const eventId = readString(event.id);
    const eventSlug = readString(event.slug);
    const eventTitle = readString(event.title) ?? 'Polymarket event';
    const eventImage = readString(event.image) ?? readString(event.icon);
    const eventEndDate = readString(event.endDate);
    const markets = readRecordArray(event.markets);
    const eventCategoryKey = readMarketCategoryKey(event.tags, [eventTitle, eventSlug]);

    results.push({
      type: 'event',
      id: `event:${eventId ?? eventSlug ?? eventIndex}`,
      marketId: null,
      eventId,
      eventSlug,
      topic: null,
      slug: eventSlug,
      title: eventTitle,
      subtitle: `${markets.length} markets`,
      category: marketCategoryLabel(eventCategoryKey),
      categoryKey: eventCategoryKey,
      icon: eventImage,
      image: eventImage,
      price: null,
      volume: toNullableNumber(event.volume),
      liquidity: toNullableNumber(event.liquidity),
      endDate: eventEndDate,
      score: gammaScore(event, eventIndex),
      matchedBy: 'event',
    });

    for (const [marketIndex, market] of markets.entries()) {
      const marketId = readString(market.id);
      const marketSlug = readString(market.slug);
      const marketTitle = readString(market.question) ?? readString(market.groupItemTitle) ?? eventTitle;
      const marketCategoryKey = readMarketCategoryKey(event.tags, [marketTitle, marketSlug, eventTitle]);
      results.push({
        type: 'market',
        id: `market:${marketId ?? marketSlug ?? `${eventIndex}:${marketIndex}`}`,
        marketId,
        eventId,
        eventSlug,
        topic: null,
        slug: marketSlug,
        title: marketTitle,
        subtitle: readString(market.groupItemTitle) ?? eventTitle,
        category: marketCategoryLabel(marketCategoryKey),
        categoryKey: marketCategoryKey,
        icon: eventImage,
        image: eventImage,
        price: firstNumber(market.lastTradePrice, market.bestAsk, readOutcomePrice(market, 0)),
        volume: toNullableNumber(market.volume),
        liquidity: toNullableNumber(market.liquidity),
        endDate: readString(market.endDate) ?? eventEndDate,
        score: gammaScore(market, eventIndex * 100 + marketIndex),
        matchedBy: 'market',
      });
    }
  }

  for (const [index, tag] of tags.entries()) {
    const slug = readString(tag.slug);
    const label = readString(tag.label) ?? slug ?? 'Topic';
    const categoryKey = normalizeMarketCategoryKey(slug ?? label);
    results.push({
      type: 'topic',
      id: `topic:${readString(tag.id) ?? slug ?? index}`,
      marketId: null,
      eventId: null,
      eventSlug: null,
      topic: slug ?? label,
      slug,
      title: label,
      subtitle: `${toNullableNumber(tag.event_count) ?? 0} events`,
      category: categoryKey ? marketCategoryLabel(categoryKey) : null,
      categoryKey,
      icon: null,
      image: null,
      price: null,
      volume: null,
      liquidity: null,
      endDate: null,
      score: 500 - index,
      matchedBy: 'topic',
    });
  }

  return (['market', 'event', 'topic'] as const).flatMap((type) =>
    results
      .filter((result) => result.type === type)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit),
  );
}

function cachedSearchMatchType(market: ExplorerMarketRecord, q: string): GammaSearchResult['matchedBy'] {
  const needle = q.toLowerCase();
  if (market.question.toLowerCase().includes(needle) || market.slug.toLowerCase().includes(needle)) return 'market';
  if (market.event?.title?.toLowerCase().includes(needle) || market.event?.slug?.toLowerCase().includes(needle)) return 'event';
  return 'cache';
}

function errorLogMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'unknown error';
}

function gammaScore(value: Record<string, unknown>, index: number): number {
  return (
    (toNullableNumber(value.volume) ?? 0)
    + (toNullableNumber(value.liquidity) ?? 0) * 0.1
    + Math.max(0, 1000 - index)
  );
}

function readOutcomePrice(market: Record<string, unknown>, index: number): number | null {
  const prices = Array.isArray(market.outcomePrices) ? market.outcomePrices : [];
  return toNullableNumber(prices[index]);
}

function readRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const NETWORK_RELATION_TYPES = ['tag', 'event', 'semantic', 'price_correlation', 'ai'] as const;
type NetworkRelationType = (typeof NETWORK_RELATION_TYPES)[number];

function formatNetworkRelationType(value: string): NetworkRelationType {
  return NETWORK_RELATION_TYPES.includes(value as NetworkRelationType) ? (value as NetworkRelationType) : 'semantic';
}
