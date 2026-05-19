import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request, { type Response, type Test } from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCausewayFixture } from '../support/causeway-fixtures';
import { createE2eAccessToken } from '../support/e2e-auth';
import { createE2eApp } from '../support/e2e-app';
import { createTestPrismaClient, resetTestDatabase } from '../support/prisma-test-client';

type ApiResponse<T> = {
  data: T;
  requestId: string;
};

type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

type Fixture = Awaited<ReturnType<typeof seedCausewayFixture>>;

const PAGE_KEYS = ['items', 'nextCursor', 'hasMore'] as const;
const MARKET_LIST_ITEM_KEYS = [
  'id',
  'eventId',
  'slug',
  'question',
  'icon',
  'image',
  'active',
  'closed',
  'acceptingOrders',
  'enableOrderBook',
  'bestBid',
  'bestAsk',
  'lastTradePrice',
  'volume',
  'volume24hr',
  'liquidity',
  'endDate',
  'syncedAt',
  'outcomes',
] as const;
const MARKET_OUTCOME_KEYS = ['outcomeId', 'label', 'tokenId', 'price', 'bestBid', 'bestAsk', 'lastTradePrice'] as const;
const EXPLORER_MARKET_NODE_KEYS = [
  'id',
  'slug',
  'title',
  'groupItemTitle',
  'eventId',
  'eventSlug',
  'eventTitle',
  'category',
  'categoryKey',
  'officialCategory',
  'tags',
  'icon',
  'image',
  'price',
  'volume',
  'volume24hr',
  'liquidity',
  'endDate',
  'description',
  'rules',
  'acceptingOrders',
  'outcomes',
  'bestBid',
  'bestAsk',
  'lastTradePrice',
  'orderMinSize',
  'tickSize',
  'syncedAt',
  'x',
  'y',
] as const;

describe('documented public API contracts', () => {
  let app: INestApplication;
  let httpServer: SupertestApp;
  let prisma: PrismaClient;
  let fixture: Fixture;
  let accessToken: string;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await prisma.$connect();
    app = await createE2eApp();
    httpServer = app.getHttpServer() as SupertestApp;
  });

  beforeEach(async () => {
    await resetTestDatabase(prisma);
    fixture = await seedCausewayFixture(prisma);
    accessToken = await createE2eAccessToken(app, prisma, fixture.user1);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('keeps market list, detail, and network response shapes stable', async () => {
    const listData = apiData<Page<Record<string, unknown>>>(
      await request(httpServer).get('/api/v1/markets').query({ active: 'true', limit: 2 }).expect(200),
    );
    expectKeys(listData, PAGE_KEYS);
    expect(listData.items).toHaveLength(2);
    expectKeys(listData.items[0], MARKET_LIST_ITEM_KEYS);
    expectKeys(readRecordArray(listData.items[0], 'outcomes')[0], MARKET_OUTCOME_KEYS);

    const detailData = apiData<Record<string, unknown>>(
      await request(httpServer).get('/api/v1/markets/by-slug/fixture-binary-market').expect(200),
    );
    expectKeys(detailData, [
      ...MARKET_LIST_ITEM_KEYS,
      'externalMarketId',
      'conditionId',
      'questionId',
      'description',
      'rules',
      'archived',
      'negRisk',
      'orderMinSize',
      'orderPriceMinTickSize',
      'spread',
      'event',
      'relatedMarkets',
    ]);
    expectKeys(readRecord(detailData, 'event'), ['id', 'slug', 'title', 'icon', 'image']);
    expect(readRecordArray(detailData, 'outcomes')).toHaveLength(2);

    const networkData = apiData<{ nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] }>(
      await request(httpServer).get('/api/v1/market-network').query({ active: 'true', limit: 10 }).expect(200),
    );
    expectKeys(networkData, ['nodes', 'edges']);
    expect(networkData.nodes.length).toBeGreaterThan(0);
    expectKeys(networkData.nodes[0], ['id', 'marketId', 'title', 'icon', 'price', 'volume', 'category']);
    expectKeys(networkData.edges[0], ['id', 'source', 'target', 'relationType', 'weight']);

    const standardNetworkData = apiData<{ nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] }>(
      await request(httpServer).get('/api/v1/markets/network').query({ active: 'true', limit: 10 }).expect(200),
    );
    expectKeys(standardNetworkData, ['nodes', 'edges']);
    expectKeys(standardNetworkData.nodes[0], ['id', 'marketId', 'title', 'icon', 'price', 'volume', 'category']);
  });

  it('keeps frontend market explorer helper contracts stable', async () => {
    const categoriesData = apiData<{ categories: Record<string, unknown>[]; generatedAt: string; source: string }>(
      await request(httpServer).get('/api/v1/markets/categories').expect(200),
    );
    expectKeys(categoriesData, ['categories', 'generatedAt', 'source']);
    expectKeys(categoriesData.categories[0], ['key', 'label', 'count']);

    const searchData = apiData<{ results: Record<string, unknown>[]; generatedAt: string; source: string }>(
      await request(httpServer).get('/api/v1/markets/search').query({ q: 'fixture', limit: 5 }).expect(200),
    );
    expectKeys(searchData, ['results', 'generatedAt', 'source']);
    expect(searchData.results.length).toBeGreaterThan(0);
    expectKeys(searchData.results[0], [
      'type',
      'id',
      'marketId',
      'eventId',
      'eventSlug',
      'slug',
      'title',
      'subtitle',
      'category',
      'categoryKey',
      'icon',
      'image',
      'price',
      'volume',
      'liquidity',
      'endDate',
      'score',
      'matchedBy',
    ]);

    const eventDetailData = apiData<{
      event: Record<string, unknown> | null;
      selectedMarket: Record<string, unknown> | null;
      markets: Record<string, unknown>[];
      generatedAt: string;
      source: string;
    }>(
      await request(httpServer).get('/api/v1/events/detail').query({ marketId: fixture.marketBinary.id }).expect(200),
    );
    expectKeys(eventDetailData, ['event', 'selectedMarket', 'markets', 'generatedAt', 'source']);
    expectKeys(readRecord(eventDetailData, 'event'), [
      'id',
      'slug',
      'title',
      'category',
      'categoryKey',
      'officialCategory',
      'tags',
      'icon',
      'image',
      'endDate',
      'volume',
      'volume24hr',
      'liquidity',
      'description',
      'rules',
      'marketsCount',
      'syncedAt',
    ]);
    expectKeys(readRecord(eventDetailData, 'selectedMarket'), EXPLORER_MARKET_NODE_KEYS);
    expect(eventDetailData.markets.length).toBeGreaterThan(0);

    const historyData = apiData<{ history: Record<string, unknown[]>; generatedAt: string; source: string }>(
      await request(httpServer).get('/api/v1/markets/history').query({ tokenIds: 'not-a-token' }).expect(200),
    );
    expectKeys(historyData, ['history', 'generatedAt', 'source']);
    expect(historyData.history).toEqual({});
  });

  it('rejects invalid route params and public token queries at the controller boundary', async () => {
    await expectValidationError(request(httpServer).get(`/api/v1/markets/${'m'.repeat(129)}`));
    await expectValidationError(
      request(httpServer).get(`/api/v1/markets/${fixture.marketBinary.id}/orderbook`).query({ tokenId: 't'.repeat(257) }),
    );
    await expectValidationError(request(httpServer).get('/api/v1/markets/%20%20%20'));
    await expectValidationError(
      request(httpServer).get(`/api/v1/markets/${fixture.marketBinary.id}/orderbook`).query({ tokenId: '   ' }),
    );
    await expectValidationError(
      request(httpServer)
        .get(`/api/v1/scripts/${'s'.repeat(129)}`)
        .set('authorization', `Bearer ${accessToken}`),
    );
    await expectValidationError(
      request(httpServer).get('/api/v1/scripts/%20%20%20').set('authorization', `Bearer ${accessToken}`),
    );
    await expectValidationError(
      request(httpServer)
        .get(`/api/v1/orders/intents/${'i'.repeat(129)}`)
        .set('authorization', `Bearer ${accessToken}`),
    );
    await expectValidationError(
      request(httpServer).get('/api/v1/orders/intents/%20%20%20').set('authorization', `Bearer ${accessToken}`),
    );
    await expectValidationError(
      request(httpServer).get('/api/v1/inference-runs/%20%20%20').set('authorization', `Bearer ${accessToken}`),
    );
  });

  it('keeps inference run and generated script contracts stable', async () => {
    const createdRun = apiData<Record<string, unknown>>(
      await request(httpServer)
        .post('/api/v1/inference-runs')
        .set('authorization', `Bearer ${accessToken}`)
        .send({
          rootMarketId: fixture.marketBinary.id,
          rootOutcomeId: fixture.binaryYes.id,
          depth: 1,
          maxMarketsPerLayer: 2,
          confidenceThreshold: 0.5,
          model: 'mock-causeway-v1',
          cacheEnabled: true,
        })
        .expect(201),
    );
    expectKeys(createdRun, ['runId', 'status', 'cacheKey', 'cacheHit', 'scriptId']);
    expect(createdRun.status).toBe('queued');
    expect(createdRun.scriptId).toBeNull();

    const runId = readString(createdRun, 'runId');
    const runData = await waitForInferenceRun(httpServer, accessToken, runId);
    expectKeys(runData, ['id', 'status', 'stage', 'progress', 'cacheHit', 'scriptId', 'errorMessage', 'createdAt', 'completedAt']);
    const scriptId = readString(runData, 'scriptId');

    const scriptData = apiData<Record<string, unknown>>(
      await request(httpServer).get(`/api/v1/scripts/${scriptId}`).set('authorization', `Bearer ${accessToken}`).expect(200),
    );
    expectKeys(scriptData, ['id', 'title', 'status', 'root', 'graph', 'summary', 'createdAt', 'updatedAt', 'markets']);
    expectKeys(readRecord(scriptData, 'root'), ['marketId', 'outcomeId', 'outcomeLabel']);
    expectKeys(readRecord(scriptData, 'graph'), ['nodes', 'edges']);
    expectKeys(readRecordArray(readRecord(scriptData, 'graph'), 'nodes')[0], [
      'nodeId',
      'marketId',
      'title',
      'layer',
      'recommendedOutcomes',
      'confidence',
      'direction',
      'price',
    ]);
    expectKeys(readRecordArray(scriptData, 'markets')[0], ['scriptMarketId', 'marketId', 'title', 'layer', 'confidence', 'outcomes']);
    expectKeys(readRecordArray(readRecordArray(scriptData, 'markets')[0], 'outcomes')[0], [
      'selectionId',
      'outcomeId',
      'label',
      'tokenId',
      'aiAction',
      'userAction',
      'side',
      'orderMode',
      'limitPrice',
      'size',
      'amountUsd',
      'confidence',
      'reason',
    ]);
  });

  it('keeps dry-run order and portfolio read contracts stable', async () => {
    const previewData = apiData<Record<string, unknown>>(
      await request(httpServer)
        .post('/api/v1/orders/preview')
        .set('authorization', `Bearer ${accessToken}`)
        .send({
          scriptId: fixture.script.id,
          executionMode: 'dry_run',
          selections: [
            {
              selectionId: fixture.selectionYes.id,
              orderMode: 'limit',
              amountUsd: 15,
              limitPrice: 0.56,
              orderType: 'GTC',
            },
          ],
        })
        .expect(201),
    );
    expectKeys(previewData, [
      'intentId',
      'executionMode',
      'tradingCapability',
      'balanceCapability',
      'tradingCapabilityReason',
      'balanceCapabilityReason',
      'cashAvailable',
      'totalAmountUsd',
      'estimatedMaxPayout',
      'estimatedMaxLoss',
      'requiresSignature',
      'submitMode',
      'refreshedAt',
      'expiresAt',
      'orders',
    ]);
    expectKeys(readRecordArray(previewData, 'orders')[0], [
      'selectionId',
      'marketId',
      'outcomeId',
      'tokenId',
      'outcomeLabel',
      'side',
      'orderMode',
      'orderType',
      'limitPrice',
      'estimatedFillPrice',
      'amountUsd',
      'size',
      'tickSize',
      'minOrderSize',
      'orderBookRefreshedAt',
      'valid',
      'warnings',
      'error',
    ]);

    const intentId = readString(previewData, 'intentId');
    const signatureData = apiData<Record<string, unknown>>(
      await request(httpServer)
        .post('/api/v1/orders/prepare-signature')
        .set('authorization', `Bearer ${accessToken}`)
        .send({
          intentId,
          executionMode: 'dry_run',
          walletAddress: fixture.user1.walletAddress,
          chainId: 137,
        })
        .expect(201),
    );
    expectKeys(signatureData, ['intentId', 'executionMode', 'signingStatus', 'protocol', 'expiresAt', 'payloads', 'error']);

    const submitData = apiData<Record<string, unknown>>(
      await request(httpServer)
        .post('/api/v1/orders/submit')
        .set('authorization', `Bearer ${accessToken}`)
        .send({
          intentId,
          executionMode: 'dry_run',
          idempotencyKey: '00000000-0000-4000-8000-000000000401',
          signedOrders: [],
        })
        .expect(201),
    );
    expectKeys(submitData, ['intentId', 'executionMode', 'status', 'orders']);
    expectKeys(readRecordArray(submitData, 'orders')[0], ['orderId', 'externalOrderId', 'status', 'errorMessage']);

    const summaryData = apiData<Record<string, unknown>>(
      await request(httpServer).get('/api/v1/portfolio/summary').set('authorization', `Bearer ${accessToken}`).expect(200),
    );
    expectKeys(summaryData, [
      'capability',
      'dataSource',
      'cashAvailable',
      'portfolioValue',
      'openPositionsValue',
      'openOrdersValue',
      'pnl',
      'refreshedAt',
      'error',
    ]);

    const positionsData = apiData<Record<string, unknown>>(
      await request(httpServer).get('/api/v1/portfolio/positions').set('authorization', `Bearer ${accessToken}`).expect(200),
    );
    expectKeys(positionsData, ['capability', 'dataSource', 'items', 'refreshedAt', 'error']);

    await expectApiError(
      request(httpServer).post('/api/v1/portfolio/positions/sync').set('authorization', `Bearer ${accessToken}`),
      503,
      'CAPABILITY_UNAVAILABLE',
    );

    const ordersData = apiData<Page<Record<string, unknown>> & Record<string, unknown>>(
      await request(httpServer).get('/api/v1/portfolio/orders').set('authorization', `Bearer ${accessToken}`).expect(200),
    );
    expectKeys(ordersData, ['capability', 'dataSource', 'items', 'nextCursor', 'hasMore', 'refreshedAt', 'error']);
    expectKeys(ordersData.items[0], ['intentId', 'status', 'executionMode', 'totalAmountUsd', 'createdAt', 'updatedAt', 'orders']);

    const tradesData = apiData<Page<Record<string, unknown>> & Record<string, unknown>>(
      await request(httpServer).get('/api/v1/portfolio/trades').set('authorization', `Bearer ${accessToken}`).expect(200),
    );
    expectKeys(tradesData, ['capability', 'dataSource', 'items', 'nextCursor', 'hasMore', 'refreshedAt', 'error']);
    expectKeys(readRecordArray(tradesData, 'items')[0], [
      'tradeId',
      'orderId',
      'intentId',
      'executionMode',
      'intentStatus',
      'marketId',
      'outcomeId',
      'tokenId',
      'side',
      'orderMode',
      'orderType',
      'price',
      'size',
      'amountUsd',
      'externalOrderId',
      'status',
      'market',
      'outcome',
      'tradedAt',
    ]);
  });

  it('keeps internal sync run read model contract stable without leaking metadata', async () => {
    await prisma.syncRun.createMany({
      data: [
        {
          id: 'sync_run_contract_1',
          jobType: 'polymarket_sync',
          scope: 'markets',
          status: 'completed',
          fetchedCount: 10,
          upsertedCount: 9,
          startedAt: new Date('2026-05-18T00:00:00.000Z'),
          finishedAt: new Date('2026-05-18T00:01:00.000Z'),
          metadata: { hidden: 'metadata must not be returned' },
        },
        {
          id: 'sync_run_contract_2',
          jobType: 'polymarket_sync',
          scope: 'markets',
          status: 'failed',
          fetchedCount: 3,
          upsertedCount: 1,
          error: 'fixture failure',
          startedAt: new Date('2026-05-18T00:02:00.000Z'),
          finishedAt: new Date('2026-05-18T00:03:00.000Z'),
          metadata: { hidden: 'metadata must not be returned' },
        },
      ],
    });

    const firstPage = apiData<Page<Record<string, unknown>>>(
      await request(httpServer)
        .get('/api/v1/internal/sync/runs')
        .set('x-internal-api-token', process.env.INTERNAL_API_TOKEN ?? 'test-internal-token')
        .query({ jobType: 'polymarket_sync', scope: 'markets', limit: 1 })
        .expect(200),
    );
    expectKeys(firstPage, PAGE_KEYS);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.nextCursor).toBeTruthy();
    expectKeys(firstPage.items[0], [
      'id',
      'jobType',
      'scope',
      'status',
      'fetchedCount',
      'upsertedCount',
      'error',
      'startedAt',
      'finishedAt',
    ]);
    expect(firstPage.items[0]).not.toHaveProperty('metadata');

    const secondPage = apiData<Page<Record<string, unknown>>>(
      await request(httpServer)
        .get('/api/v1/internal/sync/runs')
        .set('x-internal-api-token', process.env.INTERNAL_API_TOKEN ?? 'test-internal-token')
        .query({ jobType: 'polymarket_sync', scope: 'markets', limit: 1, cursor: firstPage.nextCursor })
        .expect(200),
    );
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);
  });

  it('keeps internal monitor refresh contracts stable', async () => {
    const internalToken = process.env.INTERNAL_API_TOKEN ?? 'test-internal-token';
    const orderRefresh = apiData<Record<string, unknown>>(
      await request(httpServer)
        .post('/api/v1/internal/monitor/order-statuses/refresh')
        .set('x-internal-api-token', internalToken)
        .expect(201),
    );
    expectKeys(orderRefresh, [
      'runId',
      'jobType',
      'status',
      'capability',
      'source',
      'reason',
      'inspectedOrderCount',
      'batchCount',
      'statusCounts',
      'intentStatusCounts',
      'refreshableExternalOrderCount',
      'missingExternalOrderIdCount',
    ]);
    expect(orderRefresh.jobType).toBe('order_status_refresh');
    expect(orderRefresh.capability).toBe('degraded');
    expect(orderRefresh.source).toBe('local_order_state');

    const scriptRefresh = apiData<Record<string, unknown>>(
      await request(httpServer)
        .post('/api/v1/internal/monitor/script-markets/refresh')
        .set('x-internal-api-token', internalToken)
        .expect(201),
    );
    expectKeys(scriptRefresh, [
      'runId',
      'jobType',
      'status',
      'capability',
      'source',
      'reason',
      'refreshedScriptMarketCount',
      'snapshotCount',
      'batchCount',
    ]);
    expect(scriptRefresh.jobType).toBe('script_market_refresh');
    expect(scriptRefresh.capability).toBe('degraded');
    expect(scriptRefresh.source).toBe('local_polymarket_cache');
    expect(Number(scriptRefresh.snapshotCount)).toBeGreaterThan(0);
  });
});

function apiData<T>(response: Response): T {
  const body = response.body as ApiResponse<T>;
  expect(body.requestId).toBeTruthy();
  return body.data;
}

function expectKeys(value: Record<string, unknown> | undefined, keys: readonly string[]): void {
  expect(value).toBeTruthy();
  expect(Object.keys(value ?? {}).sort()).toEqual([...keys].sort());
}

function readRecord(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const child = value[key];
  if (!child || typeof child !== 'object' || Array.isArray(child)) {
    throw new Error(`${key} must be an object`);
  }
  return child as Record<string, unknown>;
}

function readRecordArray(value: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const child = value[key];
  if (!Array.isArray(child)) {
    throw new Error(`${key} must be an array`);
  }
  return child.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${key} must contain objects`);
    }
    return item as Record<string, unknown>;
  });
}

function readString(value: Record<string, unknown>, key: string): string {
  const child = value[key];
  if (typeof child !== 'string' || !child) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return child;
}

async function waitForInferenceRun(
  httpServer: SupertestApp,
  accessToken: string,
  runId: string,
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const runData = apiData<Record<string, unknown>>(
      await request(httpServer).get(`/api/v1/inference-runs/${runId}`).set('authorization', `Bearer ${accessToken}`).expect(200),
    );
    if (runData.status === 'completed') return runData;
    if (runData.status === 'failed') {
      throw new Error(`Inference run failed: ${String(runData.errorMessage)}`);
    }
    await sleep(200);
  }

  throw new Error(`Inference run ${runId} did not complete in time`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function expectValidationError(testRequest: Test): Promise<void> {
  await expectApiError(testRequest, 400, 'REQUEST_VALIDATION_FAILED');
}

async function expectApiError(testRequest: Test, statusCode: number, code: string): Promise<void> {
  const response = await testRequest.expect(statusCode);
  expect((response.body as { error?: { code?: string } }).error?.code).toBe(code);
}
