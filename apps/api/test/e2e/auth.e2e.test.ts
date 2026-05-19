import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App as SupertestApp } from 'supertest/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
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

type NonceResponse = {
  nonce: string;
  expiresAt: string;
};

type VerifyResponse = {
  accessToken: string;
  user: {
    id: string;
    walletAddress: string;
  };
};

const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');

describe('auth e2e', () => {
  let app: INestApplication;
  let httpServer: SupertestApp;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await prisma.$connect();
    app = await createE2eApp();
    httpServer = app.getHttpServer() as SupertestApp;
  });

  beforeEach(async () => {
    await resetTestDatabase(prisma);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('creates a nonce, verifies a wallet signature, records session audit events, and authorizes a protected route', async () => {
    const nonceResponse = await request(httpServer)
      .post('/api/v1/auth/nonce')
      .send({ address: account.address, chainId: 137 })
      .expect(201);
    const nonceBody = nonceResponse.body as ApiResponse<NonceResponse>;
    expect(nonceBody.data.nonce).toContain('Sign in to Causeway');
    expect(nonceBody.requestId).toBeTruthy();

    const signature = await account.signMessage({ message: nonceBody.data.nonce });
    const verifyResponse = await request(httpServer)
      .post('/api/v1/auth/verify')
      .send({
        address: account.address,
        chainId: 137,
        message: nonceBody.data.nonce,
        signature,
      })
      .expect(201);
    const verifyBody = verifyResponse.body as ApiResponse<VerifyResponse>;
    expect(verifyBody.data.accessToken).toBeTruthy();
    expect(verifyBody.data.user.walletAddress).toBe(account.address);

    await request(httpServer)
      .get('/api/v1/portfolio/summary')
      .set('authorization', `Bearer ${verifyBody.data.accessToken}`)
      .expect(200);

    const session = await prisma.walletSession.findFirstOrThrow({
      where: { address: account.address },
    });
    expect(session.verifiedAt).not.toBeNull();
    expect(session.sessionTokenHash).toBeTruthy();
    expect(session.sessionExpiresAt).not.toBeNull();

    const auditEvents = await prisma.auditEvent.findMany({
      where: { entityType: 'wallet_session', entityId: session.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(auditEvents.map((event) => event.action)).toEqual(['auth.nonce_created', 'auth.verified']);
  });

  it('rejects nonce reuse', async () => {
    const nonceResponse = await request(httpServer)
      .post('/api/v1/auth/nonce')
      .send({ address: account.address, chainId: 137 })
      .expect(201);
    const nonceBody = nonceResponse.body as ApiResponse<NonceResponse>;
    const signature = await account.signMessage({ message: nonceBody.data.nonce });

    await request(httpServer)
      .post('/api/v1/auth/verify')
      .send({ address: account.address, chainId: 137, message: nonceBody.data.nonce, signature })
      .expect(201);

    const reuseResponse = await request(httpServer)
      .post('/api/v1/auth/verify')
      .send({ address: account.address, chainId: 137, message: nonceBody.data.nonce, signature })
      .expect(401);
    const reuseBody = reuseResponse.body as ApiErrorResponse;
    expect(reuseBody.error.code).toBe('INVALID_SIGNATURE');
  });

  it('rejects protected and internal routes without valid credentials', async () => {
    const protectedResponse = await request(httpServer).get('/api/v1/portfolio/summary').expect(401);
    const protectedBody = protectedResponse.body as ApiErrorResponse;
    expect(protectedBody.error.code).toBe('AUTH_REQUIRED');

    const internalResponse = await request(httpServer).get('/api/v1/internal/sync/runs').expect(401);
    const internalBody = internalResponse.body as ApiErrorResponse;
    expect(internalBody.error.code).toBe('AUTH_REQUIRED');

    await request(httpServer)
      .get('/api/v1/internal/sync/runs')
      .set('x-internal-api-token', 'wrong-token')
      .expect(401);

    await request(httpServer)
      .get('/api/v1/internal/sync/runs')
      .set('x-internal-api-token', process.env.INTERNAL_API_TOKEN ?? 'test-internal-token')
      .expect(200);
  });

  it('rejects unsupported chains', async () => {
    const response = await request(httpServer)
      .post('/api/v1/auth/nonce')
      .send({ address: account.address, chainId: 1 })
      .expect(422);
    const body = response.body as ApiErrorResponse;
    expect(body.error.code).toBe('UNSUPPORTED_CHAIN');
  });
});
