import { HttpStatus, Injectable } from '@nestjs/common';
import { OrderMode, Prisma, UserSelectionAction } from '@prisma/client';
import { ApiException } from '../../common/errors/api.exception';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { toNullableNumber } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';
import { UpdateOutcomeSelectionDto } from './dto/update-outcome-selection.dto';

@Injectable()
export class ScriptsService {
  constructor(private readonly prisma: PrismaService) {}

  async getScript(user: CurrentUser, scriptId: string) {
    const script = await this.prisma.causalScript.findFirst({
      where: { id: scriptId, userId: user.id },
      include: {
        markets: {
          orderBy: [{ layer: 'asc' }, { createdAt: 'asc' }],
          include: {
            market: {
              include: {
                outcomes: {
                  orderBy: { outcomeIndex: 'asc' },
                },
              },
            },
            selections: {
              orderBy: { outcomeId: 'asc' },
              include: {
                outcome: true,
              },
            },
          },
        },
      },
    });
    if (!script) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'REQUEST_FAILED', 'Causal script was not found');
    }
    const graph = formatScriptGraph(script.graphJson, script.rootMarketId, script.rootOutcomeId, script.markets);

    return {
      id: script.id,
      title: script.title,
      status: script.status,
      root: graph.root,
      graph: {
        nodes: graph.nodes,
        edges: graph.edges,
      },
      summary: script.summary,
      createdAt: script.createdAt.toISOString(),
      updatedAt: script.updatedAt.toISOString(),
      markets: script.markets.map((scriptMarket) => ({
        scriptMarketId: scriptMarket.id,
        marketId: scriptMarket.marketId,
        title: scriptMarket.market.question,
        layer: scriptMarket.layer,
        confidence: toNullableNumber(scriptMarket.confidence),
        outcomes: scriptMarket.selections.map((selection) => ({
          selectionId: selection.id,
          outcomeId: selection.outcomeId,
          label: selection.outcome.label,
          tokenId: selection.outcome.clobTokenId,
          aiAction: selection.aiAction,
          userAction: selection.userAction,
          orderMode: selection.orderMode,
          limitPrice: toNullableNumber(selection.limitPrice),
          size: toNullableNumber(selection.size),
          amountUsd: toNullableNumber(selection.amountUsd),
          reason: selection.reason,
        })),
      })),
    };
  }

  async updateOutcomeSelection(user: CurrentUser, scriptId: string, selectionId: string, dto: UpdateOutcomeSelectionDto) {
    const selection = await this.prisma.scriptOutcomeSelection.findFirst({
      where: {
        id: selectionId,
        scriptMarket: {
          scriptId,
          script: {
            userId: user.id,
          },
        },
      },
    });
    if (!selection) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'OUTCOME_NOT_FOUND', 'Script outcome selection was not found');
    }

    const before = formatSelectionAudit(selection);
    const nextState = buildNextSelectionState(selection, dto);
    assertSelectionState(nextState);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.scriptOutcomeSelection.update({
        where: { id: selectionId },
        data: {
          userAction: nextState.userAction,
          orderMode: nextState.orderMode,
          limitPrice: nextState.limitPrice,
          size: nextState.size,
          amountUsd: nextState.amountUsd,
          reason: nextState.reason,
        },
      });
      await tx.auditEvent.create({
        data: {
          userId: user.id,
          actorType: 'user',
          entityType: 'script_outcome_selection',
          entityId: selectionId,
          action: 'selection.updated',
          before: toJson(before),
          after: toJson(formatSelectionAudit(row)),
        },
      });

      return row;
    });

    return {
      selectionId: updated.id,
      userAction: updated.userAction,
      orderMode: updated.orderMode,
      limitPrice: toNullableNumber(updated.limitPrice),
      size: toNullableNumber(updated.size),
      amountUsd: toNullableNumber(updated.amountUsd),
      reason: updated.reason,
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}

function formatSelectionAudit(selection: {
  userAction: UserSelectionAction;
  orderMode: OrderMode;
  limitPrice: unknown;
  size: unknown;
  amountUsd: unknown;
  reason: string | null;
}) {
  return {
    userAction: selection.userAction,
    orderMode: selection.orderMode,
    limitPrice: toNullableNumber(selection.limitPrice),
    size: toNullableNumber(selection.size),
    amountUsd: toNullableNumber(selection.amountUsd),
    reason: selection.reason,
  };
}

type SelectionState = {
  userAction: UserSelectionAction;
  orderMode: OrderMode;
  limitPrice: number | null;
  size: number | null;
  amountUsd: number | null;
  reason: string | null;
};

type LoadedScriptMarket = Prisma.ScriptMarketGetPayload<{
  include: {
    market: {
      include: {
        outcomes: true;
      };
    };
    selections: {
      include: {
        outcome: true;
      };
    };
  };
}>;

type ScriptGraphResponse = {
  root: {
    marketId: string;
    outcomeId: string;
    outcomeLabel: string;
  };
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
};

function formatScriptGraph(
  graphJson: Prisma.JsonValue,
  rootMarketId: string,
  rootOutcomeId: string,
  markets: LoadedScriptMarket[],
): ScriptGraphResponse {
  const graph = isRecord(graphJson) ? graphJson : {};
  const marketTitleById = new Map(markets.map((scriptMarket) => [scriptMarket.marketId, scriptMarket.market.question]));
  const outcomeById = new Map(
    markets.flatMap((scriptMarket) =>
      scriptMarket.market.outcomes.map((outcome) => [
        outcome.id,
        {
          label: outcome.label,
          tokenId: outcome.clobTokenId,
        },
      ] as const),
    ),
  );
  const graphRoot = isRecord(graph.root) ? graph.root : {};
  const rootOutcome = outcomeById.get(rootOutcomeId);

  return {
    root: {
      marketId: readString(graphRoot.marketId) ?? rootMarketId,
      outcomeId: readString(graphRoot.outcomeId) ?? rootOutcomeId,
      outcomeLabel: readString(graphRoot.outcomeLabel) ?? rootOutcome?.label ?? '',
    },
    nodes: readArray(graph.nodes).map((node) => formatGraphNode(node, marketTitleById, outcomeById)),
    edges: readArray(graph.edges).map(formatGraphEdge),
  };
}

function formatGraphNode(
  value: unknown,
  marketTitleById: Map<string, string>,
  outcomeById: Map<string, { label: string; tokenId: string }>,
): Record<string, unknown> {
  const node = isRecord(value) ? value : {};
  const marketId = readString(node.marketId) ?? '';
  return {
    nodeId: readString(node.nodeId) ?? '',
    marketId,
    title: marketTitleById.get(marketId) ?? '',
    layer: readNumber(node.layer) ?? 0,
    recommendedOutcomes: readArray(node.recommendedOutcomes).map((outcome) =>
      formatRecommendedOutcome(outcome, outcomeById),
    ),
    confidence: readNumber(node.confidence) ?? 0,
    direction: readString(node.direction) ?? 'unclear',
  };
}

function formatRecommendedOutcome(
  value: unknown,
  outcomeById: Map<string, { label: string; tokenId: string }>,
): Record<string, unknown> {
  const outcome = isRecord(value) ? value : {};
  const outcomeId = readString(outcome.outcomeId) ?? '';
  const linkedOutcome = outcomeById.get(outcomeId);
  return {
    outcomeId,
    label: readString(outcome.label) ?? linkedOutcome?.label ?? '',
    tokenId: readString(outcome.tokenId) ?? linkedOutcome?.tokenId ?? '',
  };
}

function formatGraphEdge(value: unknown): Record<string, unknown> {
  const edge = isRecord(value) ? value : {};
  return {
    sourceNodeId: readString(edge.sourceNodeId) ?? '',
    targetNodeId: readString(edge.targetNodeId) ?? '',
    sourceOutcomeId: readString(edge.sourceOutcomeId) ?? '',
    targetOutcomeId: readString(edge.targetOutcomeId) ?? '',
    relation: readString(edge.relation) ?? 'correlates',
    confidence: readNumber(edge.confidence) ?? 0,
    reason: readString(edge.reason) ?? '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function buildNextSelectionState(
  selection: {
    userAction: UserSelectionAction;
    orderMode: OrderMode;
    limitPrice: unknown;
    size: unknown;
    amountUsd: unknown;
    reason: string | null;
  },
  dto: UpdateOutcomeSelectionDto,
): SelectionState {
  const orderMode = (dto.orderMode as OrderMode | undefined) ?? selection.orderMode;
  return {
    userAction: (dto.userAction as UserSelectionAction | undefined) ?? selection.userAction,
    orderMode,
    limitPrice: orderMode === 'market' ? null : dto.limitPrice ?? toNullableNumber(selection.limitPrice),
    size: dto.size ?? toNullableNumber(selection.size),
    amountUsd: dto.amountUsd ?? toNullableNumber(selection.amountUsd),
    reason: dto.reason ?? selection.reason,
  };
}

function assertSelectionState(state: SelectionState): void {
  if (state.userAction !== 'buy') return;

  if (state.orderMode === 'limit' && (state.limitPrice == null || state.limitPrice <= 0 || state.limitPrice > 1)) {
    throw new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'REQUEST_VALIDATION_FAILED',
      'Limit order selections require a valid limitPrice',
    );
  }

  if (state.orderMode === 'market' && state.limitPrice != null) {
    throw new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'REQUEST_VALIDATION_FAILED',
      'Market order selections cannot keep a limitPrice',
    );
  }

  const hasSize = state.size != null && state.size > 0;
  const hasAmount = state.amountUsd != null && state.amountUsd > 0;
  if (!hasSize && !hasAmount) {
    throw new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'REQUEST_VALIDATION_FAILED',
      'Buy selections require a positive size or amountUsd',
    );
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
