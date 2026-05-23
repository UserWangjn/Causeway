import { describe, expect, it, vi } from 'vitest';
import type { CurrentUser } from '../../src/common/decorators/current-user.decorator';
import type { PrismaService } from '../../src/database/prisma.service';
import type { AiClientService } from '../../src/integrations/ai/services/ai-client.service';
import { InferenceService } from '../../src/modules/inference/inference.service';
import type { InferencePromptInput } from '../../src/modules/inference/inference.types';
import { buildFixtureInferenceOutput } from '../support/inference-output.fixture';

describe('InferenceService', () => {
  it('rejects inference when the AI provider is unavailable', async () => {
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'unavailable',
        reason: 'AI inference client is not configured',
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn(),
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

    await expect(service.createRun(currentUser(), createRunDto('deepseek-v4-flash'))).rejects.toThrow(
      'AI inference client is not configured',
    );
    expect(polymarketMarketFindUnique).not.toHaveBeenCalled();
    expect(inferenceRunCreate).not.toHaveBeenCalled();
    expect(aiClient.runStructuredInference).not.toHaveBeenCalled();
    expect(aiClient.runStructuredInferenceContent).not.toHaveBeenCalled();
  });

  it('uses the configured AI provider for real models', async () => {
    const tx = createPersistTransactionClient();
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn((input: InferencePromptInput) =>
        Promise.resolve(JSON.stringify(buildFixtureInferenceOutput(input))),
      ),
    };
    let createdInputJson: unknown;
    const inferenceRunCreate = vi.fn((args: InferenceRunCreateArgs) => {
      createdInputJson = args.data.inputJson;
      return Promise.resolve({ id: 'run_1' });
    });
    const inferenceRunUpdate = vi.fn().mockResolvedValue({});
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(rootMarket()),
        findMany: vi.fn().mockResolvedValue([candidateMarket()]),
      },
      polymarketOutcome: {
        findMany: vi.fn().mockResolvedValue(outcomePriceRows()),
      },
      inferenceRun: {
        create: inferenceRunCreate,
        update: inferenceRunUpdate,
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockImplementation(() =>
          Promise.resolve({
            id: 'run_1',
            userId: 'user_1',
            rootMarketId: 'root_market',
            rootOutcomeId: 'root_outcome',
            depth: 1,
            maxMarketsPerLayer: 2,
            confidenceThreshold: 0.5,
            model: 'deepseek-v4-flash',
            cacheEnabled: true,
            cacheKey: 'cache_key_1',
            inputJson: createdInputJson,
          }),
        ),
      },
      inferenceCacheEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    }, aiClient);

    const result = await service.createRun(currentUser(), createRunDto('deepseek-v4-flash'));

    expect(result).toMatchObject({
      runId: 'run_1',
      status: 'queued',
      scriptId: null,
    });
    expect(aiClient.runStructuredInferenceContent).not.toHaveBeenCalled();

    const completed = await service.processQueuedRun('run_1');

    expect(completed).toMatchObject({
      runId: 'run_1',
      status: 'completed',
      scriptId: 'script_1',
    });
    const providerOptions = readProviderCallOptions(aiClient.runStructuredInferenceContent, 0);
    expect(providerOptions.model).toBe('deepseek-v4-flash');
    expect(providerOptions.prompt?.systemPrompt).toContain('structured market data provided by the backend');
  });

  it('resolves auto model requests to the configured AI provider model', async () => {
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn(),
    };
    let createdInputJson: unknown;
    const inferenceRunCreate = vi.fn((args: InferenceRunCreateArgs) => {
      createdInputJson = args.data.inputJson;
      return Promise.resolve({ id: 'run_1' });
    });
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(rootMarket()),
        findMany: vi.fn().mockResolvedValue([candidateMarket()]),
      },
      inferenceRun: {
        create: inferenceRunCreate,
      },
    }, aiClient);

    await service.createRun(currentUser(), createRunDto('auto'));

    expect(inferenceRunCreate).toHaveBeenCalledTimes(1);
    expect(inferenceRunCreate.mock.calls[0]?.[0].data.model).toBe('deepseek-v4-flash');
    const storedInput = readRecord(createdInputJson, 'createdInputJson');
    expect(readStringProperty(storedInput, 'model')).toBe('deepseek-v4-flash');
    expect(readStringProperty(storedInput, 'requestedModel')).toBe('auto');
  });

  it('caps high-depth inference output breadth before storing the prompt input', async () => {
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn(),
    };
    let createdInputJson: unknown;
    const inferenceRunCreate = vi.fn((args: InferenceRunCreateArgs) => {
      createdInputJson = args.data.inputJson;
      return Promise.resolve({ id: 'run_1' });
    });
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(rootMarket()),
        findMany: vi.fn().mockResolvedValue([candidateMarket()]),
      },
      inferenceRun: {
        create: inferenceRunCreate,
      },
      membershipEntitlement: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue({ id: 'membership_1' }),
      },
    }, aiClient);

    await service.createRun(currentUser(), {
      ...createRunDto('deepseek-v4-pro'),
      depth: 3,
      maxMarketsPerLayer: 8,
    });

    expect(inferenceRunCreate.mock.calls[0]?.[0].data.maxMarketsPerLayer).toBe(3);
    const storedInput = readRecord(createdInputJson, 'createdInputJson');
    const settings = readRecordProperty(storedInput, 'settings');
    expect(readNumberProperty(settings, 'maxMarketsPerLayer')).toBe(3);
  });

  it('repairs invalid provider output once before completing the run', async () => {
    const tx = createPersistTransactionClient();
    let providerCallCount = 0;
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn((input: InferencePromptInput) => {
        providerCallCount += 1;
        const output = buildFixtureInferenceOutput(input);
        if (providerCallCount === 1) {
          output.nodes[1].confidence = 0.1;
        }
        return Promise.resolve(JSON.stringify(output));
      }),
    };
    let createdInputJson: unknown;
    const inferenceRunCreate = vi.fn((args: InferenceRunCreateArgs) => {
      createdInputJson = args.data.inputJson;
      return Promise.resolve({ id: 'run_1' });
    });
    const inferenceRunUpdate = vi.fn().mockResolvedValue({});
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(rootMarket()),
        findMany: vi.fn().mockResolvedValue([candidateMarket()]),
      },
      polymarketOutcome: {
        findMany: vi.fn().mockResolvedValue(outcomePriceRows()),
      },
      inferenceRun: {
        create: inferenceRunCreate,
        update: inferenceRunUpdate,
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockImplementation(() =>
          Promise.resolve({
            id: 'run_1',
            userId: 'user_1',
            rootMarketId: 'root_market',
            rootOutcomeId: 'root_outcome',
            depth: 1,
            maxMarketsPerLayer: 2,
            confidenceThreshold: 0.5,
            model: 'deepseek-v4-flash',
            cacheEnabled: true,
            cacheKey: 'cache_key_1',
            inputJson: createdInputJson,
          }),
        ),
      },
      inferenceCacheEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    }, aiClient);

    await service.createRun(currentUser(), createRunDto('deepseek-v4-flash'));
    const completed = await service.processQueuedRun('run_1');

    expect(completed).toMatchObject({ status: 'completed', scriptId: 'script_1' });
    expect(aiClient.runStructuredInferenceContent).toHaveBeenCalledTimes(2);
    const repairOptions = readProviderCallOptions(aiClient.runStructuredInferenceContent, 1);
    expect(readStringProperty(repairOptions.prompt?.userPayload, 'task')).toContain('Repair');
    expect(readStringProperty(readRecordProperty(repairOptions.prompt?.userPayload, 'repair'), 'validationError')).toContain(
      'below threshold',
    );
  });

  it('repairs invalid provider JSON content once before completing the run', async () => {
    const tx = createPersistTransactionClient();
    let providerCallCount = 0;
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn((input: InferencePromptInput) => {
        providerCallCount += 1;
        return Promise.resolve(providerCallCount === 1 ? 'not-json' : JSON.stringify(buildFixtureInferenceOutput(input)));
      }),
    };
    let createdInputJson: unknown;
    const inferenceRunCreate = vi.fn((args: InferenceRunCreateArgs) => {
      createdInputJson = args.data.inputJson;
      return Promise.resolve({ id: 'run_1' });
    });
    const inferenceRunUpdate = vi.fn().mockResolvedValue({});
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(rootMarket()),
        findMany: vi.fn().mockResolvedValue([candidateMarket()]),
      },
      polymarketOutcome: {
        findMany: vi.fn().mockResolvedValue(outcomePriceRows()),
      },
      inferenceRun: {
        create: inferenceRunCreate,
        update: inferenceRunUpdate,
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockImplementation(() =>
          Promise.resolve({
            id: 'run_1',
            userId: 'user_1',
            rootMarketId: 'root_market',
            rootOutcomeId: 'root_outcome',
            depth: 1,
            maxMarketsPerLayer: 2,
            confidenceThreshold: 0.5,
            model: 'deepseek-v4-flash',
            cacheEnabled: true,
            cacheKey: 'cache_key_1',
            inputJson: createdInputJson,
          }),
        ),
      },
      inferenceCacheEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    }, aiClient);

    await service.createRun(currentUser(), createRunDto('deepseek-v4-flash'));
    const completed = await service.processQueuedRun('run_1');

    expect(completed).toMatchObject({ status: 'completed', scriptId: 'script_1' });
    expect(aiClient.runStructuredInferenceContent).toHaveBeenCalledTimes(2);
    const repairOptions = readProviderCallOptions(aiClient.runStructuredInferenceContent, 1);
    expect(readStringProperty(readRecordProperty(repairOptions.prompt?.userPayload, 'repair'), 'validationError')).toContain(
      'invalid JSON',
    );
  });

  it('persists provider attempt audit when initial and repair outputs both fail', async () => {
    const initialContent = 'x'.repeat(10_000);
    let providerCallCount = 0;
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn(() => {
        providerCallCount += 1;
        return Promise.resolve(providerCallCount === 1 ? initialContent : 'still-not-json');
      }),
    };
    let createdInputJson: unknown;
    const inferenceRunCreate = vi.fn((args: InferenceRunCreateArgs) => {
      createdInputJson = args.data.inputJson;
      return Promise.resolve({ id: 'run_1' });
    });
    const inferenceRunUpdate = vi.fn().mockResolvedValue({});
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(rootMarket()),
        findMany: vi.fn().mockResolvedValue([candidateMarket()]),
      },
      inferenceRun: {
        create: inferenceRunCreate,
        update: inferenceRunUpdate,
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockImplementation(() =>
          Promise.resolve({
            id: 'run_1',
            userId: 'user_1',
            rootMarketId: 'root_market',
            rootOutcomeId: 'root_outcome',
            depth: 1,
            maxMarketsPerLayer: 2,
            confidenceThreshold: 0.5,
            model: 'deepseek-v4-flash',
            cacheEnabled: true,
            cacheKey: 'cache_key_1',
            inputJson: createdInputJson,
          }),
        ),
      },
      inferenceCacheEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    }, aiClient);

    await service.createRun(currentUser(), createRunDto('deepseek-v4-flash'));
    await expect(service.processQueuedRun('run_1')).resolves.toBeNull();

    expect(aiClient.runStructuredInferenceContent).toHaveBeenCalledTimes(2);
    const repairOptions = readProviderCallOptions(aiClient.runStructuredInferenceContent, 1);
    const repair = readRecordProperty(repairOptions.prompt?.userPayload, 'repair');
    const previousOutput = readRecordProperty(repair, 'previousOutput');
    expect(readStringProperty(previousOutput, 'preview')).toHaveLength(4_000);
    expect(readNumberProperty(previousOutput, 'length')).toBe(10_000);
    expect(readBooleanProperty(previousOutput, 'truncated')).toBe(true);

    const failedOutputJson = findFailedOutputJson(inferenceRunUpdate);
    expect(failedOutputJson.result).toBeNull();
    const audit = readRecordProperty(failedOutputJson, 'audit');
    expect(readStringProperty(audit, 'source')).toBe('provider');
    const attempts = readArrayProperty(audit, 'attempts');
    expect(attempts).toHaveLength(2);
    expect(readNumberProperty(readRecord(attempts[0], 'attempts.0'), 'rawContentLength')).toBe(10_000);
    expect(readStringProperty(readRecord(attempts[0], 'attempts.0'), 'parseError')).toContain('invalid JSON');
  });

  it('rejects models that do not match the configured provider model', async () => {
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash'],
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn(),
    };
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn(),
      },
    }, aiClient);

    await expect(service.createRun(currentUser(), createRunDto('unsupported-model'))).rejects.toThrow(
      'AI model unsupported-model is not configured',
    );
    expect(aiClient.runStructuredInferenceContent).not.toHaveBeenCalled();
  });

  it('drops oversized candidate payloads before storing the prompt input', async () => {
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn(),
    };
    let createdInputJson: unknown;
    const inferenceRunCreate = vi.fn((args: InferenceRunCreateArgs) => {
      createdInputJson = args.data.inputJson;
      return Promise.resolve({ id: 'run_1' });
    });
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(rootMarket()),
        findMany: vi.fn().mockResolvedValue([oversizedCandidateMarket()]),
      },
      inferenceRun: {
        create: inferenceRunCreate,
      },
    }, aiClient);

    await service.createRun(currentUser(), createRunDto('deepseek-v4-flash'));

    const input = readRecord(createdInputJson, 'inputJson');
    expect(readArrayProperty(input, 'candidateMarkets')).toHaveLength(0);
    expect(aiClient.runStructuredInferenceContent).not.toHaveBeenCalled();
  });

  it('requires premium membership for advanced models', async () => {
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn(),
    };
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn(),
      },
    }, aiClient);

    await expect(service.createRun(currentUser(), createRunDto('deepseek-v4-pro'))).rejects.toThrow(
      'Premium membership is required',
    );
    expect(aiClient.runStructuredInferenceContent).not.toHaveBeenCalled();
  });

  it('requires premium membership for inference depth above one layer', async () => {
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn(),
    };
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn(),
      },
    }, aiClient);

    await expect(service.createRun(currentUser(), {
      ...createRunDto('deepseek-v4-flash'),
      depth: 2,
    })).rejects.toThrow('Premium membership is required');
    expect(aiClient.runStructuredInferenceContent).not.toHaveBeenCalled();
  });

  it('allows premium users to run advanced inference settings', async () => {
    const tx = createPersistTransactionClient();
    const aiClient = {
      getCapability: vi.fn().mockReturnValue({
        status: 'available',
        reason: null,
        model: 'deepseek-v4-flash',
        models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      }),
      runStructuredInference: vi.fn(),
      runStructuredInferenceContent: vi.fn((input: InferencePromptInput) =>
        Promise.resolve(JSON.stringify(buildFixtureInferenceOutput(input))),
      ),
    };
    let createdInputJson: unknown;
    const inferenceRunCreate = vi.fn((args: InferenceRunCreateArgs) => {
      createdInputJson = args.data.inputJson;
      return Promise.resolve({ id: 'run_1' });
    });
    const inferenceRunUpdate = vi.fn().mockResolvedValue({});
    const service = createService({
      polymarketMarket: {
        findUnique: vi.fn().mockResolvedValue(rootMarket()),
        findMany: vi.fn().mockResolvedValue([candidateMarket()]),
      },
      polymarketOutcome: {
        findMany: vi.fn().mockResolvedValue(outcomePriceRows()),
      },
      inferenceRun: {
        create: inferenceRunCreate,
        update: inferenceRunUpdate,
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockImplementation(() =>
          Promise.resolve({
            id: 'run_1',
            userId: 'user_1',
            rootMarketId: 'root_market',
            rootOutcomeId: 'root_outcome',
            depth: 2,
            maxMarketsPerLayer: 2,
            confidenceThreshold: 0.5,
            model: 'deepseek-v4-pro',
            cacheEnabled: true,
            cacheKey: 'cache_key_1',
            inputJson: createdInputJson,
          }),
        ),
      },
      inferenceCacheEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      membershipEntitlement: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue({ id: 'membership_1' }),
      },
      $transaction: vi.fn((callback: (transactionClient: unknown) => Promise<unknown>) => callback(tx)),
    }, aiClient);

    const result = await service.createRun(currentUser(), {
      ...createRunDto('deepseek-v4-pro'),
      depth: 2,
    });

    expect(result).toMatchObject({
      runId: 'run_1',
      status: 'queued',
      cacheHit: false,
      scriptId: null,
    });
    const completed = await service.processQueuedRun('run_1');

    expect(completed).toMatchObject({
      runId: 'run_1',
      status: 'completed',
      cacheHit: false,
      scriptId: 'script_1',
    });
    const providerOptions = readProviderCallOptions(aiClient.runStructuredInferenceContent, 0);
    expect(providerOptions.model).toBe('deepseek-v4-pro');
    expect(tx.scriptMarket.createMany).toHaveBeenCalledTimes(1);
    const selectionCreateManyArgs: unknown = tx.scriptOutcomeSelection.createMany.mock.calls[0]?.[0];
    const selectionRows = readArrayProperty(
      readRecord(selectionCreateManyArgs, 'scriptOutcomeSelection.createMany args'),
      'data',
    );
    expect(selectionRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcomeId: 'candidate_yes',
          aiAction: 'buy',
          limitPrice: '0.61',
          amountUsd: '10',
        }),
        expect.objectContaining({
          outcomeId: 'candidate_no',
          aiAction: 'avoid',
          limitPrice: null,
          amountUsd: '0',
        }),
      ]),
    );
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
    runStructuredInferenceContent: vi.fn(),
  },
): InferenceService {
  return new InferenceService({
    membershipEntitlement: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    ...(prisma as Record<string, unknown>),
  } as PrismaService, aiClient as AiClientService);
}

function createPersistTransactionClient() {
  return {
    causalScript: {
      create: vi.fn().mockResolvedValue({ id: 'script_1' }),
    },
    scriptMarket: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    scriptOutcomeSelection: {
      createMany: vi.fn().mockResolvedValue({ count: 3 }),
    },
    auditEvent: {
      create: vi.fn(),
    },
  };
}

function outcomePriceRows() {
  return [
    {
      id: 'root_outcome',
      bestAsk: '0.51',
      price: '0.5',
      lastTradePrice: '0.5',
    },
    {
      id: 'candidate_yes',
      bestAsk: '0.61',
      price: '0.6',
      lastTradePrice: '0.6',
    },
  ];
}

type InferenceRunCreateArgs = {
  data: {
    inputJson: unknown;
    maxMarketsPerLayer?: number;
    model?: string;
  };
};

type ProviderCallOptions = {
  model?: string;
  prompt?: {
    systemPrompt: string;
    userPayload: unknown;
  };
};

function readProviderCallOptions(
  mock: { mock: { calls: unknown[][] } },
  index: number,
): ProviderCallOptions {
  const options = mock.mock.calls[index]?.[1];
  if (!options || typeof options !== 'object') {
    throw new Error(`Missing provider call options at index ${index}`);
  }
  return options;
}

function findFailedOutputJson(mock: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  for (const call of mock.mock.calls) {
    const args = readRecord(call[0], 'inferenceRun.update args');
    const data = readRecord(args.data, 'inferenceRun.update args.data');
    if (data.status === 'failed' && data.outputJson) {
      return readRecord(data.outputJson, 'inferenceRun.update args.data.outputJson');
    }
  }
  throw new Error('Expected a failed inferenceRun.update call with outputJson');
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${path} to be an object`);
  }
  return value as Record<string, unknown>;
}

function readRecordProperty(value: unknown, property: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${property} parent to be an object`);
  }
  const propertyValue = (value as Record<string, unknown>)[property];
  if (!propertyValue || typeof propertyValue !== 'object' || Array.isArray(propertyValue)) {
    throw new Error(`Expected ${property} to be an object`);
  }
  return propertyValue as Record<string, unknown>;
}

function readStringProperty(value: unknown, property: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${property} parent to be an object`);
  }
  const propertyValue = (value as Record<string, unknown>)[property];
  if (typeof propertyValue !== 'string') {
    throw new Error(`Expected ${property} to be a string`);
  }
  return propertyValue;
}

function readNumberProperty(value: unknown, property: string): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${property} parent to be an object`);
  }
  const propertyValue = (value as Record<string, unknown>)[property];
  if (typeof propertyValue !== 'number') {
    throw new Error(`Expected ${property} to be a number`);
  }
  return propertyValue;
}

function readBooleanProperty(value: unknown, property: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${property} parent to be an object`);
  }
  const propertyValue = (value as Record<string, unknown>)[property];
  if (typeof propertyValue !== 'boolean') {
    throw new Error(`Expected ${property} to be a boolean`);
  }
  return propertyValue;
}

function readArrayProperty(value: unknown, property: string): unknown[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected ${property} parent to be an object`);
  }
  const propertyValue = (value as Record<string, unknown>)[property];
  if (!Array.isArray(propertyValue)) {
    throw new Error(`Expected ${property} to be an array`);
  }
  return propertyValue;
}

function currentUser(): CurrentUser {
  return {
    id: 'user_1',
    sessionId: 'session_1',
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
        bestBid: '0.49',
        bestAsk: '0.51',
        lastTradePrice: '0.5',
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
    enableOrderBook: true,
    orderMinSize: '5',
    orderPriceMinTickSize: '0.01',
    bestBid: '0.59',
    bestAsk: '0.61',
    lastTradePrice: '0.6',
    spread: '0.02',
    volume: '100',
    volume24hr: '10',
    liquidity: '50',
    endDate: null,
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
        bestBid: '0.59',
        bestAsk: '0.61',
        lastTradePrice: '0.6',
      },
      {
        id: 'candidate_no',
        label: 'No',
        clobTokenId: 'candidate_no_token',
        price: '0.4',
        bestBid: '0.39',
        bestAsk: '0.41',
        lastTradePrice: '0.4',
      },
    ],
  };
}

function oversizedCandidateMarket() {
  const market = candidateMarket();
  return {
    ...market,
    description: 'description '.repeat(20_000),
    rules: 'rules '.repeat(20_000),
    outcomes: Array.from({ length: 1_500 }, (_, index) => ({
      id: `candidate_outcome_${index}`,
      label: `Outcome ${index} ${'label '.repeat(500)}`,
      clobTokenId: `candidate_token_${index}`,
      price: '0.5',
      bestBid: '0.49',
      bestAsk: '0.51',
      lastTradePrice: '0.5',
    })),
  };
}
