import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCausewayFixture, fixtureIds } from '../support/causeway-fixtures';
import { createTestPrismaClient, resetTestDatabase } from '../support/prisma-test-client';

describe('Prisma fixture and schema constraints', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetTestDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects to the test database and seeds the minimum Causeway graph', async () => {
    await seedCausewayFixture(prisma);

    await expect(prisma.user.count()).resolves.toBe(2);
    await expect(prisma.polymarketEvent.count()).resolves.toBe(1);
    await expect(prisma.polymarketMarket.count()).resolves.toBe(4);
    await expect(prisma.polymarketOutcome.count()).resolves.toBe(5);
    await expect(prisma.causalScript.count()).resolves.toBe(1);
    await expect(prisma.scriptOutcomeSelection.count()).resolves.toBe(2);
    await expect(prisma.orderIntent.count()).resolves.toBe(1);
    await expect(prisma.causewayOrder.count()).resolves.toBe(1);
  });

  it('enforces wallet nonce, outcome token, and idempotency uniqueness', async () => {
    const fixture = await seedCausewayFixture(prisma);

    await expect(
      prisma.walletSession.create({
        data: {
          id: 'wallet_session_duplicate',
          userId: fixture.user1.id,
          address: fixture.user1.walletAddress,
          chainId: 137,
          nonce: 'fixture_nonce_1',
          nonceExpiresAt: new Date('2026-05-18T00:10:00.000Z'),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await expect(
      prisma.polymarketOutcome.create({
        data: {
          id: 'outcome_duplicate_token',
          marketId: fixtureIds.marketBinary,
          outcomeIndex: 99,
          label: 'Duplicate',
          clobTokenId: 'token_binary_yes',
          syncedAt: new Date('2026-05-18T00:00:00.000Z'),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await expect(
      prisma.orderSubmission.create({
        data: {
          id: 'submission_duplicate',
          userId: fixture.user1.id,
          orderIntentId: fixture.intent.id,
          idempotencyKey: '00000000-0000-4000-8000-000000000001',
          requestHash: 'different-hash',
          status: 'dry_run_completed',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
