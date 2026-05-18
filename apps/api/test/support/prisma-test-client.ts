import { PrismaClient } from '@prisma/client';

export function getTestDatabaseUrl(): string {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('NODE_ENV=test is required for integration tests');
  }

  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL is required for integration tests');
  }

  const databaseName = parseDatabaseName(databaseUrl);
  if (!/^causeway[_-]test$/i.test(databaseName)) {
    throw new Error('TEST_DATABASE_URL database name must be exactly causeway_test or causeway-test');
  }

  return databaseUrl;
}

export function createTestPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: getTestDatabaseUrl(),
      },
    },
  });
}

export async function resetTestDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.auditEvent.deleteMany(),
    prisma.orderSubmission.deleteMany(),
    prisma.causewayOrder.deleteMany(),
    prisma.orderIntent.deleteMany(),
    prisma.externalPosition.deleteMany(),
    prisma.portfolioSnapshot.deleteMany(),
    prisma.scriptOutcomeSelection.deleteMany(),
    prisma.scriptMarket.deleteMany(),
    prisma.causalScript.deleteMany(),
    prisma.inferenceRun.deleteMany(),
    prisma.inferenceCacheEntry.deleteMany(),
    prisma.marketNetworkEdge.deleteMany(),
    prisma.marketNetworkNode.deleteMany(),
    prisma.marketSnapshot.deleteMany(),
    prisma.polymarketOutcome.deleteMany(),
    prisma.polymarketMarket.deleteMany(),
    prisma.polymarketEvent.deleteMany(),
    prisma.walletSession.deleteMany(),
    prisma.user.deleteMany(),
    prisma.schedulerLock.deleteMany(),
    prisma.syncRun.deleteMany(),
  ]);
}

function parseDatabaseName(databaseUrl: string): string {
  try {
    const parsed = new URL(databaseUrl);
    return decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL');
  }
}
