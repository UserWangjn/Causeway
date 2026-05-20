import { randomUUID } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { OrderMode, Prisma, UserSelectionAction } from '@prisma/client';
import { ApiException } from '../../common/errors/api.exception';
import type { CurrentUser } from '../../common/decorators/current-user.decorator';
import { toNullableNumber } from '../../common/utils/number.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateDirectOrderScriptDto } from './dto/create-direct-order-script.dto';
import { UpdateOutcomeSelectionDto } from './dto/update-outcome-selection.dto';

const SCRIPT_OUTCOME_SELECT = Prisma.validator<Prisma.PolymarketOutcomeSelect>()({
  id: true,
  label: true,
  clobTokenId: true,
  price: true,
  bestBid: true,
  bestAsk: true,
  lastTradePrice: true,
});

const SCRIPT_MARKET_SELECT = Prisma.validator<Prisma.ScriptMarketSelect>()({
  id: true,
  marketId: true,
  layer: true,
  impactDirection: true,
  confidence: true,
  reason: true,
  market: {
    select: {
      question: true,
      icon: true,
      image: true,
      orderMinSize: true,
      orderPriceMinTickSize: true,
      bestAsk: true,
      lastTradePrice: true,
      volume: true,
      volume24hr: true,
      liquidity: true,
      outcomes: {
        orderBy: { outcomeIndex: 'asc' },
        select: SCRIPT_OUTCOME_SELECT,
      },
    },
  },
  selections: {
    orderBy: { outcomeId: 'asc' },
    select: {
      id: true,
      outcomeId: true,
      aiAction: true,
      userAction: true,
      side: true,
      orderMode: true,
      limitPrice: true,
      size: true,
      amountUsd: true,
      confidence: true,
      reason: true,
      outcome: {
        select: SCRIPT_OUTCOME_SELECT,
      },
    },
  },
});

const SCRIPT_SELECT = Prisma.validator<Prisma.CausalScriptSelect>()({
  id: true,
  title: true,
  status: true,
  rootMarketId: true,
  rootOutcomeId: true,
  graphJson: true,
  summary: true,
  createdAt: true,
  updatedAt: true,
  markets: {
    orderBy: [{ layer: 'asc' }, { createdAt: 'asc' }],
    select: SCRIPT_MARKET_SELECT,
  },
});

const DIRECT_ORDER_MARKET_SELECT = Prisma.validator<Prisma.PolymarketMarketSelect>()({
  id: true,
  eventId: true,
  question: true,
  active: true,
  closed: true,
  archived: true,
  acceptingOrders: true,
  enableOrderBook: true,
  staleDetectedAt: true,
  orderMinSize: true,
  orderPriceMinTickSize: true,
  bestAsk: true,
  lastTradePrice: true,
  outcomes: {
    orderBy: { outcomeIndex: 'asc' },
    select: SCRIPT_OUTCOME_SELECT,
  },
});

@Injectable()
export class ScriptsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getScript(user: CurrentUser, scriptId: string) {
    const script = await this.prisma.causalScript.findFirst({
      where: { id: scriptId, userId: user.id },
      select: SCRIPT_SELECT,
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
        impactDirection: scriptMarket.impactDirection,
        confidence: toNullableNumber(scriptMarket.confidence),
        reason: scriptMarket.reason,
        icon: scriptMarket.market.icon,
        image: scriptMarket.market.image,
        orderMinSize: toNullableNumber(scriptMarket.market.orderMinSize),
        tickSize: toNullableNumber(scriptMarket.market.orderPriceMinTickSize),
        bestAsk: toNullableNumber(scriptMarket.market.bestAsk),
        lastTradePrice: toNullableNumber(scriptMarket.market.lastTradePrice),
        volume: toNullableNumber(scriptMarket.market.volume),
        volume24hr: toNullableNumber(scriptMarket.market.volume24hr),
        liquidity: toNullableNumber(scriptMarket.market.liquidity),
        outcomes: scriptMarket.selections.map((selection) => ({
          selectionId: selection.id,
          outcomeId: selection.outcomeId,
          label: selection.outcome.label,
          tokenId: selection.outcome.clobTokenId,
          price: firstNumber(selection.outcome.bestAsk, selection.outcome.price, selection.outcome.lastTradePrice, selection.outcome.bestBid),
          aiAction: selection.aiAction,
          userAction: selection.userAction,
          side: selection.side,
          orderMode: selection.orderMode,
          limitPrice: toNullableNumber(selection.limitPrice),
          size: toNullableNumber(selection.size),
          amountUsd: toNullableNumber(selection.amountUsd),
          confidence: toNullableNumber(selection.confidence),
          reason: selection.reason ?? '',
        })),
      })),
    };
  }

  async createDirectOrderScript(user: CurrentUser, dto: CreateDirectOrderScriptDto) {
    const market = await this.prisma.polymarketMarket.findFirst({
      where: { id: dto.marketId },
      select: DIRECT_ORDER_MARKET_SELECT,
    });
    if (!market) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'MARKET_NOT_FOUND', 'Market was not found');
    }

    const outcome = market.outcomes.find((item) => item.id === dto.outcomeId);
    if (!outcome) {
      throw new ApiException(HttpStatus.NOT_FOUND, 'OUTCOME_NOT_FOUND', 'Outcome was not found for the selected market', {
        marketId: dto.marketId,
        outcomeId: dto.outcomeId,
      });
    }
    assertDirectOrderMarketTradable(market);

    const orderMode = (dto.orderMode ?? 'market') as OrderMode;
    const tickSize = toNullableNumber(market.orderPriceMinTickSize);
    const limitPrice = orderMode === 'limit'
      ? resolveDirectLimitPrice(dto.limitPrice, tickSize, outcome, market)
      : null;
    const sizing = resolveDirectOrderSizing(dto);
    const graphJson = buildDirectOrderGraph(market, outcome);
    const cacheKey = `direct-order:${user.id}:${market.id}:${outcome.id}:${randomUUID()}`;
    const now = new Date();

    const createdScript = await this.prisma.$transaction(async (tx) => {
      const inferenceRun = await tx.inferenceRun.create({
        data: {
          userId: user.id,
          rootEventId: market.eventId,
          rootMarketId: market.id,
          rootOutcomeId: outcome.id,
          rootClobTokenId: outcome.clobTokenId,
          depth: 0,
          maxMarketsPerLayer: 1,
          confidenceThreshold: 1,
          model: 'manual-order',
          promptVersion: 'manual-order-v1',
          outputSchemaVersion: 'manual-order-v1',
          cacheEnabled: false,
          cacheKey,
          cacheHit: false,
          status: 'completed',
          stage: 'script_generation',
          progress: 100,
          inputJson: toJson({
            source: 'market_detail_order',
            marketId: market.id,
            outcomeId: outcome.id,
            orderMode,
          }),
          outputJson: toJson({
            graph: graphJson,
            selection: {
              marketId: market.id,
              outcomeId: outcome.id,
              orderMode,
              limitPrice,
              ...sizing,
            },
          }),
          completedAt: now,
        },
      });
      const script = await tx.causalScript.create({
        data: {
          userId: user.id,
          inferenceRunId: inferenceRun.id,
          title: `Order: ${trimDirectOrderTitle(market.question)}`,
          rootEventId: market.eventId,
          rootMarketId: market.id,
          rootOutcomeId: outcome.id,
          graphJson: toJson(graphJson),
          summary: `Manual order draft for ${outcome.label}.`,
          markets: {
            create: [
              {
                marketId: market.id,
                layer: 0,
                impactDirection: 'supports',
                confidence: 1,
                reason: 'Manual order created from market detail.',
                metadata: toJson({
                  source: 'market_detail_order',
                  orderMinSize: toNullableNumber(market.orderMinSize),
                  tickSize,
                }),
                selections: {
                  create: [
                    {
                      outcomeId: outcome.id,
                      aiAction: 'buy',
                      userAction: 'buy',
                      side: 'BUY',
                      orderMode,
                      limitPrice,
                      size: sizing.size,
                      amountUsd: sizing.amountUsd,
                      confidence: 1,
                      reason: 'User selected this outcome from the market detail page.',
                    },
                  ],
                },
              },
            ],
          },
        },
        select: { id: true },
      });
      await tx.auditEvent.create({
        data: {
          userId: user.id,
          ...auditRequestId(user),
          actorType: 'user',
          entityType: 'causal_script',
          entityId: script.id,
          action: 'script.direct_order_created',
          after: toJson({
            marketId: market.id,
            outcomeId: outcome.id,
            orderMode,
            limitPrice,
            ...sizing,
          }),
        },
      });
      return script;
    });

    return this.getScript(user, createdScript.id);
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
      select: {
        id: true,
        userAction: true,
        orderMode: true,
        limitPrice: true,
        size: true,
        amountUsd: true,
        reason: true,
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
          ...auditRequestId(user),
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
  select: typeof SCRIPT_MARKET_SELECT;
}>;

type DirectOrderMarket = Prisma.PolymarketMarketGetPayload<{
  select: typeof DIRECT_ORDER_MARKET_SELECT;
}>;

type DirectOrderOutcome = DirectOrderMarket['outcomes'][number];

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
          price: firstNumber(outcome.bestAsk, outcome.price, outcome.lastTradePrice, outcome.bestBid),
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
  outcomeById: Map<string, { label: string; tokenId: string; price: number | null }>,
): Record<string, unknown> {
  const node = isRecord(value) ? value : {};
  const marketId = readString(node.marketId) ?? '';
  const recommendedOutcomeValues = readArray(node.recommendedOutcomes);
  const recommendedOutcomes = recommendedOutcomeValues.map((outcome) => formatRecommendedOutcome(outcome, outcomeById));
  const recommendedOutcomePrices = recommendedOutcomeValues.map((outcome) => {
    const outcomeId = readString(isRecord(outcome) ? outcome.outcomeId : null) ?? '';
    return outcomeById.get(outcomeId)?.price;
  });
  return {
    nodeId: readString(node.nodeId) ?? '',
    marketId,
    title: marketTitleById.get(marketId) ?? '',
    layer: readNumber(node.layer) ?? 0,
    recommendedOutcomes,
    confidence: readNumber(node.confidence) ?? 0,
    direction: readString(node.direction) ?? 'unclear',
    price: firstNumber(...recommendedOutcomePrices),
  };
}

function formatRecommendedOutcome(
  value: unknown,
  outcomeById: Map<string, { label: string; tokenId: string; price: number | null }>,
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

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toNullableNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function assertDirectOrderMarketTradable(market: DirectOrderMarket): void {
  if (!market.active || market.closed || market.archived || market.staleDetectedAt != null) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'MARKET_NOT_TRADABLE', 'Market is not active for new orders', {
      marketId: market.id,
    });
  }
  if (!market.acceptingOrders || !market.enableOrderBook) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'MARKET_NOT_TRADABLE', 'Market is not currently accepting CLOB orders', {
      marketId: market.id,
    });
  }
}

function resolveDirectLimitPrice(
  requestedPrice: number | undefined,
  tickSize: number | null,
  outcome: DirectOrderOutcome,
  market: DirectOrderMarket,
): number {
  const price = requestedPrice ?? firstNumber(outcome.bestAsk, outcome.price, outcome.lastTradePrice, outcome.bestBid, market.bestAsk, market.lastTradePrice);
  if (price == null || price <= 0 || price > 1) {
    throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'REQUEST_VALIDATION_FAILED', 'Limit orders require a valid limit price');
  }
  return roundToTick(price, tickSize);
}

function resolveDirectOrderSizing(dto: CreateDirectOrderScriptDto): { amountUsd: number | null; size: number | null } {
  if (dto.size != null) {
    return {
      amountUsd: dto.amountUsd ?? null,
      size: dto.size,
    };
  }
  return {
    amountUsd: dto.amountUsd ?? 10,
    size: null,
  };
}

function roundToTick(value: number, tickSize: number | null): number {
  const step = tickSize && tickSize > 0 ? tickSize : 0.01;
  return Number(Math.min(1, Math.max(0.0001, Math.round(value / step) * step)).toFixed(6));
}

function buildDirectOrderGraph(market: DirectOrderMarket, outcome: DirectOrderOutcome): Prisma.InputJsonObject {
  return {
    root: {
      marketId: market.id,
      outcomeId: outcome.id,
      outcomeLabel: outcome.label,
    },
    nodes: [
      {
        nodeId: 'root',
        marketId: market.id,
        layer: 0,
        recommendedOutcomes: [
          {
            outcomeId: outcome.id,
            label: outcome.label,
            tokenId: outcome.clobTokenId,
          },
        ],
        confidence: 1,
        direction: 'supports',
        reason: 'Manual order created from market detail.',
      },
    ],
    edges: [],
  };
}

function trimDirectOrderTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length <= 96 ? trimmed : `${trimmed.slice(0, 93)}...`;
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

function auditRequestId(user: CurrentUser): { requestId: string } | Record<string, never> {
  return user.requestId ? { requestId: user.requestId } : {};
}
