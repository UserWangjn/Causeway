import { HttpStatus, Inject, Injectable } from '@nestjs/common';
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
import type { AiInferenceOutput, AiMarketNode, InferenceMarketInput, InferencePromptInput } from './inference.types';

@Injectable()
export class InferenceService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AiClientService)
    private readonly aiClient: AiClientService,
  ) {}

  async createRun(user: CurrentUser, dto: CreateInferenceRunDto) {
    if (dto.model !== MOCK_INFERENCE_MODEL) {
      const capability = this.aiClient.getCapability();
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'CAPABILITY_UNAVAILABLE',
        capability.reason ?? 'AI inference client is unavailable',
      );
    }

    const root = await this.loadRootMarket(dto.rootMarketId, dto.rootOutcomeId);
    const candidateMarkets = await this.loadCandidateMarkets(root.market.id, root.market.eventId, dto);
    const promptInput = buildPromptInput(root, candidateMarkets, dto);
    const cacheKey = buildInferenceCacheKey({
      rootMarketId: dto.rootMarketId,
      rootOutcomeId: dto.rootOutcomeId,
      depth: dto.depth,
      maxMarketsPerLayer: dto.maxMarketsPerLayer,
      confidenceThreshold: dto.confidenceThreshold,
      candidateMarkets,
      model: dto.model,
    });
    const inputJson = toJson({
      ...promptInput,
      model: dto.model,
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
        depth: dto.depth,
        maxMarketsPerLayer: dto.maxMarketsPerLayer,
        confidenceThreshold: dto.confidenceThreshold,
        model: dto.model,
        promptVersion: INFERENCE_PROMPT_VERSION,
        outputSchemaVersion: INFERENCE_OUTPUT_SCHEMA_VERSION,
        cacheEnabled: dto.cacheEnabled ?? true,
        cacheKey,
        status: 'queued',
        stage: 'candidate_retrieval',
        progress: 0,
        inputJson,
      },
    });

    return this.processRun(run.id, user.id, user.requestId, dto, root, promptInput, cacheKey);
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
    try {
      await this.prisma.inferenceRun.update({
        where: { id: runId },
        data: {
          status: 'running',
          stage: 'ai_reasoning',
          progress: 30,
        },
      });
      const { output, cacheHit } = await this.resolveInferenceOutput(dto, promptInput, cacheKey);
      await this.prisma.inferenceRun.update({
        where: { id: runId },
        data: {
          stage: 'outcome_mapping',
          progress: 60,
          outputJson: toJson(output),
        },
      });
      const validatedOutput = validateAiInferenceOutput(output, promptInput);
      if (!cacheHit) {
        await this.storeInferenceCache(dto, promptInput, cacheKey, validatedOutput);
      }

      const script = await this.persistScript(userId, requestId, runId, root, validatedOutput);
      await this.prisma.inferenceRun.update({
        where: { id: runId },
        data: {
          status: 'completed',
          stage: 'script_generation',
          progress: 100,
          cacheHit,
          outputJson: toJson(validatedOutput),
          completedAt: new Date(),
        },
      });

      return {
        runId,
        status: 'completed',
        cacheKey,
        cacheHit,
        scriptId: script.id,
      };
    } catch (error) {
      await this.prisma.inferenceRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          progress: 100,
          errorMessage: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      });
      throw error;
    }
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
  ): Promise<{ output: unknown; cacheHit: boolean }> {
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
        return {
          output: cached.resultJson,
          cacheHit: true,
        };
      }
    }

    const output =
      dto.model === MOCK_INFERENCE_MODEL
        ? buildMockInferenceOutput(promptInput)
        : await this.aiClient.runStructuredInference<AiInferenceOutput>(promptInput);
    return { output, cacheHit: false };
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

      const scriptMarketIdByNodeId = new Map<string, string>();
      for (const node of output.nodes) {
        const scriptMarket = await tx.scriptMarket.create({
          data: {
            scriptId: script.id,
            marketId: node.marketId,
            layer: node.layer,
            impactDirection: node.impactDirection,
            confidence: node.confidence,
            reason: node.reason,
            metadata: toJson({
              clientNodeId: node.clientNodeId,
              edgeCount: output.edges.filter((edge) => edge.targetClientNodeId === node.clientNodeId).length,
            }),
          },
        });
        scriptMarketIdByNodeId.set(node.clientNodeId, scriptMarket.id);

        for (const recommendation of node.outcomes) {
          await tx.scriptOutcomeSelection.create({
            data: {
              scriptMarketId: scriptMarket.id,
              outcomeId: recommendation.outcomeId,
              aiAction: recommendation.aiAction,
              userAction: recommendation.aiAction === 'buy' ? 'buy' : 'skip',
              orderMode: 'limit',
              limitPrice: recommendation.aiAction === 'buy' ? await resolveOutcomePrice(tx, recommendation.outcomeId) : null,
              amountUsd: recommendation.aiAction === 'buy' ? '10' : '0',
              confidence: recommendation.confidence,
              reason: recommendation.reason,
            },
          });
        }
      }

      for (const node of output.nodes) {
        const scriptMarketId = scriptMarketIdByNodeId.get(node.clientNodeId);
        const parentScriptMarketId = resolveParentScriptMarketId(node, output.edges, scriptMarketIdByNodeId);
        if (!scriptMarketId || !parentScriptMarketId) continue;
        await tx.scriptMarket.update({
          where: { id: scriptMarketId },
          data: { parentScriptMarketId },
        });
      }

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
    });
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
    rootMarketId: string,
    rootEventId: string | null,
    dto: CreateInferenceRunDto,
  ): Promise<InferenceMarketInput[]> {
    const take = Math.max(dto.depth * dto.maxMarketsPerLayer * 4, dto.maxMarketsPerLayer);
    const markets = await this.prisma.polymarketMarket.findMany({
      where: {
        id: { not: rootMarketId },
        active: true,
        closed: false,
        outcomes: {
          some: {},
        },
      },
      include: {
        event: true,
        outcomes: {
          orderBy: { outcomeIndex: 'asc' },
        },
      },
      orderBy: [{ volume24hr: 'desc' }, { volume: 'desc' }, { id: 'asc' }],
      take,
    });

    return markets
      .sort((left, right) => {
        const leftEventRank = left.eventId && left.eventId === rootEventId ? 0 : 1;
        const rightEventRank = right.eventId && right.eventId === rootEventId ? 0 : 1;
        if (leftEventRank !== rightEventRank) return leftEventRank - rightEventRank;
        return left.id.localeCompare(right.id);
      })
      .map(formatMarketInput);
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

function buildPromptInput(
  root: LoadedRootMarket,
  candidateMarkets: InferenceMarketInput[],
  dto: CreateInferenceRunDto,
): InferencePromptInput {
  return {
    root: {
      marketId: root.market.id,
      marketQuestion: root.market.question,
      selectedOutcome: {
        outcomeId: root.outcome.id,
        label: root.outcome.label,
        tokenId: root.outcome.clobTokenId,
        price: toNullableNumber(root.outcome.price),
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

function formatMarketInput(
  market: Prisma.PolymarketMarketGetPayload<{
    include: {
      event: true;
      outcomes: true;
    };
  }>,
): InferenceMarketInput {
  return {
    marketId: market.id,
    eventTitle: market.event?.title ?? null,
    question: market.question,
    description: market.description,
    rules: market.rules,
    category: firstStringTag(market.event?.tags),
    tags: stringTags(market.event?.tags),
    active: market.active,
    closed: market.closed,
    acceptingOrders: market.acceptingOrders,
    volume: toNullableNumber(market.volume),
    liquidity: toNullableNumber(market.liquidity),
    outcomes: market.outcomes.map((outcome) => ({
      outcomeId: outcome.id,
      label: outcome.label,
      tokenId: outcome.clobTokenId,
      price: toNullableNumber(outcome.price),
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

async function resolveOutcomePrice(tx: Prisma.TransactionClient, outcomeId: string): Promise<string | null> {
  const outcome = await tx.polymarketOutcome.findUnique({
    where: { id: outcomeId },
    select: { price: true, bestAsk: true, lastTradePrice: true },
  });
  const price = toNullableNumber(outcome?.bestAsk) ?? toNullableNumber(outcome?.price) ?? toNullableNumber(outcome?.lastTradePrice);
  return price == null ? null : String(price);
}

function stringTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function firstStringTag(value: unknown): string | null {
  return stringTags(value)[0] ?? null;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
