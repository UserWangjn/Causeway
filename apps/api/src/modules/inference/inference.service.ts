import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiException } from '../../common/errors/api.exception';
import { hashJson } from '../../common/utils/hash.util';
import { toNullableNumber } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';
import { AiClientService } from '../../integrations/ai/services/ai-client.service';
import { CreateInferenceRunDto } from './dto/create-inference-run.dto';
import {
  buildInferenceCacheKey,
  buildMockInferenceOutput,
  INFERENCE_OUTPUT_SCHEMA_VERSION,
  INFERENCE_PROMPT_VERSION,
  MOCK_INFERENCE_MODEL,
  validateAiInferenceOutput,
} from './inference-engine';
import {
  buildInferenceAiPrompt,
  MAX_INFERENCE_REPAIR_PREVIOUS_OUTPUT_CHARS,
  MAX_INFERENCE_REPAIR_VALIDATION_ERROR_CHARS,
} from './inference-prompt';
import type { InferencePromptRepairContext } from './inference-prompt';
import type { AiInferenceOutput, AiMarketNode, InferenceMarketInput, InferencePromptInput } from './inference.types';

const MIN_INFERENCE_CANDIDATE_MARKETS = 30;
const MAX_INFERENCE_CANDIDATE_MARKETS = 120;
const MAX_INFERENCE_TEXT_TERMS = 5;
const MAX_PROMPT_TEXT_LENGTH = 800;
const MIN_PROMPT_TEXT_LENGTH = 180;
const EMERGENCY_PROMPT_TEXT_LENGTH = 120;
const EMERGENCY_PROMPT_EVENT_TEXT_LENGTH = 80;
const EMERGENCY_PROMPT_OUTCOME_LABEL_LENGTH = 80;
const MAX_INFERENCE_PROMPT_INPUT_CHARS = 60_000;
const MAX_AI_RAW_CONTENT_AUDIT_CHARS = 8_000;
const SCRIPT_PERSIST_TRANSACTION_MAX_WAIT_MS = 5_000;
const SCRIPT_PERSIST_TRANSACTION_TIMEOUT_MS = 20_000;
const DEFAULT_SCRIPT_BUY_AMOUNT_USD = '10';
const AUTO_INFERENCE_MODEL = 'auto';

const CANDIDATE_MARKET_INCLUDE = {
  event: true,
  outcomes: {
    orderBy: { outcomeIndex: 'asc' },
  },
} satisfies Prisma.PolymarketMarketInclude;

const CANDIDATE_MARKET_ORDER_BY = [
  { volume24hr: { sort: 'desc', nulls: 'last' } },
  { volume: { sort: 'desc', nulls: 'last' } },
  { liquidity: { sort: 'desc', nulls: 'last' } },
  { id: 'asc' },
] satisfies Prisma.PolymarketMarketOrderByWithRelationInput[];

@Injectable()
export class InferenceService implements OnModuleDestroy {
  private readonly processingRunIds = new Set<string>();
  private isShuttingDown = false;

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AiClientService)
    private readonly aiClient: AiClientService,
  ) {}

  onModuleDestroy(): void {
    this.isShuttingDown = true;
  }

  getCapability() {
    const capability = this.aiClient.getCapability();
    return {
      status: capability.status,
      reason: capability.reason,
      defaultModel: capability.model,
      models: capability.models,
      mockModel: MOCK_INFERENCE_MODEL,
    };
  }

  async createRun(user: CurrentUser, dto: CreateInferenceRunDto) {
    const resolvedDto = { ...dto, model: this.resolveRequestedModel(dto.model) };

    const root = await this.loadRootMarket(resolvedDto.rootMarketId, resolvedDto.rootOutcomeId);
    const candidateMarkets = await this.loadCandidateMarkets(root.market, resolvedDto);
    const promptInput = fitPromptInputToBudget(buildPromptInput(root, candidateMarkets, resolvedDto));
    const cacheKey = buildInferenceCacheKey({
      promptInput,
      model: resolvedDto.model,
    });
    const inputJson = toJson({
      ...promptInput,
      model: resolvedDto.model,
      requestedModel: dto.model,
      promptVersion: INFERENCE_PROMPT_VERSION,
      outputSchemaVersion: INFERENCE_OUTPUT_SCHEMA_VERSION,
    });

    const run = await this.prisma.inferenceRun.create({
      data: {
        userId: user.id,
        rootEventId: root.market.eventId,
        rootMarketId: root.market.id,
        rootOutcomeId: root.outcome.id,
        rootClobTokenId: root.outcome.clobTokenId,
        depth: resolvedDto.depth,
        maxMarketsPerLayer: resolvedDto.maxMarketsPerLayer,
        confidenceThreshold: resolvedDto.confidenceThreshold,
        model: resolvedDto.model,
        promptVersion: INFERENCE_PROMPT_VERSION,
        outputSchemaVersion: INFERENCE_OUTPUT_SCHEMA_VERSION,
        cacheEnabled: resolvedDto.cacheEnabled ?? true,
        cacheKey,
        status: 'queued',
        stage: 'candidate_retrieval',
        progress: 0,
        inputJson,
      },
    });

    return {
      runId: run.id,
      status: 'queued',
      cacheKey,
      cacheHit: false,
      scriptId: null,
    };
  }

  private resolveRequestedModel(requestedModel: string): string {
    if (requestedModel === MOCK_INFERENCE_MODEL) return requestedModel;

    const capability = this.aiClient.getCapability();
    if (capability.status !== 'available' || !capability.model) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'CAPABILITY_UNAVAILABLE',
        capability.reason ?? 'AI inference client is unavailable',
      );
    }

    if (requestedModel === AUTO_INFERENCE_MODEL) return capability.model;

    const allowedModels = capability.models?.length ? capability.models : [capability.model];
    if (!allowedModels.includes(requestedModel)) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'CAPABILITY_UNAVAILABLE',
        `AI model ${requestedModel} is not configured`,
        { configuredModel: capability.model, allowedModels },
      );
    }

    return requestedModel;
  }

  @Interval(1_000)
  async processQueuedRuns(): Promise<void> {
    if (this.isShuttingDown) return;
    const capacity = Math.max(0, 2 - this.processingRunIds.size);
    if (capacity === 0) return;

    const runs = await this.prisma.inferenceRun.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
      take: capacity,
      select: { id: true },
    });
    for (const run of runs) {
      void this.processQueuedRun(run.id);
    }
  }

  async processQueuedRun(runId: string) {
    if (this.processingRunIds.has(runId)) return null;
    this.processingRunIds.add(runId);
    try {
      const claim = await this.prisma.inferenceRun.updateMany({
        where: { id: runId, status: 'queued' },
        data: {
          status: 'running',
          stage: 'candidate_retrieval',
          progress: 10,
          errorMessage: null,
        },
      });
      if (claim.count !== 1) return null;

      const run = await this.prisma.inferenceRun.findUnique({
        where: { id: runId },
        select: {
          id: true,
          userId: true,
          rootMarketId: true,
          rootOutcomeId: true,
          depth: true,
          maxMarketsPerLayer: true,
          confidenceThreshold: true,
          model: true,
          cacheEnabled: true,
          cacheKey: true,
          inputJson: true,
        },
      });
      if (!run) {
        await this.markRunFailed(runId, 'Inference run was not found after it was claimed');
        return null;
      }

      const dto = dtoFromRun(run);
      const root = await this.loadRootMarket(run.rootMarketId, run.rootOutcomeId);
      const promptInput = readStoredPromptInput(run.inputJson);
      return await this.processRun(run.id, run.userId, undefined, dto, root, promptInput, run.cacheKey);
    } catch (error) {
      await this.markRunFailed(runId, errorMessageFrom(error), buildFailureInferenceRunOutputJson(error));
      return null;
    } finally {
      this.processingRunIds.delete(runId);
    }
  }

  private async processRun(
    runId: string,
    userId: string,
    requestId: string | undefined,
    dto: CreateInferenceRunDto,
    root: LoadedRootMarket,
    promptInput: InferencePromptInput,
    cacheKey: string,
  ) {
    await this.prisma.inferenceRun.update({
      where: { id: runId },
      data: {
        status: 'running',
        stage: 'ai_reasoning',
        progress: 30,
      },
    });
    const resolvedOutput = await this.resolveInferenceOutput(dto, promptInput, cacheKey);
    await this.prisma.inferenceRun.update({
      where: { id: runId },
      data: {
        stage: 'outcome_mapping',
        progress: 60,
        outputJson: toJson(buildInferenceRunOutputJson(resolvedOutput.validatedOutput, resolvedOutput.audit)),
      },
    });
    if (!resolvedOutput.cacheHit) {
      await this.storeInferenceCache(dto, promptInput, cacheKey, resolvedOutput.validatedOutput);
    }

    const script = await this.persistScript(userId, requestId, runId, root, resolvedOutput.validatedOutput);
    await this.prisma.inferenceRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        stage: 'script_generation',
        progress: 100,
        cacheHit: resolvedOutput.cacheHit,
        outputJson: toJson(buildInferenceRunOutputJson(resolvedOutput.validatedOutput, resolvedOutput.audit)),
        completedAt: new Date(),
      },
    });

    return {
      runId,
      status: 'completed',
      cacheKey,
      cacheHit: resolvedOutput.cacheHit,
      scriptId: script.id,
    };
  }

  private async markRunFailed(
    runId: string,
    errorMessage: string,
    outputJson?: Prisma.InputJsonValue,
  ): Promise<void> {
    const data: Prisma.InferenceRunUpdateInput = {
      status: 'failed',
      progress: 100,
      errorMessage,
      completedAt: new Date(),
    };
    if (outputJson !== undefined) {
      data.outputJson = outputJson;
    }
    await this.prisma.inferenceRun.update({
      where: { id: runId },
      data,
    });
  }

  async getRun(user: CurrentUser, runId: string) {
    const run = await this.prisma.inferenceRun.findFirst({
      where: { id: runId, userId: user.id },
      include: {
        script: {
          select: { id: true },
        },
      },
    });
    if (!run) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'REQUEST_FAILED', 'Inference run was not found');
    }

    return {
      id: run.id,
      status: run.status,
      stage: run.stage,
      progress: run.progress,
      cacheHit: run.cacheHit,
      scriptId: run.script?.id ?? null,
      errorMessage: run.errorMessage,
      createdAt: run.createdAt.toISOString(),
      completedAt: run.completedAt?.toISOString() ?? null,
    };
  }

  private async resolveInferenceOutput(
    dto: CreateInferenceRunDto,
    promptInput: InferencePromptInput,
    cacheKey: string,
  ): Promise<ResolvedInferenceOutput> {
    if (dto.cacheEnabled !== false) {
      const cached = await this.prisma.inferenceCacheEntry.findFirst({
        where: {
          cacheKey,
          expiresAt: {
            gt: new Date(),
          },
        },
      });
      if (cached) {
        await this.prisma.inferenceCacheEntry.update({
          where: { id: cached.id },
          data: {
            lastUsedAt: new Date(),
            useCount: {
              increment: 1,
            },
          },
        });
        const validatedOutput = validateAiInferenceOutput(cached.resultJson, promptInput);
        return {
          validatedOutput,
          cacheHit: true,
          audit: {
            source: 'cache',
            attempts: [],
          },
        };
      }
    }

    if (dto.model === MOCK_INFERENCE_MODEL) {
      const output = validateAiInferenceOutput(buildMockInferenceOutput(promptInput), promptInput);
      return {
        validatedOutput: output,
        cacheHit: false,
        audit: {
          source: 'mock',
          attempts: [],
        },
      };
    }

    return {
      ...(await this.runProviderInferenceWithRepair(dto, promptInput)),
      cacheHit: false,
    };
  }

  private async runProviderInferenceWithRepair(
    dto: CreateInferenceRunDto,
    promptInput: InferencePromptInput,
  ): Promise<{ validatedOutput: AiInferenceOutput; audit: InferenceRunAudit }> {
    const attempts: InferenceProviderAttemptAudit[] = [];
    const initialContent = await this.aiClient.runStructuredInferenceContent(promptInput, {
      model: dto.model,
      prompt: buildInferenceAiPrompt(promptInput),
    });
    const initialAttempt = parseAndValidateProviderContent('initial', initialContent, promptInput);
    attempts.push(initialAttempt.audit);
    if (initialAttempt.ok) {
      return {
        validatedOutput: initialAttempt.output,
        audit: {
          source: 'provider',
          attempts,
        },
      };
    }

    const repairContent = await this.aiClient.runStructuredInferenceContent(promptInput, {
      model: dto.model,
      prompt: buildInferenceAiPrompt(promptInput, {
        previousOutput: initialAttempt.previousOutput,
        validationError: initialAttempt.errorMessage,
      }),
    });
    const repairAttempt = parseAndValidateProviderContent('repair', repairContent, promptInput);
    attempts.push(repairAttempt.audit);
    if (!repairAttempt.ok) {
      throw new InferenceProviderOutputError(repairAttempt.errorMessage, attempts);
    }

    const validatedOutput = {
      ...repairAttempt.output,
      warnings: Array.from(new Set([...repairAttempt.output.warnings, 'ai_output_repaired_after_validation_error'])),
    };
    return {
      validatedOutput,
      audit: {
        source: 'provider',
        attempts,
      },
    };
  }

  private async storeInferenceCache(
    dto: CreateInferenceRunDto,
    promptInput: InferencePromptInput,
    cacheKey: string,
    output: AiInferenceOutput,
  ): Promise<void> {
    if (dto.cacheEnabled !== false) {
      await this.prisma.inferenceCacheEntry.upsert({
        where: { cacheKey },
        update: {
          resultJson: toJson(output),
          outputHash: hashJson(output),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          lastUsedAt: new Date(),
          useCount: {
            increment: 1,
          },
        },
        create: {
          cacheKey,
          model: dto.model,
          promptVersion: INFERENCE_PROMPT_VERSION,
          outputSchemaVersion: INFERENCE_OUTPUT_SCHEMA_VERSION,
          inputHash: hashJson(promptInput),
          outputHash: hashJson(output),
          resultJson: toJson(output),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          lastUsedAt: new Date(),
          useCount: 1,
        },
      });
    }
  }

  private async persistScript(
    userId: string,
    requestId: string | undefined,
    runId: string,
    root: LoadedRootMarket,
    output: AiInferenceOutput,
  ) {
    const outcomePriceById = await this.loadOutcomePriceById(output);
    const incomingEdgeCountByNodeId = countIncomingEdgesByTarget(output.edges);
    const scriptMarketIdByNodeId = new Map(output.nodes.map((node) => [node.clientNodeId, randomUUID()]));

    return this.prisma.$transaction(async (tx) => {
      const script = await tx.causalScript.create({
        data: {
          userId,
          inferenceRunId: runId,
          title: `Causeway script: ${root.market.question}`,
          status: 'draft',
          rootEventId: root.market.eventId,
          rootMarketId: root.market.id,
          rootOutcomeId: root.outcome.id,
          graphJson: toJson(buildGraphJson(output, root)),
          summary: output.summary,
        },
      });

      await tx.scriptMarket.createMany({
        data: output.nodes.map((node) => ({
          id: requireScriptMarketId(scriptMarketIdByNodeId, node.clientNodeId),
          scriptId: script.id,
          marketId: node.marketId,
          parentScriptMarketId: resolveParentScriptMarketId(node, output.edges, scriptMarketIdByNodeId),
          layer: node.layer,
          impactDirection: node.impactDirection,
          confidence: node.confidence,
          reason: node.reason,
          metadata: toJson({
            clientNodeId: node.clientNodeId,
            edgeCount: incomingEdgeCountByNodeId.get(node.clientNodeId) ?? 0,
          }),
        })),
      });

      await tx.scriptOutcomeSelection.createMany({
        data: output.nodes.flatMap((node) => {
          const scriptMarketId = requireScriptMarketId(scriptMarketIdByNodeId, node.clientNodeId);
          return node.outcomes.map((recommendation) => ({
            scriptMarketId,
            outcomeId: recommendation.outcomeId,
            aiAction: recommendation.aiAction,
            userAction: recommendation.aiAction === 'buy' ? 'buy' : 'skip',
            orderMode: 'limit',
            limitPrice: recommendation.aiAction === 'buy' ? outcomePriceById.get(recommendation.outcomeId) ?? null : null,
            amountUsd: recommendation.aiAction === 'buy' ? DEFAULT_SCRIPT_BUY_AMOUNT_USD : '0',
            confidence: recommendation.confidence,
            reason: recommendation.reason,
          }));
        }),
      });

      await tx.auditEvent.create({
        data: {
          userId,
          ...(requestId ? { requestId } : {}),
          actorType: 'system',
          entityType: 'causal_script',
          entityId: script.id,
          action: 'script.generated',
          after: toJson({
            inferenceRunId: runId,
            rootMarketId: root.market.id,
            rootOutcomeId: root.outcome.id,
            nodeCount: output.nodes.length,
          }),
        },
      });

      return script;
    }, {
      maxWait: SCRIPT_PERSIST_TRANSACTION_MAX_WAIT_MS,
      timeout: SCRIPT_PERSIST_TRANSACTION_TIMEOUT_MS,
    });
  }

  private async loadOutcomePriceById(output: AiInferenceOutput): Promise<Map<string, string>> {
    const buyOutcomeIds = collectBuyOutcomeIds(output);
    if (buyOutcomeIds.length === 0) return new Map();

    const outcomes = await this.prisma.polymarketOutcome.findMany({
      where: { id: { in: buyOutcomeIds } },
      select: { id: true, price: true, bestAsk: true, lastTradePrice: true },
    });

    return new Map(
      outcomes.flatMap((outcome) => {
        const price = resolveOutcomePrice(outcome);
        return price == null ? [] : [[outcome.id, price]];
      }),
    );
  }

  private async loadRootMarket(rootMarketId: string, rootOutcomeId: string): Promise<LoadedRootMarket> {
    const market = await this.prisma.polymarketMarket.findUnique({
      where: { id: rootMarketId },
      include: {
        event: true,
        outcomes: {
          orderBy: { outcomeIndex: 'asc' },
        },
      },
    });
    if (!market) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'MARKET_NOT_FOUND', 'Root market was not found');
    }

    const outcome = market.outcomes.find((item) => item.id === rootOutcomeId);
    if (!outcome) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'OUTCOME_NOT_FOUND', 'Root outcome was not found in the root market');
    }

    return { market, outcome };
  }

  private async loadCandidateMarkets(
    rootMarket: LoadedRootMarket['market'],
    dto: CreateInferenceRunDto,
  ): Promise<InferenceMarketInput[]> {
    const promptLimit = resolveCandidatePromptLimit(dto);
    const rootTags = stringTags(rootMarket.event?.tags);
    const rootTerms = extractSearchTerms([
      rootMarket.question,
      rootMarket.description,
      rootMarket.rules,
      rootMarket.event?.title,
    ]);
    const baseWhere = {
      id: { not: rootMarket.id },
      active: true,
      closed: false,
      archived: false,
      staleDetectedAt: null,
      outcomes: {
        some: {},
      },
    } satisfies Prisma.PolymarketMarketWhereInput;

    const querySpecs: Prisma.PolymarketMarketWhereInput[] = [];
    if (rootMarket.eventId) {
      querySpecs.push({ eventId: rootMarket.eventId });
    }
    const tagWhere = buildTagOverlapWhere(rootTags);
    if (tagWhere) {
      querySpecs.push(tagWhere);
    }
    const textWhere = buildTextOverlapWhere(rootTerms);
    if (textWhere) {
      querySpecs.push(textWhere);
    }
    querySpecs.push({});

    const batches = await Promise.all(
      querySpecs.map((where) =>
        this.prisma.polymarketMarket.findMany({
          where: {
            AND: [baseWhere, where],
          },
          include: CANDIDATE_MARKET_INCLUDE,
          orderBy: CANDIDATE_MARKET_ORDER_BY,
          take: promptLimit,
        }),
      ),
    );

    const marketsById = new Map<string, CandidateMarketRecord>();
    for (const market of batches.flat()) {
      marketsById.set(market.id, market);
    }

    const rootContext = buildRootMarketContext(rootMarket, rootTags, rootTerms);
    return selectPromptCandidateMarkets([...marketsById.values()], rootContext, promptLimit, dto.maxMarketsPerLayer).map(
      formatMarketInput,
    );
  }
}

type LoadedRootMarket = {
  market: Prisma.PolymarketMarketGetPayload<{
    include: {
      event: true;
      outcomes: true;
    };
  }>;
  outcome: Prisma.PolymarketOutcomeGetPayload<Record<string, never>>;
};

type ResolvedInferenceOutput = {
  validatedOutput: AiInferenceOutput;
  cacheHit: boolean;
  audit: InferenceRunAudit;
};

type InferenceRunAudit = {
  source: 'cache' | 'mock' | 'provider';
  attempts: InferenceProviderAttemptAudit[];
};

type InferenceProviderAttemptAudit = {
  attempt: 'initial' | 'repair';
  rawContentPreview: string;
  rawContentLength: number;
  rawContentHash: string;
  parseError?: string;
  validationError?: string;
};

class InferenceProviderOutputError extends ApiException {
  readonly audit: InferenceRunAudit;

  constructor(message: string, attempts: InferenceProviderAttemptAudit[]) {
    const audit: InferenceRunAudit = {
      source: 'provider',
      attempts,
    };
    super(HttpStatus.UNPROCESSABLE_ENTITY, 'INFERENCE_FAILED', message, { attempts });
    this.name = 'InferenceProviderOutputError';
    this.audit = audit;
  }
}

type ProviderAttemptResult =
  | {
      ok: true;
      output: AiInferenceOutput;
      audit: InferenceProviderAttemptAudit;
    }
  | {
      ok: false;
      errorMessage: string;
      previousOutput: unknown;
      audit: InferenceProviderAttemptAudit;
    };

function parseAndValidateProviderContent(
  attempt: 'initial' | 'repair',
  content: string,
  promptInput: InferencePromptInput,
): ProviderAttemptResult {
  const audit = buildProviderAttemptAudit(attempt, content);
  const parsed = parseProviderJsonContent(content);
  if (!parsed.ok) {
    return {
      ok: false,
      errorMessage: parsed.errorMessage,
      previousOutput: content,
      audit: {
        ...audit,
        parseError: parsed.errorMessage,
      },
    };
  }

  try {
    return {
      ok: true,
      output: validateAiInferenceOutput(parsed.value, promptInput),
      audit,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errorMessage,
      previousOutput: parsed.value,
      audit: {
        ...audit,
        validationError: errorMessage,
      },
    };
  }
}

function parseProviderJsonContent(content: string): { ok: true; value: unknown } | { ok: false; errorMessage: string } {
  try {
    return { ok: true, value: JSON.parse(content) };
  } catch (error) {
    return {
      ok: false,
      errorMessage: `AI provider returned invalid JSON output: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function buildProviderAttemptAudit(attempt: 'initial' | 'repair', content: string): InferenceProviderAttemptAudit {
  return {
    attempt,
    rawContentPreview: content.slice(0, MAX_AI_RAW_CONTENT_AUDIT_CHARS),
    rawContentLength: content.length,
    rawContentHash: hashJson(content),
  };
}

function buildInferenceRunOutputJson(output: AiInferenceOutput, audit: InferenceRunAudit): unknown {
  return {
    result: output,
    audit,
  };
}

function buildFailureInferenceRunOutputJson(error: unknown): Prisma.InputJsonValue | undefined {
  if (!(error instanceof InferenceProviderOutputError)) return undefined;
  return toJson({
    result: null,
    audit: error.audit,
    failure: {
      errorMessage: error.message,
    },
  });
}

function errorMessageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type CandidateMarketRecord = Prisma.PolymarketMarketGetPayload<{
  include: typeof CANDIDATE_MARKET_INCLUDE;
}>;

type RootMarketContext = {
  eventId: string | null;
  category: string | null;
  tags: Set<string>;
  terms: Set<string>;
};

function resolveCandidatePromptLimit(dto: CreateInferenceRunDto): number {
  const requestedOutputSize = dto.depth * dto.maxMarketsPerLayer;
  return clampNumber(
    Math.max(requestedOutputSize * 5, dto.maxMarketsPerLayer * 4, MIN_INFERENCE_CANDIDATE_MARKETS),
    MIN_INFERENCE_CANDIDATE_MARKETS,
    MAX_INFERENCE_CANDIDATE_MARKETS,
  );
}

function buildRootMarketContext(rootMarket: LoadedRootMarket['market'], rootTags: string[], rootTerms: string[]): RootMarketContext {
  return {
    eventId: rootMarket.eventId,
    category: firstStringTag(rootMarket.event?.tags),
    tags: new Set(rootTags.map(normalizeToken).filter(Boolean)),
    terms: new Set(rootTerms),
  };
}

function buildTagOverlapWhere(tags: string[]): Prisma.PolymarketMarketWhereInput | null {
  const normalizedTags = Array.from(new Set(tags.map(normalizeToken).filter(Boolean))).slice(0, 8);
  if (normalizedTags.length === 0) return null;
  return {
    OR: normalizedTags.map((tag) => ({
      event: {
        is: {
          tags: {
            array_contains: [tag],
          },
        },
      },
    })),
  };
}

function buildTextOverlapWhere(terms: string[]): Prisma.PolymarketMarketWhereInput | null {
  const selectedTerms = terms.slice(0, MAX_INFERENCE_TEXT_TERMS);
  if (selectedTerms.length === 0) return null;
  return {
    OR: selectedTerms.flatMap((term) => [
      { question: { contains: term, mode: 'insensitive' as const } },
      { description: { contains: term, mode: 'insensitive' as const } },
      { rules: { contains: term, mode: 'insensitive' as const } },
      {
        event: {
          is: {
            title: { contains: term, mode: 'insensitive' as const },
          },
        },
      },
    ]),
  };
}

function selectPromptCandidateMarkets(
  markets: CandidateMarketRecord[],
  rootContext: RootMarketContext,
  limit: number,
  maxMarketsPerLayer: number,
): CandidateMarketRecord[] {
  const scored = markets
    .map((market) => ({
      market,
      score: scoreCandidateMarket(market, rootContext),
    }))
    .sort((left, right) => compareScoredCandidate(left, right));

  const selected: CandidateMarketRecord[] = [];
  const eventCounts = new Map<string, number>();
  const rootEventLimit = Math.max(maxMarketsPerLayer * 4, 20);
  const otherEventLimit = Math.max(maxMarketsPerLayer * 2, 8);
  for (const candidate of scored) {
    if (selected.length >= limit) break;
    const eventKey = candidate.market.eventId ?? candidate.market.id;
    const eventLimit = rootContext.eventId && candidate.market.eventId === rootContext.eventId ? rootEventLimit : otherEventLimit;
    if ((eventCounts.get(eventKey) ?? 0) >= eventLimit) continue;
    selected.push(candidate.market);
    eventCounts.set(eventKey, (eventCounts.get(eventKey) ?? 0) + 1);
  }

  for (const candidate of scored) {
    if (selected.length >= limit) break;
    if (selected.some((market) => market.id === candidate.market.id)) continue;
    selected.push(candidate.market);
  }

  return selected;
}

function scoreCandidateMarket(market: CandidateMarketRecord, rootContext: RootMarketContext): number {
  const marketTags = stringTags(market.event?.tags).map(normalizeToken).filter(Boolean);
  const marketText = normalizeToken(
    [market.question, market.description, market.rules, market.event?.title].filter(Boolean).join(' '),
  );
  const tagOverlap = marketTags.filter((tag) => rootContext.tags.has(tag)).length;
  const termOverlap = [...rootContext.terms].filter((term) => marketText.includes(term)).length;
  const category = firstStringTag(market.event?.tags);
  const sameEventScore = rootContext.eventId && market.eventId === rootContext.eventId ? 100 : 0;
  const categoryScore = category && category === rootContext.category ? 14 : 0;
  const tradableScore = (market.acceptingOrders ? 8 : 0) + (market.enableOrderBook ? 6 : 0);
  const priceScore = firstNumber(market.bestAsk, market.bestBid, market.lastTradePrice) == null ? 0 : 4;
  const endDateScore = scoreEndDate(market.endDate);
  return (
    sameEventScore
    + categoryScore
    + Math.min(tagOverlap, 4) * 18
    + Math.min(termOverlap, 5) * 10
    + tradableScore
    + priceScore
    + endDateScore
    + Math.log1p(positiveNumber(market.volume24hr)) * 5
    + Math.log1p(positiveNumber(market.liquidity)) * 2
    + Math.log1p(positiveNumber(market.volume)) * 1.5
  );
}

function compareScoredCandidate(
  left: { market: CandidateMarketRecord; score: number },
  right: { market: CandidateMarketRecord; score: number },
): number {
  if (right.score !== left.score) return right.score - left.score;
  const rightVolume24hr = positiveNumber(right.market.volume24hr);
  const leftVolume24hr = positiveNumber(left.market.volume24hr);
  if (rightVolume24hr !== leftVolume24hr) return rightVolume24hr - leftVolume24hr;
  const rightVolume = positiveNumber(right.market.volume);
  const leftVolume = positiveNumber(left.market.volume);
  if (rightVolume !== leftVolume) return rightVolume - leftVolume;
  return left.market.id.localeCompare(right.market.id);
}

function buildPromptInput(
  root: LoadedRootMarket,
  candidateMarkets: InferenceMarketInput[],
  dto: CreateInferenceRunDto,
): InferencePromptInput {
  return {
    root: {
      marketId: root.market.id,
      marketQuestion: normalizePromptText(root.market.question) ?? root.market.question,
      selectedOutcome: {
        outcomeId: root.outcome.id,
        label: normalizePromptText(root.outcome.label, 160) ?? root.outcome.label,
        tokenId: root.outcome.clobTokenId,
        price: toNullableNumber(root.outcome.price),
        bestBid: toNullableNumber(root.outcome.bestBid),
        bestAsk: toNullableNumber(root.outcome.bestAsk),
        lastTradePrice: toNullableNumber(root.outcome.lastTradePrice),
      },
    },
    settings: {
      depth: dto.depth,
      maxMarketsPerLayer: dto.maxMarketsPerLayer,
      confidenceThreshold: dto.confidenceThreshold,
    },
    candidateMarkets,
  };
}

function fitPromptInputToBudget(input: InferencePromptInput): InferencePromptInput {
  let candidateLimit = input.candidateMarkets.length;
  let textLimit = MAX_PROMPT_TEXT_LENGTH;
  let fitted = compactPromptInput(input, candidateLimit, textLimit);
  let estimatedPromptChars = estimateMaxPromptChars(fitted);
  const minimumCandidateLimit = Math.min(
    input.candidateMarkets.length,
    Math.max(input.settings.depth * input.settings.maxMarketsPerLayer, input.settings.maxMarketsPerLayer),
  );

  while (estimatedPromptChars > MAX_INFERENCE_PROMPT_INPUT_CHARS && candidateLimit > minimumCandidateLimit) {
    candidateLimit = Math.max(minimumCandidateLimit, Math.floor(candidateLimit * 0.85));
    fitted = compactPromptInput(input, candidateLimit, textLimit);
    estimatedPromptChars = estimateMaxPromptChars(fitted);
  }

  while (estimatedPromptChars > MAX_INFERENCE_PROMPT_INPUT_CHARS && textLimit > MIN_PROMPT_TEXT_LENGTH) {
    textLimit = Math.max(MIN_PROMPT_TEXT_LENGTH, Math.floor(textLimit * 0.7));
    fitted = compactPromptInput(input, candidateLimit, textLimit);
    estimatedPromptChars = estimateMaxPromptChars(fitted);
  }

  while (estimatedPromptChars > MAX_INFERENCE_PROMPT_INPUT_CHARS && candidateLimit > 0) {
    const nextCandidateLimit = Math.max(0, Math.floor(candidateLimit * 0.8));
    candidateLimit = nextCandidateLimit === candidateLimit ? candidateLimit - 1 : nextCandidateLimit;
    fitted = compactPromptInput(input, candidateLimit, textLimit);
    estimatedPromptChars = estimateMaxPromptChars(fitted);
  }

  if (estimatedPromptChars > MAX_INFERENCE_PROMPT_INPUT_CHARS) {
    fitted = compactPromptInputForEmergency(input, 0);
    estimatedPromptChars = estimateMaxPromptChars(fitted);
  }

  if (estimatedPromptChars > MAX_INFERENCE_PROMPT_INPUT_CHARS) {
    throw new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'INFERENCE_INPUT_TOO_LARGE',
      'Inference prompt input exceeds the configured provider prompt budget after compaction',
      {
        promptChars: estimatedPromptChars,
        maxPromptChars: MAX_INFERENCE_PROMPT_INPUT_CHARS,
      },
    );
  }

  return fitted;
}

function estimateMaxPromptChars(input: InferencePromptInput): number {
  return Math.max(
    estimatePromptChars(input),
    estimatePromptChars(input, {
      previousOutput: 'x'.repeat(MAX_INFERENCE_REPAIR_PREVIOUS_OUTPUT_CHARS),
      validationError: 'x'.repeat(MAX_INFERENCE_REPAIR_VALIDATION_ERROR_CHARS),
    }),
  );
}

function estimatePromptChars(input: InferencePromptInput, repairContext?: InferencePromptRepairContext): number {
  const prompt = buildInferenceAiPrompt(input, repairContext);
  return prompt.systemPrompt.length + JSON.stringify(prompt.userPayload).length;
}

function compactPromptInput(input: InferencePromptInput, candidateLimit: number, textLimit: number): InferencePromptInput {
  return {
    root: {
      ...input.root,
      marketQuestion: normalizePromptText(input.root.marketQuestion, textLimit) ?? input.root.marketQuestion,
      selectedOutcome: {
        ...input.root.selectedOutcome,
        label: normalizePromptText(input.root.selectedOutcome.label, 160) ?? input.root.selectedOutcome.label,
      },
    },
    settings: input.settings,
    candidateMarkets: input.candidateMarkets.slice(0, candidateLimit).map((market) => ({
      ...market,
      eventTitle: normalizePromptText(market.eventTitle, Math.min(textLimit, 320)),
      question: normalizePromptText(market.question, textLimit) ?? market.question,
      description: normalizePromptText(market.description, textLimit),
      rules: normalizePromptText(market.rules, textLimit),
      tags: market.tags.slice(0, 12),
      outcomes: market.outcomes.map((outcome) => ({
        ...outcome,
        label: normalizePromptText(outcome.label, 160) ?? outcome.label,
      })),
    })),
  };
}

function compactPromptInputForEmergency(input: InferencePromptInput, candidateLimit: number): InferencePromptInput {
  return {
    root: {
      ...input.root,
      marketQuestion: normalizePromptText(input.root.marketQuestion, EMERGENCY_PROMPT_TEXT_LENGTH) ?? input.root.marketId,
      selectedOutcome: {
        ...input.root.selectedOutcome,
        label:
          normalizePromptText(input.root.selectedOutcome.label, EMERGENCY_PROMPT_OUTCOME_LABEL_LENGTH)
          ?? input.root.selectedOutcome.outcomeId,
      },
    },
    settings: input.settings,
    candidateMarkets: input.candidateMarkets.slice(0, candidateLimit).map((market) => ({
      ...market,
      eventTitle: normalizePromptText(market.eventTitle, EMERGENCY_PROMPT_EVENT_TEXT_LENGTH),
      question: normalizePromptText(market.question, EMERGENCY_PROMPT_TEXT_LENGTH) ?? market.marketId,
      description: null,
      rules: null,
      category: normalizePromptText(market.category, EMERGENCY_PROMPT_EVENT_TEXT_LENGTH),
      tags: [],
      outcomes: market.outcomes.map((outcome) => ({
        ...outcome,
        label: normalizePromptText(outcome.label, EMERGENCY_PROMPT_OUTCOME_LABEL_LENGTH) ?? outcome.outcomeId,
      })),
    })),
  };
}

function dtoFromRun(run: {
  rootMarketId: string;
  rootOutcomeId: string;
  depth: number;
  maxMarketsPerLayer: number;
  confidenceThreshold: unknown;
  model: string;
  cacheEnabled: boolean;
}): CreateInferenceRunDto {
  const confidenceThreshold = toNullableNumber(run.confidenceThreshold);
  if (confidenceThreshold == null) {
    throw new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'INFERENCE_FAILED',
      'Stored inference run confidenceThreshold is invalid',
    );
  }

  return {
    rootMarketId: run.rootMarketId,
    rootOutcomeId: run.rootOutcomeId,
    depth: run.depth,
    maxMarketsPerLayer: run.maxMarketsPerLayer,
    confidenceThreshold,
    model: run.model,
    cacheEnabled: run.cacheEnabled,
  };
}

function readStoredPromptInput(value: unknown): InferencePromptInput {
  const input = readRecord(value, 'inputJson');
  const root = readRecord(input.root, 'inputJson.root');
  const settings = readRecord(input.settings, 'inputJson.settings');
  const selectedOutcome = readInferenceOutcome(root.selectedOutcome, 'inputJson.root.selectedOutcome');
  const candidateMarketsValue = input.candidateMarkets;
  if (!Array.isArray(candidateMarketsValue)) {
    throw storedInputError('inputJson.candidateMarkets must be an array');
  }

  return {
    root: {
      marketId: readRequiredString(root.marketId, 'inputJson.root.marketId'),
      marketQuestion: readRequiredString(root.marketQuestion, 'inputJson.root.marketQuestion'),
      selectedOutcome,
    },
    settings: {
      depth: readRequiredNumber(settings.depth, 'inputJson.settings.depth'),
      maxMarketsPerLayer: readRequiredNumber(settings.maxMarketsPerLayer, 'inputJson.settings.maxMarketsPerLayer'),
      confidenceThreshold: readRequiredNumber(settings.confidenceThreshold, 'inputJson.settings.confidenceThreshold'),
    },
    candidateMarkets: candidateMarketsValue.map((market, index) =>
      readInferenceMarket(market, `inputJson.candidateMarkets.${index}`),
    ),
  };
}

function readInferenceMarket(value: unknown, path: string): InferenceMarketInput {
  const market = readRecord(value, path);
  const outcomes = market.outcomes;
  if (!Array.isArray(outcomes)) {
    throw storedInputError(`${path}.outcomes must be an array`);
  }

  return {
    marketId: readRequiredString(market.marketId, `${path}.marketId`),
    eventTitle: readNullableString(market.eventTitle, `${path}.eventTitle`),
    question: readRequiredString(market.question, `${path}.question`),
    description: readNullableString(market.description, `${path}.description`),
    rules: readNullableString(market.rules, `${path}.rules`),
    category: readNullableString(market.category, `${path}.category`),
    tags: readStringArray(market.tags, `${path}.tags`),
    active: readRequiredBoolean(market.active, `${path}.active`),
    closed: readRequiredBoolean(market.closed, `${path}.closed`),
    acceptingOrders: readRequiredBoolean(market.acceptingOrders, `${path}.acceptingOrders`),
    enableOrderBook: readOptionalBoolean(market.enableOrderBook, false),
    orderMinSize: readNullableNumber(market.orderMinSize, `${path}.orderMinSize`),
    orderPriceMinTickSize: readNullableNumber(market.orderPriceMinTickSize, `${path}.orderPriceMinTickSize`),
    bestBid: readNullableNumber(market.bestBid, `${path}.bestBid`),
    bestAsk: readNullableNumber(market.bestAsk, `${path}.bestAsk`),
    lastTradePrice: readNullableNumber(market.lastTradePrice, `${path}.lastTradePrice`),
    spread: readNullableNumber(market.spread, `${path}.spread`),
    volume: readNullableNumber(market.volume, `${path}.volume`),
    volume24hr: readNullableNumber(market.volume24hr, `${path}.volume24hr`),
    liquidity: readNullableNumber(market.liquidity, `${path}.liquidity`),
    endDate: readNullableString(market.endDate, `${path}.endDate`),
    outcomes: outcomes.map((outcome, index) => readInferenceOutcome(outcome, `${path}.outcomes.${index}`)),
  };
}

function readInferenceOutcome(value: unknown, path: string) {
  const outcome = readRecord(value, path);
  return {
    outcomeId: readRequiredString(outcome.outcomeId, `${path}.outcomeId`),
    label: readRequiredString(outcome.label, `${path}.label`),
    tokenId: readRequiredString(outcome.tokenId, `${path}.tokenId`),
    price: readNullableNumber(outcome.price, `${path}.price`),
    bestBid: readNullableNumber(outcome.bestBid, `${path}.bestBid`),
    bestAsk: readNullableNumber(outcome.bestAsk, `${path}.bestAsk`),
    lastTradePrice: readNullableNumber(outcome.lastTradePrice, `${path}.lastTradePrice`),
  };
}

function formatMarketInput(
  market: Prisma.PolymarketMarketGetPayload<{
    include: typeof CANDIDATE_MARKET_INCLUDE;
  }>,
): InferenceMarketInput {
  return {
    marketId: market.id,
    eventTitle: normalizePromptText(market.event?.title ?? null),
    question: normalizePromptText(market.question) ?? market.question,
    description: normalizePromptText(market.description),
    rules: normalizePromptText(market.rules),
    category: firstStringTag(market.event?.tags),
    tags: stringTags(market.event?.tags).slice(0, 16),
    active: market.active,
    closed: market.closed,
    acceptingOrders: market.acceptingOrders,
    enableOrderBook: market.enableOrderBook,
    orderMinSize: toNullableNumber(market.orderMinSize),
    orderPriceMinTickSize: toNullableNumber(market.orderPriceMinTickSize),
    bestBid: toNullableNumber(market.bestBid),
    bestAsk: toNullableNumber(market.bestAsk),
    lastTradePrice: toNullableNumber(market.lastTradePrice),
    spread: toNullableNumber(market.spread),
    volume: toNullableNumber(market.volume),
    volume24hr: toNullableNumber(market.volume24hr),
    liquidity: toNullableNumber(market.liquidity),
    endDate: market.endDate?.toISOString() ?? null,
    outcomes: market.outcomes.map((outcome) => ({
      outcomeId: outcome.id,
      label: normalizePromptText(outcome.label, 160) ?? outcome.label,
      tokenId: outcome.clobTokenId,
      price: toNullableNumber(outcome.price),
      bestBid: toNullableNumber(outcome.bestBid),
      bestAsk: toNullableNumber(outcome.bestAsk),
      lastTradePrice: toNullableNumber(outcome.lastTradePrice),
    })),
  };
}

function buildGraphJson(output: AiInferenceOutput, root: LoadedRootMarket) {
  return {
    root: {
      marketId: root.market.id,
      outcomeId: root.outcome.id,
      outcomeLabel: root.outcome.label,
    },
    nodes: output.nodes.map((node) => ({
      nodeId: node.clientNodeId,
      marketId: node.marketId,
      layer: node.layer,
      confidence: node.confidence,
      direction: node.impactDirection,
      recommendedOutcomes: node.outcomes
        .filter((outcome) => outcome.aiAction === 'buy')
        .map((outcome) => ({
          outcomeId: outcome.outcomeId,
          label: outcome.outcomeLabel,
        })),
    })),
    edges: output.edges.map((edge) => ({
      sourceNodeId: edge.sourceClientNodeId,
      targetNodeId: edge.targetClientNodeId,
      sourceOutcomeId: edge.sourceOutcomeId,
      targetOutcomeId: edge.targetOutcomeId,
      relation: edge.relation,
      confidence: edge.confidence,
      reason: edge.reason,
    })),
    warnings: output.warnings,
  };
}

function resolveParentScriptMarketId(
  node: AiMarketNode,
  edges: AiInferenceOutput['edges'],
  scriptMarketIdByNodeId: Map<string, string>,
): string | null {
  if (node.layer === 0) return null;
  const parentEdge = edges.find((edge) => edge.targetClientNodeId === node.clientNodeId);
  if (!parentEdge) return null;
  return scriptMarketIdByNodeId.get(parentEdge.sourceClientNodeId) ?? null;
}

function resolveOutcomePrice(outcome: OutcomePriceFields | null | undefined): string | null {
  const price = toNullableNumber(outcome?.bestAsk) ?? toNullableNumber(outcome?.price) ?? toNullableNumber(outcome?.lastTradePrice);
  return price == null ? null : String(price);
}

function collectBuyOutcomeIds(output: AiInferenceOutput): string[] {
  const ids = new Set<string>();
  for (const node of output.nodes) {
    for (const outcome of node.outcomes) {
      if (outcome.aiAction === 'buy') ids.add(outcome.outcomeId);
    }
  }
  return [...ids];
}

function countIncomingEdgesByTarget(edges: AiInferenceOutput['edges']): Map<string, number> {
  const countByTarget = new Map<string, number>();
  for (const edge of edges) {
    countByTarget.set(edge.targetClientNodeId, (countByTarget.get(edge.targetClientNodeId) ?? 0) + 1);
  }
  return countByTarget;
}

function requireScriptMarketId(scriptMarketIdByNodeId: Map<string, string>, clientNodeId: string): string {
  const id = scriptMarketIdByNodeId.get(clientNodeId);
  if (!id) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'INFERENCE_FAILED', `Missing generated script market id for ${clientNodeId}`);
  }
  return id;
}

type OutcomePriceFields = {
  bestAsk: unknown;
  price: unknown;
  lastTradePrice: unknown;
};

function stringTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function firstStringTag(value: unknown): string | null {
  return stringTags(value)[0] ?? null;
}

function normalizePromptText(value: string | null | undefined, maxLength = MAX_PROMPT_TEXT_LENGTH): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function extractSearchTerms(values: Array<string | null | undefined>): string[] {
  const stopWords = new Set([
    'about',
    'after',
    'before',
    'become',
    'causeway',
    'during',
    'event',
    'from',
    'have',
    'market',
    'over',
    'polymarket',
    'that',
    'this',
    'under',
    'what',
    'when',
    'will',
    'with',
    'would',
  ]);
  const terms = new Set<string>();
  for (const value of values) {
    const normalized = normalizeToken(value ?? '');
    for (const term of normalized.split(' ')) {
      if (term.length < 4 || stopWords.has(term) || /^\d+$/.test(term)) continue;
      terms.add(term);
      if (terms.size >= MAX_INFERENCE_TEXT_TERMS) return [...terms];
    }
  }
  return [...terms];
}

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreEndDate(value: Date | null): number {
  if (!value) return 0;
  const timeUntilEnd = value.getTime() - Date.now();
  if (timeUntilEnd < 0) return -20;
  const daysUntilEnd = timeUntilEnd / (24 * 60 * 60 * 1_000);
  if (daysUntilEnd <= 1) return -6;
  if (daysUntilEnd <= 7) return 2;
  return 4;
}

function positiveNumber(value: unknown): number {
  const parsed = toNullableNumber(value);
  return parsed == null || parsed <= 0 ? 0 : parsed;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toNullableNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw storedInputError(`${path} must be an object`);
}

function readRequiredString(value: unknown, path: string): string {
  if (typeof value === 'string' && value.trim()) return value;
  throw storedInputError(`${path} must be a non-empty string`);
}

function readNullableString(value: unknown, path: string): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  throw storedInputError(`${path} must be a string or null`);
}

function readRequiredNumber(value: unknown, path: string): number {
  const parsed = toNullableNumber(value);
  if (parsed != null) return parsed;
  throw storedInputError(`${path} must be a number`);
}

function readNullableNumber(value: unknown, path: string): number | null {
  if (value == null) return null;
  const parsed = toNullableNumber(value);
  if (parsed != null) return parsed;
  throw storedInputError(`${path} must be a number or null`);
}

function readRequiredBoolean(value: unknown, path: string): boolean {
  if (typeof value === 'boolean') return value;
  throw storedInputError(`${path} must be a boolean`);
}

function readOptionalBoolean(value: unknown, fallback: boolean): boolean {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  return fallback;
}

function readStringArray(value: unknown, path: string): string[] {
  if (!isStringArray(value)) {
    throw storedInputError(`${path} must be a string array`);
  }
  return value;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function storedInputError(message: string): ApiException {
  return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'INFERENCE_FAILED', `Stored inference input is invalid: ${message}`);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
