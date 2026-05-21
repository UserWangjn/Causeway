import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { CausewayOrderStatus, Prisma, SyncRunStatus } from '@prisma/client';
import { ApiException } from '../../common/errors/api.exception';
import {
  decodeOpaqueCursor,
  encodeOpaqueCursor,
  invalidPaginationCursor,
  isRecord,
} from '../../common/pagination/opaque-cursor';
import { PrismaService } from '../../database/prisma.service';
import {
  getGammaMarketSkipReason,
  normalizeGammaMarket,
  type NormalizedGammaEvent,
  type NormalizedGammaMarket,
} from '../../integrations/polymarket/gamma-normalizer';
import { GammaClient } from '../../integrations/polymarket/services/gamma.client';
import { SyncPolymarketDto } from './dto/sync-polymarket.dto';
import { SyncRunsQueryDto } from './dto/sync-runs-query.dto';

@Injectable()
export class PolymarketSyncService {
  private readonly pageSize = 100;
  private readonly eventPageSize = 100;
  private readonly eventUpsertConcurrency = 3;
  private readonly marketUpsertConcurrency = 4;

  constructor(
    @Inject(GammaClient)
    private readonly gammaClient: GammaClient,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async syncPolymarket(dto: SyncPolymarketDto, options: { abortSignal?: AbortSignal } = {}) {
    const scope = dto.scope ?? 'markets';
    const mode = dto.mode ?? 'incremental';
    if (scope !== 'markets') {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, 'CAPABILITY_UNAVAILABLE', `${scope} sync is not implemented yet`);
    }
    let fetchedCount = 0;
    let upsertedCount = 0;
    let skippedPayloads: SkippedGammaPayload[] = [];

    const syncRun = await this.prisma.syncRun.create({
      data: {
        jobType: 'polymarket_sync',
        scope,
        status: 'running',
        metadata: toJson({ mode }),
      },
    });

    try {
      throwIfSyncAborted(options.abortSignal);
      let metadata: Record<string, unknown> = {};
      if (mode === 'full') {
        const result = await this.syncFullDiscovery(syncRun.id, dto.limit, options.abortSignal);
        fetchedCount = result.fetchedCount;
        upsertedCount = result.upsertedCount;
        skippedPayloads = result.skippedPayloads;
        metadata = result.metadata;
      } else if (mode === 'hot') {
        const result = await this.syncHotMarkets(syncRun.id, dto.limit, dto.hotEventLimit, options.abortSignal);
        fetchedCount = result.fetchedCount;
        upsertedCount = result.upsertedCount;
        skippedPayloads = result.skippedPayloads;
        metadata = result.metadata;
      } else {
        const payloads = await this.fetchMarkets(dto.limit ?? 100, mode, options.abortSignal);
        fetchedCount = payloads.length;
        throwIfSyncAborted(options.abortSignal);
        const normalizedResult = this.normalizePayloads(payloads);
        skippedPayloads = normalizedResult.skippedPayloads;

        for (const market of normalizedResult.normalizedMarkets) {
          throwIfSyncAborted(options.abortSignal);
          await this.upsertMarket(market, { abortSignal: options.abortSignal, seenAt: new Date() });
          upsertedCount += 1;
        }
        throwIfSyncAborted(options.abortSignal);
        metadata = { pageSize: this.pageSize };
      }

      const completedRun = await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'completed',
          finishedAt: new Date(),
          fetchedCount,
          upsertedCount,
          cursor: String(fetchedCount),
          metadata: toJson({
            mode,
            ...metadata,
            skippedCount: skippedPayloads.length,
            skippedPayloads: skippedPayloads.slice(0, 50),
          }),
        },
      });

      return {
        runId: completedRun.id,
        scope,
        mode,
        status: completedRun.status,
        fetchedCount: completedRun.fetchedCount,
        upsertedCount: completedRun.upsertedCount,
        skippedCount: skippedPayloads.length,
      };
    } catch (error) {
      await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          fetchedCount,
          upsertedCount,
          error: error instanceof Error ? error.message : String(error),
          metadata: toJson({
            mode,
            pageSize: mode === 'full' ? this.eventPageSize : this.pageSize,
            skippedCount: skippedPayloads.length,
            skippedPayloads: skippedPayloads.slice(0, 50),
          }),
        },
      });
      throw error;
    }
  }

  async listRuns(query: SyncRunsQueryDto = {}) {
    const limit = query.limit ?? 50;
    const cursor = decodeSyncRunCursor(query.cursor);
    const runs = await this.prisma.syncRun.findMany({
      where: buildSyncRunWhere(query, cursor),
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
      take: limit + 1,
    });
    const items = runs.slice(0, limit);

    return {
      items: items.map((run) => ({
        id: run.id,
        jobType: run.jobType,
        scope: run.scope,
        status: run.status,
        fetchedCount: run.fetchedCount,
        upsertedCount: run.upsertedCount,
        error: run.error,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
      })),
      nextCursor: runs.length > limit ? encodeSyncRunCursor(items.at(-1)) : null,
      hasMore: runs.length > limit,
    };
  }

  private normalizePayloads(payloads: Record<string, unknown>[]) {
    const normalizedMarkets: NormalizedGammaMarket[] = [];
    const skippedPayloads: SkippedGammaPayload[] = [];

    payloads.forEach((payload, index) => {
      const market = normalizeGammaMarket(payload);
      if (market) {
        normalizedMarkets.push(market);
        return;
      }

      skippedPayloads.push({
        index,
        reason: getGammaMarketSkipReason(payload) ?? 'invalid_payload',
        externalMarketId: readStringField(payload, 'id') ?? readStringField(payload, 'marketId'),
        slug: readStringField(payload, 'slug'),
      });
    });

    return { normalizedMarkets, skippedPayloads };
  }

  private async fetchMarkets(limit: number, mode: string, abortSignal?: AbortSignal) {
    const payloads: Record<string, unknown>[] = [];

    for (let offset = 0; payloads.length < limit; offset += this.pageSize) {
      throwIfSyncAborted(abortSignal);
      const remaining = limit - payloads.length;
      const pageLimit = Math.min(this.pageSize, remaining);
      const page = await this.gammaClient.getMarkets(
        {
          limit: pageLimit,
          offset,
          active: mode === 'incremental' ? true : undefined,
          closed: false,
        },
        { signal: abortSignal },
      );
      throwIfSyncAborted(abortSignal);

      payloads.push(...page);
      if (page.length < pageLimit) break;
    }

    return payloads;
  }

  private async syncFullDiscovery(
    syncRunId: string,
    marketLimit: number | undefined,
    abortSignal?: AbortSignal,
  ): Promise<FullDiscoveryResult> {
    const syncStartedAt = new Date();
    let fetchedCount = 0;
    let upsertedCount = 0;
    let eventCount = 0;
    let pageCount = 0;
    let skippedPayloads: SkippedGammaPayload[] = [];
    const completeDiscovery = marketLimit == null;
    const seenMarketKeys = new Set<string>();

    for (let offset = 0; ; offset += this.eventPageSize) {
      throwIfSyncAborted(abortSignal);
      const events = await this.gammaClient.getEvents(
        {
          limit: this.eventPageSize,
          offset,
          active: true,
          closed: false,
        },
        { signal: abortSignal },
      );
      throwIfSyncAborted(abortSignal);

      pageCount += 1;
      eventCount += events.length;
      const remaining = marketLimit == null ? Number.POSITIVE_INFINITY : Math.max(0, marketLimit - fetchedCount);
      const payloads = takeNewMarketPayloads(flattenEventMarketPayloads(events), seenMarketKeys, remaining);
      fetchedCount += payloads.length;

      const normalizedResult = this.normalizePayloads(payloads);
      skippedPayloads = skippedPayloads.concat(normalizedResult.skippedPayloads.map((payload) => ({
        ...payload,
        index: payload.index + fetchedCount - payloads.length,
      })));

      const eventIdByExternalId = await this.upsertEventsForMarkets(normalizedResult.normalizedMarkets, syncStartedAt, abortSignal);
      await mapWithConcurrency(
        normalizedResult.normalizedMarkets,
        this.marketUpsertConcurrency,
        async (market) => {
          throwIfSyncAborted(abortSignal);
          await this.upsertMarket(market, {
            abortSignal,
            seenAt: syncStartedAt,
            eventId: market.event ? eventIdByExternalId.get(market.event.externalEventId) ?? null : null,
            skipEventUpsert: true,
          });
        },
      );
      upsertedCount += normalizedResult.normalizedMarkets.length;

      await this.prisma.syncRun.update({
        where: { id: syncRunId },
        data: {
          fetchedCount,
          upsertedCount,
          cursor: String(offset + events.length),
          metadata: toJson({
            mode: 'full',
            source: 'events',
            eventPageSize: this.eventPageSize,
            eventCount,
            pageCount,
            uniqueMarketCount: seenMarketKeys.size,
            skippedCount: skippedPayloads.length,
            partial: !completeDiscovery,
          }),
        },
      });

      if (events.length < this.eventPageSize || (marketLimit != null && fetchedCount >= marketLimit)) {
        break;
      }
    }

    const stale = completeDiscovery ? await this.markStaleAfterFullDiscovery(syncStartedAt) : { staleMarkets: 0, staleEvents: 0 };
    return {
      fetchedCount,
      upsertedCount,
      skippedPayloads,
      metadata: {
        source: 'events',
        eventPageSize: this.eventPageSize,
        eventCount,
        pageCount,
        uniqueMarketCount: seenMarketKeys.size,
        staleMarkets: stale.staleMarkets,
        staleEvents: stale.staleEvents,
        partial: !completeDiscovery,
      },
    };
  }

  private async syncHotMarkets(
    syncRunId: string,
    marketLimit: number | undefined,
    hotEventLimit: number | undefined,
    abortSignal?: AbortSignal,
  ): Promise<HotSyncResult> {
    const syncStartedAt = new Date();
    const limit = marketLimit ?? 250;
    const eventLimit = Math.min(hotEventLimit ?? 50, limit);
    const seenMarketKeys = new Set<string>();
    const skippedPayloads: SkippedGammaPayload[] = [];

    throwIfSyncAborted(abortSignal);
    const events = await this.gammaClient.getEvents(
      {
        limit: eventLimit,
        offset: 0,
        active: true,
        closed: false,
        order: 'volume_24hr',
        ascending: false,
      },
      { signal: abortSignal },
    );
    throwIfSyncAborted(abortSignal);

    const eventPayloadCandidates = flattenEventMarketPayloads(events);
    const eventCandidateKeys = new Set(eventPayloadCandidates.map(getMarketPayloadKey).filter((key): key is string => Boolean(key)));
    const localCandidateLimit = Math.min(limit, Math.max(25, Math.ceil(limit * 0.4)));
    const localCandidates = await this.loadHotMarketCandidates(localCandidateLimit);
    const localCandidateKeys = new Set(localCandidates.map((candidate) => `externalMarketId:${candidate.externalMarketId}`));
    const localEventIdByExternalMarketId = new Map<string, string | null>();
    const localLookupCandidates = localCandidates.filter((candidate) => !eventCandidateKeys.has(`externalMarketId:${candidate.externalMarketId}`));
    const localPayloadsByPriority = new Array<Record<string, unknown> | null>(localLookupCandidates.length).fill(null);

    await mapWithConcurrency(localLookupCandidates, Math.min(4, this.marketUpsertConcurrency), async (candidate, index) => {
      throwIfSyncAborted(abortSignal);
      localEventIdByExternalMarketId.set(candidate.externalMarketId, candidate.eventId);
      try {
        const payload = await this.gammaClient.getMarketById(candidate.externalMarketId, { signal: abortSignal });
        localPayloadsByPriority[index] = payload;
      } catch (error) {
        throwIfSyncAborted(abortSignal);
        skippedPayloads.push({
          index,
          reason: `gamma_lookup_failed:${error instanceof Error ? error.message : String(error)}`,
          externalMarketId: candidate.externalMarketId,
          slug: candidate.slug,
        });
      }
    });

    const localEventPayloads = eventPayloadCandidates.filter((payload) => {
      const key = getMarketPayloadKey(payload);
      return key ? localCandidateKeys.has(key) : false;
    });
    const localPayloads = localPayloadsByPriority.filter((payload): payload is Record<string, unknown> => Boolean(payload));
    const payloads: Record<string, unknown>[] = [];
    payloads.push(...takeNewMarketPayloads(localEventPayloads, seenMarketKeys, limit));
    payloads.push(...takeNewMarketPayloads(localPayloads, seenMarketKeys, Math.max(0, limit - payloads.length)));
    payloads.push(...takeNewMarketPayloads(eventPayloadCandidates, seenMarketKeys, Math.max(0, limit - payloads.length)));
    const normalizedResult = this.normalizePayloads(payloads);
    skippedPayloads.push(...normalizedResult.skippedPayloads);

    const eventIdByExternalId = await this.upsertEventsForMarkets(normalizedResult.normalizedMarkets, syncStartedAt, abortSignal);
    await mapWithConcurrency(
      normalizedResult.normalizedMarkets,
      this.marketUpsertConcurrency,
      async (market) => {
        throwIfSyncAborted(abortSignal);
        const fallbackEventId = market.externalMarketId ? localEventIdByExternalMarketId.get(market.externalMarketId) ?? null : null;
        await this.upsertMarket(market, {
          abortSignal,
          seenAt: syncStartedAt,
          eventId: market.event ? eventIdByExternalId.get(market.event.externalEventId) ?? null : fallbackEventId,
          skipEventUpsert: true,
        });
      },
    );

    await this.prisma.syncRun.update({
      where: { id: syncRunId },
      data: {
        fetchedCount: payloads.length,
        upsertedCount: normalizedResult.normalizedMarkets.length,
        cursor: String(payloads.length),
        metadata: toJson({
          mode: 'hot',
          source: 'events_and_local_hotset',
          eventLimit,
          eventCount: events.length,
          eventMarketCount: eventPayloadCandidates.length,
          localCandidateCount: localCandidates.length,
          localLookupCount: localLookupCandidates.length,
          localFetchedCount: localPayloads.length,
          skippedCount: skippedPayloads.length,
          skippedPayloads: skippedPayloads.slice(0, 50),
        }),
      },
    });

    return {
      fetchedCount: payloads.length,
      upsertedCount: normalizedResult.normalizedMarkets.length,
      skippedPayloads,
      metadata: {
        source: 'events_and_local_hotset',
        eventLimit,
        eventCount: events.length,
        eventMarketCount: eventPayloadCandidates.length,
        localCandidateCount: localCandidates.length,
        localLookupCount: localLookupCandidates.length,
        localFetchedCount: localPayloads.length,
      },
    };
  }

  private async loadHotMarketCandidates(limit: number): Promise<HotMarketCandidate[]> {
    if (limit <= 0) return [];

    const orderCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const scriptCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const openOrderStatuses = [CausewayOrderStatus.submitted, CausewayOrderStatus.partially_filled, CausewayOrderStatus.unknown] satisfies CausewayOrderStatus[];
    const hotMarketWhere = {
      active: true,
      closed: false,
      archived: false,
      acceptingOrders: true,
      enableOrderBook: true,
      staleDetectedAt: null,
      externalMarketId: {
        not: null,
      },
    } satisfies Prisma.PolymarketMarketWhereInput;
    const marketSelect = {
      externalMarketId: true,
      slug: true,
      eventId: true,
    } satisfies Prisma.PolymarketMarketSelect;
    const [openOrders, recentOrders, recentScriptMarkets, topLocalMarkets] = await Promise.all([
      this.prisma.causewayOrder.findMany({
        where: {
          status: {
            in: openOrderStatuses,
          },
          market: hotMarketWhere,
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
        select: {
          market: {
            select: marketSelect,
          },
        },
      }),
      this.prisma.causewayOrder.findMany({
        where: {
          createdAt: { gte: orderCutoff },
          market: hotMarketWhere,
        },
        orderBy: [{ updatedAt: 'desc' }],
        take: limit,
        select: {
          market: {
            select: marketSelect,
          },
        },
      }),
      this.prisma.scriptMarket.findMany({
        where: {
          createdAt: { gte: scriptCutoff },
          market: hotMarketWhere,
        },
        orderBy: [{ createdAt: 'desc' }],
        take: limit,
        select: {
          market: {
            select: marketSelect,
          },
        },
      }),
      this.prisma.polymarketMarket.findMany({
        where: hotMarketWhere,
        orderBy: [{ volume24hr: { sort: 'desc', nulls: 'last' } }, { volume: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
        take: limit,
        select: marketSelect,
      }),
    ]);

    const candidates: HotMarketCandidate[] = [];
    const seen = new Set<string>();
    const appendCandidate = (market: { externalMarketId: string | null; slug: string; eventId: string | null }) => {
      if (!market.externalMarketId || seen.has(market.externalMarketId) || candidates.length >= limit) return;
      seen.add(market.externalMarketId);
      candidates.push({
        externalMarketId: market.externalMarketId,
        slug: market.slug,
        eventId: market.eventId,
      });
    };

    openOrders.forEach((row) => appendCandidate(row.market));
    recentOrders.forEach((row) => appendCandidate(row.market));
    recentScriptMarkets.forEach((row) => appendCandidate(row.market));
    topLocalMarkets.forEach(appendCandidate);
    return candidates;
  }

  private async upsertEventsForMarkets(
    markets: NormalizedGammaMarket[],
    seenAt: Date,
    abortSignal?: AbortSignal,
  ): Promise<Map<string, string>> {
    const events = new Map<string, NormalizedGammaEvent>();
    for (const market of markets) {
      if (market.event) {
        events.set(market.event.externalEventId, market.event);
      }
    }

    await mapWithConcurrency([...events.values()], this.eventUpsertConcurrency, async (event) => {
      throwIfSyncAborted(abortSignal);
      await this.upsertEvent(event, seenAt);
    });

    if (!events.size) return new Map();
    const rows = await this.prisma.polymarketEvent.findMany({
      where: {
        externalEventId: {
          in: [...events.keys()],
        },
      },
      select: {
        id: true,
        externalEventId: true,
      },
    });
    return new Map(rows.map((row) => [row.externalEventId, row.id]));
  }

  private async upsertEvent(event: NormalizedGammaEvent, seenAt: Date): Promise<string> {
    const saved = await this.prisma.polymarketEvent.upsert({
      where: { externalEventId: event.externalEventId },
      update: {
        slug: event.slug,
        title: event.title,
        description: event.description,
        image: event.image,
        icon: event.icon,
        tags: toJson(event.tags),
        active: event.active,
        closed: event.closed,
        archived: event.archived,
        restricted: event.restricted,
        endDate: event.endDate,
        volume: event.volume,
        liquidity: event.liquidity,
        openInterest: event.openInterest,
        rawPayload: toJson(event.rawPayload),
        syncedAt: seenAt,
        lastSeenAt: seenAt,
        staleDetectedAt: null,
        staleReason: null,
      },
      create: {
        externalEventId: event.externalEventId,
        slug: event.slug,
        title: event.title,
        description: event.description,
        image: event.image,
        icon: event.icon,
        tags: toJson(event.tags),
        active: event.active,
        closed: event.closed,
        archived: event.archived,
        restricted: event.restricted,
        endDate: event.endDate,
        volume: event.volume,
        liquidity: event.liquidity,
        openInterest: event.openInterest,
        rawPayload: toJson(event.rawPayload),
        syncedAt: seenAt,
        lastSeenAt: seenAt,
      },
      select: {
        id: true,
      },
    });

    return saved.id;
  }

  private async markStaleAfterFullDiscovery(syncStartedAt: Date): Promise<{ staleMarkets: number; staleEvents: number }> {
    const staleDetectedAt = new Date();
    const staleMarkets = await this.prisma.polymarketMarket.updateMany({
      where: {
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: syncStartedAt } },
        ],
      },
      data: {
        acceptingOrders: false,
        enableOrderBook: false,
        staleDetectedAt,
        staleReason: 'not_seen_in_full_discovery',
      },
    });
    const staleEvents = await this.prisma.polymarketEvent.updateMany({
      where: {
        active: true,
        closed: false,
        archived: false,
        staleDetectedAt: null,
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: syncStartedAt } },
        ],
      },
      data: {
        staleDetectedAt,
        staleReason: 'not_seen_in_full_discovery',
      },
    });

    return {
      staleMarkets: staleMarkets.count,
      staleEvents: staleEvents.count,
    };
  }

  private async upsertMarket(market: NormalizedGammaMarket, options: UpsertMarketOptions = {}): Promise<void> {
    const { abortSignal, seenAt = new Date(), eventId = null, skipEventUpsert = false } = options;
    throwIfSyncAborted(abortSignal);
    await this.prisma.$transaction(async (tx) => {
      throwIfSyncAborted(abortSignal);
      const syncedAt = seenAt;
      const event = !skipEventUpsert && market.event
        ? await tx.polymarketEvent.upsert({
            where: { externalEventId: market.event.externalEventId },
            update: {
              slug: market.event.slug,
              title: market.event.title,
              description: market.event.description,
              image: market.event.image,
              icon: market.event.icon,
              tags: toJson(market.event.tags),
              active: market.event.active,
              closed: market.event.closed,
              archived: market.event.archived,
              restricted: market.event.restricted,
              endDate: market.event.endDate,
              volume: market.event.volume,
              liquidity: market.event.liquidity,
              openInterest: market.event.openInterest,
              rawPayload: toJson(market.event.rawPayload),
              syncedAt,
              lastSeenAt: syncedAt,
              staleDetectedAt: null,
              staleReason: null,
            },
            create: {
              externalEventId: market.event.externalEventId,
              slug: market.event.slug,
              title: market.event.title,
              description: market.event.description,
              image: market.event.image,
              icon: market.event.icon,
              tags: toJson(market.event.tags),
              active: market.event.active,
              closed: market.event.closed,
              archived: market.event.archived,
              restricted: market.event.restricted,
              endDate: market.event.endDate,
              volume: market.event.volume,
              liquidity: market.event.liquidity,
              openInterest: market.event.openInterest,
              rawPayload: toJson(market.event.rawPayload),
              syncedAt,
              lastSeenAt: syncedAt,
            },
          })
        : null;
      throwIfSyncAborted(abortSignal);

      const marketBaseData = {
        eventId: eventId ?? event?.id ?? null,
        externalMarketId: market.externalMarketId,
        conditionId: market.conditionId,
        questionId: market.questionId,
        slug: market.slug,
        question: market.question,
        description: market.description,
        rules: market.rules,
        image: market.image,
        icon: market.icon,
        active: market.active,
        closed: market.closed,
        archived: market.archived,
        acceptingOrders: market.acceptingOrders,
        enableOrderBook: market.enableOrderBook,
        negRisk: market.negRisk,
        orderMinSize: market.orderMinSize,
        orderPriceMinTickSize: market.orderPriceMinTickSize,
        bestBid: market.bestBid,
        bestAsk: market.bestAsk,
        lastTradePrice: market.lastTradePrice,
        spread: market.spread,
        volume: market.volume,
        volume24hr: market.volume24hr,
        liquidity: market.liquidity,
        endDate: market.endDate,
        rawPayload: toJson(market.rawPayload),
        syncedAt,
        lastSeenAt: syncedAt,
        staleDetectedAt: null,
        staleReason: null,
      };
      const marketCreateData = {
        ...marketBaseData,
        discoveredAt: market.discoveredAt ?? syncedAt,
      };
      const marketUpdateData = {
        ...marketBaseData,
        ...(market.discoveredAt ? { discoveredAt: market.discoveredAt } : {}),
      };
      const externalMarketId = market.externalMarketId;
      const savedMarket = externalMarketId
        ? await this.upsertMarketWithExternalId(tx, externalMarketId, market, marketUpdateData, marketCreateData)
        : await this.upsertMarketWithoutExternalId(tx, market, marketUpdateData, marketCreateData);

      for (const outcome of market.outcomes) {
        throwIfSyncAborted(abortSignal);
        await tx.polymarketOutcome.upsert({
          where: { clobTokenId: outcome.clobTokenId },
          update: {
            marketId: savedMarket.id,
            outcomeIndex: outcome.outcomeIndex,
            label: outcome.label,
            price: outcome.price,
            rawPayload: toJson(outcome),
            syncedAt,
          },
          create: {
            marketId: savedMarket.id,
            outcomeIndex: outcome.outcomeIndex,
            label: outcome.label,
            clobTokenId: outcome.clobTokenId,
            price: outcome.price,
            rawPayload: toJson(outcome),
            syncedAt,
          },
        });
      }
    });
  }

  private async upsertMarketWithExternalId(
    tx: Prisma.TransactionClient,
    externalMarketId: string,
    market: NormalizedGammaMarket,
    marketUpdateData: Prisma.PolymarketMarketUncheckedUpdateInput,
    marketCreateData: Prisma.PolymarketMarketUncheckedCreateInput,
  ) {
    try {
      return await tx.polymarketMarket.upsert({
        where: { externalMarketId },
        update: marketUpdateData,
        create: marketCreateData,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }
      return this.upsertMarketWithoutExternalId(tx, market, marketUpdateData, marketCreateData);
    }
  }

  private async upsertMarketWithoutExternalId(
    tx: Prisma.TransactionClient,
    market: NormalizedGammaMarket,
    marketUpdateData: Prisma.PolymarketMarketUncheckedUpdateInput,
    marketCreateData: Prisma.PolymarketMarketUncheckedCreateInput,
  ) {
    const existingMarketId = await this.resolveExistingMarketId(tx, market);
    return existingMarketId
      ? tx.polymarketMarket.update({
          where: { id: existingMarketId },
          data: marketUpdateData,
        })
      : tx.polymarketMarket.create({
          data: marketCreateData,
        });
  }

  private async resolveExistingMarketId(
    tx: Prisma.TransactionClient,
    market: NormalizedGammaMarket,
  ): Promise<string | null> {
    const matches: MarketIdentityMatch[] = [];

    if (market.externalMarketId) {
      const row = await tx.polymarketMarket.findUnique({
        where: { externalMarketId: market.externalMarketId },
        select: { id: true },
      });
      if (row) {
        matches.push({ field: 'externalMarketId', value: market.externalMarketId, id: row.id });
      }
    }

    if (market.conditionId) {
      const row = await tx.polymarketMarket.findUnique({
        where: { conditionId: market.conditionId },
        select: { id: true },
      });
      if (row) {
        matches.push({ field: 'conditionId', value: market.conditionId, id: row.id });
      }
    }

    const slugRow = await tx.polymarketMarket.findUnique({
      where: { slug: market.slug },
      select: { id: true },
    });
    if (slugRow) {
      matches.push({ field: 'slug', value: market.slug, id: slugRow.id });
    }

    const matchedIds = [...new Set(matches.map((match) => match.id))];
    if (matchedIds.length > 1) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        'POLYMARKET_IDENTITY_CONFLICT',
        'Polymarket market identifiers match multiple existing markets',
        { matches },
      );
    }

    return matchedIds[0] ?? null;
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

type SkippedGammaPayload = {
  index: number;
  reason: string;
  externalMarketId: string | null;
  slug: string | null;
};

type FullDiscoveryResult = {
  fetchedCount: number;
  upsertedCount: number;
  skippedPayloads: SkippedGammaPayload[];
  metadata: Record<string, unknown>;
};

type HotSyncResult = FullDiscoveryResult;

type HotMarketCandidate = {
  externalMarketId: string;
  slug: string;
  eventId: string | null;
};

type UpsertMarketOptions = {
  abortSignal?: AbortSignal;
  seenAt?: Date;
  eventId?: string | null;
  skipEventUpsert?: boolean;
};

type MarketIdentityMatch = {
  field: string;
  value: string;
  id: string;
};

type DecodedSyncRunCursor = {
  id: string;
  startedAt: Date;
};

type SyncRunCursorRecord = {
  id: string;
  startedAt?: Date;
};

function buildSyncRunWhere(
  query: SyncRunsQueryDto,
  cursor: DecodedSyncRunCursor | null,
): Prisma.SyncRunWhereInput {
  const base: Prisma.SyncRunWhereInput = {
    jobType: query.jobType,
    scope: query.scope,
    status: query.status ? mapSyncRunStatus(query.status) : undefined,
  };
  if (!cursor) return base;

  return {
    AND: [
      base,
      {
        OR: [
          { startedAt: { lt: cursor.startedAt } },
          {
            AND: [
              { startedAt: cursor.startedAt },
              { id: { gt: cursor.id } },
            ],
          },
        ],
      },
    ],
  };
}

function mapSyncRunStatus(status: string): SyncRunStatus {
  if (status === SyncRunStatus.running) return SyncRunStatus.running;
  if (status === SyncRunStatus.completed) return SyncRunStatus.completed;
  if (status === SyncRunStatus.failed) return SyncRunStatus.failed;
  throw invalidPaginationCursor();
}

function encodeSyncRunCursor(record: SyncRunCursorRecord | undefined): string | null {
  if (!record?.startedAt) return null;
  return encodeOpaqueCursor({
    v: 1,
    scope: 'internal_sync_runs',
    id: record.id,
    startedAt: record.startedAt.toISOString(),
  });
}

function decodeSyncRunCursor(cursor: string | undefined): DecodedSyncRunCursor | null {
  if (!cursor) return null;
  const decoded = decodeOpaqueCursor(cursor);
  if (
    !isRecord(decoded)
    || decoded.v !== 1
    || decoded.scope !== 'internal_sync_runs'
    || typeof decoded.id !== 'string'
    || typeof decoded.startedAt !== 'string'
  ) {
    throw invalidPaginationCursor();
  }

  const startedAt = new Date(decoded.startedAt);
  if (Number.isNaN(startedAt.getTime())) {
    throw invalidPaginationCursor();
  }

  return {
    id: decoded.id,
    startedAt,
  };
}

function readStringField(payload: Record<string, unknown>, field: string): string | null {
  const value = payload[field];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function flattenEventMarketPayloads(events: Record<string, unknown>[]): Record<string, unknown>[] {
  return events.flatMap((event) => {
    const markets = event.markets;
    if (!Array.isArray(markets)) return [];
    const eventPayload = stripEventMarkets(event);
    return markets.filter(isRecord).map((market) => ({
      ...market,
      event: eventPayload,
    }));
  });
}

function stripEventMarkets(event: Record<string, unknown>): Record<string, unknown> {
  const { markets: _markets, ...rest } = event;
  return rest;
}

function takeNewMarketPayloads(
  payloads: Record<string, unknown>[],
  seenMarketKeys: Set<string>,
  remaining: number,
): Record<string, unknown>[] {
  const selected: Record<string, unknown>[] = [];
  for (const payload of payloads) {
    if (selected.length >= remaining) break;
    const marketKey = getMarketPayloadKey(payload);
    if (marketKey && seenMarketKeys.has(marketKey)) continue;
    if (marketKey) {
      seenMarketKeys.add(marketKey);
    }
    selected.push(payload);
  }
  return selected;
}

function getMarketPayloadKey(payload: Record<string, unknown>): string | null {
  const externalMarketId = readStringField(payload, 'id') ?? readStringField(payload, 'marketId');
  if (externalMarketId) return `externalMarketId:${externalMarketId}`;
  const conditionId = readStringField(payload, 'conditionId');
  if (conditionId) return `conditionId:${conditionId}`;
  const slug = readStringField(payload, 'slug');
  return slug ? `slug:${slug}` : null;
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }));
}

function throwIfSyncAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) {
    throw signal.reason;
  }
  throw new Error(signal.reason ? String(signal.reason) : 'Polymarket sync aborted');
}
