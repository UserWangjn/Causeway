import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../../src/common/decorators/current-user.decorator';
import type { PrismaService } from '../../src/database/prisma.service';
import type { AiClientService } from '../../src/integrations/ai/services/ai-client.service';
import { buildMockInferenceOutput, MOCK_INFERENCE_MODEL } from '../../src/modules/inference/inference-engine';
import { InferenceService } from '../../src/modules/inference/inference.service';
import type { InferencePromptInput } from '../../src/modules/inference/inference.types';

describe('InferenceService', () => {
  it('rejects non-mock models when the AI provider is unavailable', async () => {
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'unavailable',
        reason: 'AI inference client is not configured',
      }),
      runStructuredInference: vi.fn(),
    };
    const polymarketMarketFindUnique = vi.fn();
    const inferenceRunCreate = vi.fn();
    const service = createService({
      polymarketMarket: {
        findUnique: polymarketMarketFindUnique,
        findMany: vi.fn().mockResolvedValue([]),
      },
      inferenceRun: {
        create: inferenceRunCreate,
      },
    }, aiClient);

    await expect(service.createRun(currentUser(), createRunDto('real-model'))).rejects.toThrow(
      'AI inference client is not configured',
    );
    expect(polymarketMarketFindUnique).not.toHaveBeenCalled();
    expect(inferenceRunCreate).not.toHaveBeenCalled();
    expect(aiClient.runStructuredInference).not.toHaveBeenCalled();
  });

  it('uses the configured AI provider for non-mock models', async () => {
    const scriptMarketCreate = vi.fn().mockResolvedValueOnce({ id: 'script_market_root' }).mockResolvedValueOnce({
      id: 'script_market_candidate',
    });
    const tx = {
      causalScript: {
        create: vi.fn().mockResolvedValue({ id: 'script_1' }),
      },
      scriptMarket: {
        create: scriptMarketCreate,
        update: vi.fn(),
      },
      scriptOutcomeSelection: {
        create: vi.fn(),
      },
      polymarketOutcome: {
        findUnique: vi.fn().mockResolvedValue({
          bestAsk: '0.5',
          price: '0.45',
          lastTradePrice: null,
        }),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'gpt-test',
      }),
      runStructuredInference: vi.fn((input: InferencePromptInput) => Promise.resolve(buildMockInferenceOutput(input))),
    };
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(rootMarket()),
        findMany: vi.fn().mockResolvedValue([candidateMarket()]),
      },
      inferenceRun: {
        create: vi.fn().mockResolvedValue({ id: 'run_1' }),
        update: vi.fn(),
      },
      inferenceCacheEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    }, aiClient);

    const result = await service.createRun(currentUser(), createRunDto('gpt-test'));

    expect(result).toMatchObject({
      runId: 'run_1',
      status: 'completed',
      scriptId: 'script_1',
    });
    expect(aiClient.runStructuredInference).toHaveBeenCalledWith(expect.any(Object), { model: 'gpt-test' });
  });

  it('rejects non-mock models that do not match the configured provider model', async () => {
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'gpt-configured',
      }),
      runStructuredInference: vi.fn(),
    };
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn(),
      },
    }, aiClient);

    await expect(service.createRun(currentUser(), createRunDto('gpt-other'))).rejects.toThrow(
      'AI model gpt-other is not configured',
    );
    expect(aiClient.runStructuredInference).not.toHaveBeenCalled();
  });

  it('keeps the mock model fast path and returns the completed script', async () => {
    const scriptMarketCreate = vi.fn().mockResolvedValueOnce({ id: 'script_market_root' }).mockResolvedValueOnce({
      id: 'script_market_candidate',
    });
    const tx = {
      causalScript: {
        create: vi.fn().mockResolvedValue({ id: 'script_1' }),
      },
      scriptMarket: {
        create: scriptMarketCreate,
        update: vi.fn(),
      },
      scriptOutcomeSelection: {
        create: vi.fn(),
      },
      polymarketOutcome: {
        findUnique: vi.fn().mockResolvedValue({
          bestAsk: '0.5',
          price: '0.45',
          lastTradePrice: null,
        }),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };
    const inferenceRunUpdate = vi.fn().mockResolvedValue({});
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(rootMarket()),
        findMany: vi.fn().mockResolvedValue([candidateMarket()]),
      },
      inferenceRun: {
        create: vi.fn().mockResolvedValue({ id: 'run_1' }),
        update: inferenceRunUpdate,
      },
      inferenceCacheEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    });

    const result = await service.createRun(currentUser(), createRunDto(MOCK_INFERENCE_MODEL));

    expect(result).toMatchObject({
      runId: 'run_1',
      status: 'completed',
      cacheHit: false,
      scriptId: 'script_1',
    });
    expect(inferenceRunUpdate).toHaveBeenCalledWith({
      where: { id: 'run_1' },
      data: {
        status: 'running',
        stage: 'ai_reasoning',
        progress: 30,
      },
    });
    expect(inferenceRunUpdate).toHaveBeenLastCalledWith({
      where: { id: 'run_1' },
      data: expect.objectContaining({
        status: 'completed',
        stage: 'script_generation',
        progress: 100,
      }) as object,
    });
  });
});

function createService(
  prisma: unknown,
  aiClient: unknown = {
    getCapability: vi.fn().mockReturnValue({
      status: 'unavailable',
      reason: 'fixture AI unavailable',
    }),
    runStructuredInference: vi.fn(),
  },
): InferenceService {
  return new InferenceService(prisma as PrismaService, aiClient as AiClientService);
}

function currentUser(): CurrentUser {
  return {
    id: 'user_1',
    walletAddress: '0x1111111111111111111111111111111111111111',
    chainId: 137,
  };
}

function createRunDto(model: string) {
  return {
    rootMarketId: 'root_market',
    rootOutcomeId: 'root_outcome',
    depth: 1,
    maxMarketsPerLayer: 2,
    confidenceThreshold: 0.5,
    model,
    cacheEnabled: true,
  };
}

function rootMarket() {
  return {
    id: 'root_market',
    eventId: 'event_1',
    question: 'Will the root event happen?',
    event: {
      title: 'Root Event',
      tags: ['fixture'],
    },
    outcomes: [
      {
        id: 'root_outcome',
        label: 'Yes',
        clobTokenId: 'root_token',
        price: '0.5',
      },
    ],
  };
}

function candidateMarket() {
  return {
    id: 'candidate_market',
    eventId: 'event_1',
    question: 'Will the candidate event happen?',
    description: null,
    rules: null,
    active: true,
    closed: false,
    acceptingOrders: true,
    volume: '100',
    volume24hr: '10',
    liquidity: '50',
    event: {
      title: 'Candidate Event',
      tags: ['fixture'],
    },
    outcomes: [
      {
        id: 'candidate_yes',
        label: 'Yes',
        clobTokenId: 'candidate_yes_token',
        price: '0.6',
      },
      {
        id: 'candidate_no',
        label: 'No',
        clobTokenId: 'candidate_no_token',
        price: '0.4',
      },
    ],
  };
}
