import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { seedDemoData } from '../../scripts/dev/seed-demo';

describe('demo seed script', () => {
  it('upserts frontend integration demo data without clearing existing records', async () => {
    const tx = {
      polymarketEvent: {
        upsert: vi.fn(),
      },
      polymarketMarket: {
        upsert: vi.fn(),
      },
      polymarketOutcome: {
        upsert: vi.fn(),
      },
      marketNetworkNode: {
        upsert: vi.fn(),
      },
      marketNetworkEdge: {
        upsert: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaClient;

    const result = await seedDemoData(prisma);

    expect(result).toEqual({
      eventId: 'demo_event_macro_2026',
      activeMarketCount: 4,
      outcomeCount: 11,
      rootMarketSlug: 'demo-fed-rate-cut-2026',
      rootOutcomeId: 'demo_outcome_rate_cut_yes',
      mockModel: 'mock-causeway-v1',
    });
    expect(tx.polymarketEvent.upsert).toHaveBeenCalledTimes(1);
    expect(tx.polymarketMarket.upsert).toHaveBeenCalledTimes(5);
    expect(tx.polymarketOutcome.upsert).toHaveBeenCalledTimes(11);
    expect(tx.marketNetworkNode.upsert).toHaveBeenCalledTimes(4);
    expect(tx.marketNetworkEdge.upsert).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(tx)).not.toContain('deleteMany');
  });
});
