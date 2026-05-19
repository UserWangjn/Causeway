import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
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

type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
};

type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

type MarketListItem = {
  id: string;
  slug: string;
  question: string;
  outcomes: Array<{
    outcomeId: string;
    tokenId: string;
    label: string;
  }>;
};

type InferenceRunCreateResponse = {
  runId: string;
  status: string;
  cacheKey: string;
  cacheHit: boolean;
  scriptId: string | null;
};

type InferenceRunReadResponse = {
  id: string;
  status: string;
  scriptId: string | null;
  errorMessage: string | null;
};

type CausalScriptResponse = {
  id: string;
  root: {
    marketId: string;
    outcomeId: string;
    outcomeLabel: string;
  };
  graph: {
    nodes: Array<{
      nodeId: string;
      marketId: string;
      title: string;
      recommendedOutcomes: Array<{
        outcomeId: string;
        tokenId: string;
      }>;
    }>;
    edges: unknown[];
  };
  markets: Array<{
    scriptMarketId: string;
    marketId: string;
    title: string;
    outcomes: Array<{
      selectionId: string;
      outcomeId: string;
      tokenId: string;
      userAction: string;
      orderMode: string;
      amountUsd: number | null;
    }>;
  }>;
};

type OrderPreviewResponse = {
  intentId: string;
  executionMode: string;
  submitMode: string;
  totalAmountUsd: number;
  requiresSignature: boolean;
  orders: Array<{
    selectionId: string;
    valid: boolean;
    amountUsd: number;
    limitPrice: number | null;
  }>;
};

type OrderSubmitResponse = {
  intentId: string;
  executionMode: string;
  status: string;
  orders: Array<{
    orderId: string;
    status: string;
  }>;
};

type PrepareSignatureResponse = {
  intentId: string;
  executionMode: string;
  signingStatus: string;
  protocol: string;
  expiresAt: string | null;
  payloads: unknown[];
  error: string | null;
};

type PortfolioTradesResponse = {
  capability: string;
  dataSource: string;
  items: Array<{
    orderId: string;
    intentId: string;
    executionMode: string;
    status: string;
    amountUsd: number | null;
  }>;
  nextCursor: string | null;
  hasMore: boolean;
};

describe('core backend workflows e2e', () => {
  let app: INestApplication;
  let httpServer: SupertestApp;
  let prisma: PrismaClient;
  let fixture: Awaited<ReturnType<typeof seedCausewayFixture>>;
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

  it('serves public market list and market detail from local Polymarket data', async () => {
    const listResponse = await request(httpServer).get('/api/v1/markets').query({ active: 'true', limit: 2 }).expect(200);
    const listBody = listResponse.body as ApiResponse<Page<MarketListItem>>;

    expect(listBody.requestId).toBeTruthy();
    expect(listBody.data.items).toHaveLength(2);
    expect(listBody.data.hasMore).toBe(true);
    expect(listBody.data.items[0]?.outcomes.length).toBeGreaterThan(0);

    const detailResponse = await request(httpServer)
      .get('/api/v1/markets/by-slug/fixture-binary-market')
      .expect(200);
    const detailBody = detailResponse.body as ApiResponse<MarketListItem>;

    expect(detailBody.data).toMatchObject({
      id: fixture.marketBinary.id,
      slug: 'fixture-binary-market',
      question: 'Will the fixture binary market resolve Yes?',
    });
    expect(detailBody.data.outcomes.map((outcome) => outcome.tokenId)).toEqual(['token_binary_yes', 'token_binary_no']);
  });

  it('runs mock inference and exposes the generated script contract', async () => {
    const createResponse = await request(httpServer)
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
      .expect(201);
    const createBody = createResponse.body as ApiResponse<InferenceRunCreateResponse>;

    expect(createBody.data.status).toBe('queued');
    expect(createBody.data.cacheHit).toBe(false);
    expect(createBody.data.scriptId).toBeNull();

    const runData = await waitForInferenceRun(httpServer, accessToken, createBody.data.runId);
    expect(runData).toMatchObject({
      status: 'completed',
    });
    if (!runData.scriptId) {
      throw new Error('Completed inference run did not create a script');
    }

    const scriptResponse = await request(httpServer)
      .get(`/api/v1/scripts/${runData.scriptId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    const scriptBody = scriptResponse.body as ApiResponse<CausalScriptResponse>;

    expect(scriptBody.data.root).toMatchObject({
      marketId: fixture.marketBinary.id,
      outcomeId: fixture.binaryYes.id,
      outcomeLabel: 'Yes',
    });
    expect(scriptBody.data.graph.nodes[0]).toMatchObject({
      nodeId: 'root',
      title: 'Will the fixture binary market resolve Yes?',
    });
    expect(scriptBody.data.markets[0]?.scriptMarketId).toBeTruthy();
    expect(scriptBody.data.markets[0]?.outcomes[0]?.selectionId).toBeTruthy();
  });

  it('updates script selections and completes a dry-run order lifecycle idempotently', async () => {
    const patchResponse = await request(httpServer)
      .patch(`/api/v1/scripts/${fixture.script.id}/outcome-selections/${fixture.selectionYes.id}`)
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        userAction: 'buy',
        orderMode: 'limit',
        limitPrice: 0.56,
        amountUsd: 15,
        reason: 'e2e dry-run order',
      })
      .expect(200);

    expect((patchResponse.body as ApiResponse<{ selectionId: string; limitPrice: number; amountUsd: number }>).data).toMatchObject({
      selectionId: fixture.selectionYes.id,
      limitPrice: 0.56,
      amountUsd: 15,
    });

    const previewResponse = await request(httpServer)
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
      .expect(201);
    const previewBody = previewResponse.body as ApiResponse<OrderPreviewResponse>;

    expect(previewBody.data).toMatchObject({
      executionMode: 'dry_run',
      submitMode: 'dry_run_no_signature',
      totalAmountUsd: 15,
      requiresSignature: false,
    });
    expect(previewBody.data.orders[0]).toMatchObject({
      selectionId: fixture.selectionYes.id,
      valid: true,
      amountUsd: 15,
      limitPrice: 0.56,
    });

    const prepareSignatureResponse = await request(httpServer)
      .post('/api/v1/orders/prepare-signature')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        intentId: previewBody.data.intentId,
        executionMode: 'dry_run',
        walletAddress: fixture.user1.walletAddress,
        chainId: 137,
      })
      .expect(201);
    const prepareSignatureBody = prepareSignatureResponse.body as ApiResponse<PrepareSignatureResponse>;

    expect(prepareSignatureBody.data).toEqual({
      intentId: previewBody.data.intentId,
      executionMode: 'dry_run',
      signingStatus: 'not_required',
      protocol: 'dry_run_no_signature',
      expiresAt: null,
      payloads: [],
      error: null,
    });

    const submitPayload = {
      intentId: previewBody.data.intentId,
      executionMode: 'dry_run',
      idempotencyKey: '00000000-0000-4000-8000-000000000101',
      signedOrders: [],
    };
    const submitResponse = await request(httpServer)
      .post('/api/v1/orders/submit')
      .set('authorization', `Bearer ${accessToken}`)
      .send(submitPayload)
      .expect(201);
    const submitBody = submitResponse.body as ApiResponse<OrderSubmitResponse>;

    expect(submitBody.data).toMatchObject({
      intentId: previewBody.data.intentId,
      executionMode: 'dry_run',
      status: 'dry_run_completed',
    });
    expect(submitBody.data.orders[0]?.status).toBe('dry_run_completed');

    const repeatSubmitResponse = await request(httpServer)
      .post('/api/v1/orders/submit')
      .set('authorization', `Bearer ${accessToken}`)
      .send(submitPayload)
      .expect(201);

    expect((repeatSubmitResponse.body as ApiResponse<OrderSubmitResponse>).data).toEqual(submitBody.data);

    const intentResponse = await request(httpServer)
      .get(`/api/v1/orders/intents/${previewBody.data.intentId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect((intentResponse.body as ApiResponse<{ status: string }>).data.status).toBe('dry_run_completed');

    const tradesResponse = await request(httpServer)
      .get('/api/v1/portfolio/trades')
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    const tradesBody = tradesResponse.body as ApiResponse<PortfolioTradesResponse>;

    expect(tradesBody.data).toMatchObject({
      capability: 'degraded',
      dataSource: 'local',
      nextCursor: null,
      hasMore: false,
    });
    expect(tradesBody.data.items).toEqual([
      expect.objectContaining({
        intentId: previewBody.data.intentId,
        executionMode: 'dry_run',
        status: 'dry_run_completed',
        amountUsd: 15,
      }),
    ]);
  });

  it('returns a structured unavailable signing state for real orders while CLOB is not wired', async () => {
    const previewResponse = await request(httpServer)
      .post('/api/v1/orders/preview')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        scriptId: fixture.script.id,
        executionMode: 'real',
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
      .expect(201);
    const previewBody = previewResponse.body as ApiResponse<OrderPreviewResponse>;

    expect(previewBody.data).toMatchObject({
      executionMode: 'real',
      submitMode: 'unavailable',
      requiresSignature: false,
    });

    const prepareSignatureResponse = await request(httpServer)
      .post('/api/v1/orders/prepare-signature')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        intentId: previewBody.data.intentId,
        executionMode: 'real',
        walletAddress: fixture.user1.walletAddress,
        chainId: 137,
      })
      .expect(201);
    const prepareSignatureBody = prepareSignatureResponse.body as ApiResponse<PrepareSignatureResponse>;

    expect(prepareSignatureBody.data).toMatchObject({
      intentId: previewBody.data.intentId,
      executionMode: 'real',
      signingStatus: 'unavailable',
      protocol: 'polymarket_clob_eip712_v2',
      payloads: [],
    });
    expect(prepareSignatureBody.data.expiresAt).toEqual(expect.any(String));
    expect(prepareSignatureBody.data.error).toContain('CLOB real trading is disabled');
  });

  it('rejects idempotency key reuse with a different submit payload', async () => {
    const previewResponse = await request(httpServer)
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
      .expect(201);
    const previewBody = previewResponse.body as ApiResponse<OrderPreviewResponse>;
    const idempotencyKey = '00000000-0000-4000-8000-000000000202';

    await request(httpServer)
      .post('/api/v1/orders/submit')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        intentId: previewBody.data.intentId,
        executionMode: 'dry_run',
        idempotencyKey,
        signedOrders: [],
      })
      .expect(201);

    const conflictResponse = await request(httpServer)
      .post('/api/v1/orders/submit')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        intentId: previewBody.data.intentId,
        executionMode: 'dry_run',
        idempotencyKey,
        signedOrders: [{ orderId: 'different-payload' }],
      })
      .expect(409);
    const conflictBody = conflictResponse.body as ApiErrorResponse;

    expect(conflictBody.error).toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      message: 'Idempotency key was already used with a different request body',
    });
    expect(conflictBody.requestId).toBeTruthy();
  });

  it('rejects submit after the order preview expires without creating a submission', async () => {
    const previewResponse = await request(httpServer)
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
      .expect(201);
    const previewBody = previewResponse.body as ApiResponse<OrderPreviewResponse>;

    await prisma.orderIntent.update({
      where: { id: previewBody.data.intentId },
      data: { previewExpiresAt: new Date(Date.now() - 1_000) },
    });

    const expiredResponse = await request(httpServer)
      .post('/api/v1/orders/submit')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        intentId: previewBody.data.intentId,
        executionMode: 'dry_run',
        idempotencyKey: '00000000-0000-4000-8000-000000000303',
        signedOrders: [],
      })
      .expect(409);
    const expiredBody = expiredResponse.body as ApiErrorResponse;

    expect(expiredBody.error).toMatchObject({
      code: 'ORDER_PREVIEW_EXPIRED',
      message: 'Order preview has expired',
    });
    await expect(
      prisma.orderSubmission.count({
        where: { orderIntentId: previewBody.data.intentId },
      }),
    ).resolves.toBe(0);
  });
});

async function waitForInferenceRun(
  httpServer: SupertestApp,
  accessToken: string,
  runId: string,
): Promise<InferenceRunReadResponse> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await request(httpServer)
      .get(`/api/v1/inference-runs/${runId}`)
      .set('authorization', `Bearer ${accessToken}`)
      .expect(200);
    const runData = (response.body as ApiResponse<InferenceRunReadResponse>).data;
    if (runData.status === 'completed') return runData;
    if (runData.status === 'failed') {
      throw new Error(`Inference run failed: ${runData.errorMessage ?? 'unknown error'}`);
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
