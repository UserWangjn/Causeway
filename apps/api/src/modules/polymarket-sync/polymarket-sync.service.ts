import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, SyncRunStatus } from '@prisma/client';
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
  type NormalizedGammaMarket,
} from '../../integrations/polymarket/gamma-normalizer';
import { GammaClient } from '../../integrations/polymarket/services/gamma.client';
import { SyncPolymarketDto } from './dto/sync-polymarket.dto';
import { SyncRunsQueryDto } from './dto/sync-runs-query.dto';

@Injectable()
export class PolymarketSyncService {
  private readonly pageSize = 100;

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
      const payloads = await this.fetchMarkets(dto.limit ?? 100, mode, options.abortSignal);
      fetchedCount = payloads.length;
      throwIfSyncAborted(options.abortSignal);
      const normalizedResult = this.normalizePayloads(payloads);
      skippedPayloads = normalizedResult.skippedPayloads;

      for (const market of normalizedResult.normalizedMarkets) {
        throwIfSyncAborted(options.abortSignal);
        await this.upsertMarket(market, options.abortSignal);
        upsertedCount += 1;
      }
      throwIfSyncAborted(options.abortSignal);

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
            pageSize: this.pageSize,
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
            pageSize: this.pageSize,
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

  private async upsertMarket(market: NormalizedGammaMarket, abortSignal?: AbortSignal): Promise<void> {
    throwIfSyncAborted(abortSignal);
    await this.prisma.$transaction(async (tx) => {
      throwIfSyncAborted(abortSignal);
      const syncedAt = new Date();
      const event = market.event
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
            },
          })
        : null;
      throwIfSyncAborted(abortSignal);

      const marketData = {
        eventId: event?.id ?? null,
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
      };
      const existingMarketId = await this.resolveExistingMarketId(tx, market);
      const savedMarket = existingMarketId
        ? await tx.polymarketMarket.update({
            where: { id: existingMarketId },
            data: marketData,
          })
        : await tx.polymarketMarket.create({
            data: marketData,
          });

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

type SkippedGammaPayload = {
  index: number;
  reason: string;
  externalMarketId: string | null;
  slug: string | null;
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

function throwIfSyncAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) {
    throw signal.reason;
  }
  throw new Error(signal.reason ? String(signal.reason) : 'Polymarket sync aborted');
}
