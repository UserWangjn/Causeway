import { HttpStatus } from '@nestjs/common';
import { z } from 'zod';
import { ApiException } from '../../common/errors/api.exception';
import { hashJson } from '../../common/utils/hash.util';
import type {
  AiEdge,
  AiInferenceOutput,
  AiMarketNode,
  AiOutcomeRecommendation,
  InferenceMarketInput,
  InferencePromptInput,
} from './inference.types';

export const MOCK_INFERENCE_MODEL = 'mock-causeway-v1';
export const INFERENCE_PROMPT_VERSION = 'causeway-b5-v2';
export const INFERENCE_OUTPUT_SCHEMA_VERSION = 'causeway-ai-output-v1';

const layerSchema = z.preprocess((value) => {
  if (typeof value === 'string' && /^[0-3]$/.test(value.trim())) {
    return Number(value.trim());
  }
  return value;
}, z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]));

const confidenceSchema = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return value;
}, z.number().min(0).max(1));

const aiOutcomeRecommendationSchema = z
  .object({
    outcomeId: z.string().min(1),
    outcomeLabel: z.string(),
    aiAction: z.enum(['buy', 'avoid']),
    confidence: confidenceSchema,
    reason: z.string(),
  })
  .strict();

const aiMarketNodeSchema = z
  .object({
    clientNodeId: z.string().min(1),
    marketId: z.string().min(1),
    layer: layerSchema,
    confidence: confidenceSchema,
    impactDirection: z.enum(['supports', 'opposes', 'unclear']),
    reason: z.string(),
    outcomes: z.array(aiOutcomeRecommendationSchema).min(1),
  })
  .strict();

const aiEdgeSchema = z
  .object({
    sourceClientNodeId: z.string().min(1),
    targetClientNodeId: z.string().min(1),
    sourceOutcomeId: z.string().min(1),
    targetOutcomeId: z.string().min(1),
    relation: z.enum(['causes', 'supports', 'hedges', 'contradicts', 'correlates']),
    confidence: confidenceSchema,
    reason: z.string(),
  })
  .strict();

const aiInferenceOutputSchema = z
  .object({
    summary: z.string(),
    nodes: z.array(aiMarketNodeSchema).min(1),
    edges: z.array(aiEdgeSchema),
    warnings: z.array(z.string()),
  })
  .strict();

export function buildInferenceCacheKey(input: {
  promptInput: InferencePromptInput;
  model: string;
}): string {
  return hashJson({
    prompt: buildCacheComparablePrompt(input.promptInput),
    model: input.model,
    promptVersion: INFERENCE_PROMPT_VERSION,
    outputSchemaVersion: INFERENCE_OUTPUT_SCHEMA_VERSION,
  });
}

function buildCacheComparablePrompt(input: InferencePromptInput): unknown {
  return {
    root: {
      marketId: input.root.marketId,
      marketQuestion: input.root.marketQuestion,
      selectedOutcome: buildCacheComparableOutcome(input.root.selectedOutcome),
    },
    settings: input.settings,
    candidateMarkets: input.candidateMarkets.map((market) => ({
      marketId: market.marketId,
      eventTitle: market.eventTitle,
      question: market.question,
      description: market.description,
      rules: market.rules,
      category: market.category,
      tags: [...market.tags].sort(),
      active: market.active,
      closed: market.closed,
      acceptingOrders: market.acceptingOrders,
      enableOrderBook: market.enableOrderBook,
      orderMinSize: roundCacheNumber(market.orderMinSize),
      orderPriceMinTickSize: roundCacheNumber(market.orderPriceMinTickSize),
      bestBid: roundCacheNumber(market.bestBid),
      bestAsk: roundCacheNumber(market.bestAsk),
      lastTradePrice: roundCacheNumber(market.lastTradePrice),
      spread: roundCacheNumber(market.spread),
      volume: roundCacheNumber(market.volume),
      volume24hr: roundCacheNumber(market.volume24hr),
      liquidity: roundCacheNumber(market.liquidity),
      endDate: market.endDate,
      outcomes: market.outcomes.map(buildCacheComparableOutcome),
    })),
  };
}

function buildCacheComparableOutcome(outcome: InferenceMarketInput['outcomes'][number]): unknown {
  return {
    outcomeId: outcome.outcomeId,
    label: outcome.label,
    tokenId: outcome.tokenId,
    price: roundCacheNumber(outcome.price),
    bestBid: roundCacheNumber(outcome.bestBid),
    bestAsk: roundCacheNumber(outcome.bestAsk),
    lastTradePrice: roundCacheNumber(outcome.lastTradePrice),
  };
}

function roundCacheNumber(value: number | null): number | null {
  return value == null ? null : Math.round(value * 1_000) / 1_000;
}

export function buildMockInferenceOutput(input: InferencePromptInput): AiInferenceOutput {
  const selectedMarkets = input.candidateMarkets
    .filter((market) => market.marketId !== input.root.marketId)
    .flatMap((market, index) => {
      const layer = Math.min(Math.floor(index / input.settings.maxMarketsPerLayer) + 1, input.settings.depth);
      const confidence = roundConfidence(0.86 - layer * 0.08 - (index % input.settings.maxMarketsPerLayer) * 0.02);
      if (layer > input.settings.depth || confidence < input.settings.confidenceThreshold) return [];
      return [{ market, layer: layer as 1 | 2 | 3, confidence }];
    })
    .slice(0, input.settings.depth * input.settings.maxMarketsPerLayer);

  const rootNode: AiMarketNode = {
    clientNodeId: 'root',
    marketId: input.root.marketId,
    layer: 0,
    confidence: 1,
    impactDirection: 'supports',
    reason: `Root hypothesis selected by the user: ${input.root.selectedOutcome.label}.`,
    outcomes: buildOutcomeRecommendations(
      {
        marketId: input.root.marketId,
        eventTitle: null,
        question: input.root.marketQuestion,
        description: null,
        rules: null,
        category: null,
        tags: [],
        active: true,
        closed: false,
        acceptingOrders: true,
        enableOrderBook: true,
        orderMinSize: null,
        orderPriceMinTickSize: null,
        bestBid: null,
        bestAsk: null,
        lastTradePrice: null,
        spread: null,
        volume: null,
        volume24hr: null,
        liquidity: null,
        endDate: null,
        outcomes: [input.root.selectedOutcome],
      },
      input.root.selectedOutcome.outcomeId,
      1,
      'Root outcome selected by the user.',
    ),
  };

  const nodes: AiMarketNode[] = [
    rootNode,
    ...selectedMarkets.map(({ market, layer, confidence }, index) => {
      const buyOutcome = pickBuyOutcome(market);
      return {
        clientNodeId: `candidate_${index + 1}`,
        marketId: market.marketId,
        layer,
        confidence,
        impactDirection: index % 3 === 1 ? 'opposes' as const : 'supports' as const,
        reason: buildMarketReason(input.root.selectedOutcome.label, market),
        outcomes: buildOutcomeRecommendations(
          market,
          buyOutcome.outcomeId,
          confidence,
          `Most direct tradable expression of the ${market.question} causal path.`,
        ),
      };
    }),
  ];

  const edges: AiEdge[] = nodes.slice(1).map((node, index) => {
    const targetOutcomeId = node.outcomes.find((outcome) => outcome.aiAction === 'buy')?.outcomeId ?? node.outcomes[0]?.outcomeId;
    if (!targetOutcomeId) {
      throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'INFERENCE_FAILED', 'Mock inference produced a node without outcomes');
    }
    return {
      sourceClientNodeId: index < input.settings.maxMarketsPerLayer ? 'root' : nodes[index]?.clientNodeId ?? 'root',
      targetClientNodeId: node.clientNodeId,
      sourceOutcomeId: index < input.settings.maxMarketsPerLayer ? input.root.selectedOutcome.outcomeId : (nodes[index]?.outcomes[0]?.outcomeId ?? input.root.selectedOutcome.outcomeId),
      targetOutcomeId,
      relation: index % 2 === 0 ? 'supports' : 'correlates',
      confidence: node.confidence,
      reason: `Deterministic mock inference links the selected root outcome to ${node.marketId}.`,
    };
  });

  return {
    summary: `Generated ${nodes.length - 1} candidate market links from the selected root outcome.`,
    nodes,
    edges,
    warnings: ['mock_inference_used'],
  };
}

export function validateAiInferenceOutput(output: unknown, input: InferencePromptInput): AiInferenceOutput {
  let parsedOutput = parseAiInferenceOutput(output);

  const initialNodeByClientId = new Map(parsedOutput.nodes.map((node) => [node.clientNodeId, node]));
  if (initialNodeByClientId.size !== parsedOutput.nodes.length) {
    throw invalidOutput('AI output contains duplicate node ids');
  }

  const outputMarketIds = new Set(parsedOutput.nodes.map((node) => node.marketId));
  if (outputMarketIds.size !== parsedOutput.nodes.length) {
    throw invalidOutput('AI output contains duplicate market nodes');
  }

  assertRootNode(parsedOutput, input);

  const marketById = new Map(input.candidateMarkets.map((market) => [market.marketId, market]));
  const nodeByClientId = new Map(parsedOutput.nodes.map((node) => [node.clientNodeId, node]));

  for (const node of parsedOutput.nodes) {
    const market = marketById.get(node.marketId);
    if (!market && node.marketId !== input.root.marketId) {
      throw invalidOutput('AI output referenced an unknown market', { marketId: node.marketId });
    }
    if (node.layer < 0 || node.layer > input.settings.depth) {
      throw invalidOutput('AI output node layer exceeds requested depth', { clientNodeId: node.clientNodeId });
    }
    assertConfidence(node.confidence, `node ${node.clientNodeId}`);
    if (node.clientNodeId !== 'root') {
      assertConfidenceMeetsThreshold(node.confidence, input.settings.confidenceThreshold, `node ${node.clientNodeId}`);
    }

    const allowedOutcomeIds = new Set((market?.outcomes ?? [input.root.selectedOutcome]).map((outcome) => outcome.outcomeId));
    const recommendedOutcomeIds = new Set(node.outcomes.map((outcome) => outcome.outcomeId));
    if (recommendedOutcomeIds.size !== node.outcomes.length) {
      throw invalidOutput('AI output contains duplicate outcome recommendations', {
        marketId: node.marketId,
      });
    }
    for (const outcome of node.outcomes) {
      if (!allowedOutcomeIds.has(outcome.outcomeId)) {
        throw invalidOutput('AI output referenced an unknown outcome', {
          marketId: node.marketId,
          outcomeId: outcome.outcomeId,
        });
      }
      assertConfidence(outcome.confidence, `outcome ${outcome.outcomeId}`);
      if (node.clientNodeId !== 'root' && outcome.aiAction === 'buy') {
        assertConfidenceMeetsThreshold(
          outcome.confidence,
          input.settings.confidenceThreshold,
          `buy outcome ${outcome.outcomeId}`,
        );
      }
    }
    if (market && (node.outcomes.length !== market.outcomes.length || recommendedOutcomeIds.size !== market.outcomes.length)) {
      throw invalidOutput('AI output must include one recommendation for every market outcome', {
        marketId: node.marketId,
      });
    }
  }

  for (const edge of parsedOutput.edges) {
    const sourceNode = nodeByClientId.get(edge.sourceClientNodeId);
    const targetNode = nodeByClientId.get(edge.targetClientNodeId);
    if (!sourceNode || !targetNode) {
      throw invalidOutput('AI output edge referenced an unknown node', edge);
    }
    if (sourceNode.layer >= targetNode.layer) {
      throw invalidOutput('AI output edge must point from a lower layer to a higher layer', edge);
    }
    if (sourceNode.clientNodeId === 'root' && edge.sourceOutcomeId !== input.root.selectedOutcome.outcomeId) {
      throw invalidOutput('Root edge must use the selected root outcome', edge);
    }
    assertConfidence(edge.confidence, `edge ${edge.sourceClientNodeId}->${edge.targetClientNodeId}`);
    assertConfidenceMeetsThreshold(
      edge.confidence,
      input.settings.confidenceThreshold,
      `edge ${edge.sourceClientNodeId}->${edge.targetClientNodeId}`,
    );
    assertNodeHasOutcome(sourceNode, edge.sourceOutcomeId);
    assertNodeHasOutcome(targetNode, edge.targetOutcomeId);
  }

  parsedOutput = limitMarketsPerLayer(parsedOutput, input.settings.maxMarketsPerLayer);
  assertMaxMarketsPerLayer(parsedOutput, input.settings.maxMarketsPerLayer);
  assertConnectedGraph(parsedOutput);
  assertAcyclicGraph(parsedOutput);
  return parsedOutput;
}

function buildOutcomeRecommendations(
  market: InferenceMarketInput,
  buyOutcomeId: string,
  confidence: number,
  buyReason: string,
): AiOutcomeRecommendation[] {
  return market.outcomes.map((outcome) => ({
    outcomeId: outcome.outcomeId,
    outcomeLabel: outcome.label,
    aiAction: outcome.outcomeId === buyOutcomeId ? 'buy' : 'avoid',
    confidence: outcome.outcomeId === buyOutcomeId ? confidence : roundConfidence(Math.max(confidence - 0.2, 0.1)),
    reason: outcome.outcomeId === buyOutcomeId ? buyReason : `Not selected as the strongest expression for ${market.question}.`,
  }));
}

function pickBuyOutcome(market: InferenceMarketInput): InferenceMarketInput['outcomes'][number] {
  return [...market.outcomes].sort((left, right) => {
    const rightPrice = right.price ?? -1;
    const leftPrice = left.price ?? -1;
    if (rightPrice !== leftPrice) return rightPrice - leftPrice;
    return left.outcomeId.localeCompare(right.outcomeId);
  })[0] ?? market.outcomes[0];
}

function buildMarketReason(rootOutcomeLabel: string, market: InferenceMarketInput): string {
  const eventText = market.eventTitle ? ` in ${market.eventTitle}` : '';
  return `If "${rootOutcomeLabel}" occurs, ${market.question}${eventText} is a relevant candidate market from local Polymarket data.`;
}

function roundConfidence(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 1) * 100) / 100;
}

function assertConfidence(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw invalidOutput(`AI output confidence is invalid for ${label}`, { confidence: value });
  }
}

function assertConfidenceMeetsThreshold(value: number, threshold: number, label: string): void {
  if (value < threshold) {
    throw invalidOutput(`AI output confidence is below threshold for ${label}`, {
      confidence: value,
      confidenceThreshold: threshold,
    });
  }
}

function assertNodeHasOutcome(node: AiMarketNode, outcomeId: string): void {
  if (!node.outcomes.some((outcome) => outcome.outcomeId === outcomeId)) {
    throw invalidOutput('AI output edge referenced an outcome outside its node', {
      clientNodeId: node.clientNodeId,
      outcomeId,
    });
  }
}

function parseAiInferenceOutput(output: unknown): AiInferenceOutput {
  const parsed = aiInferenceOutputSchema.safeParse(output);
  if (!parsed.success) {
    throw invalidOutput(
      'AI output schema is invalid',
      parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}

function assertRootNode(output: AiInferenceOutput, input: InferencePromptInput): void {
  const rootNode = output.nodes.find((node) => node.clientNodeId === 'root');
  if (!rootNode) {
    throw invalidOutput('AI output must include a root node');
  }
  if (rootNode.marketId !== input.root.marketId || rootNode.layer !== 0) {
    throw invalidOutput('AI output root node does not match the requested root market');
  }
  if (rootNode.outcomes.length !== 1 || rootNode.outcomes[0]?.outcomeId !== input.root.selectedOutcome.outcomeId) {
    throw invalidOutput('AI output root node must include only the selected root outcome');
  }
  if (rootNode.outcomes[0]?.aiAction !== 'buy') {
    throw invalidOutput('AI output root outcome must be selected for buy');
  }
}

function assertMaxMarketsPerLayer(output: AiInferenceOutput, maxMarketsPerLayer: number): void {
  const countByLayer = new Map<number, number>();
  for (const node of output.nodes) {
    if (node.layer === 0) continue;
    const count = (countByLayer.get(node.layer) ?? 0) + 1;
    if (count > maxMarketsPerLayer) {
      throw invalidOutput('AI output exceeds maxMarketsPerLayer', {
        layer: node.layer,
        count,
        maxMarketsPerLayer,
      });
    }
    countByLayer.set(node.layer, count);
  }
}

function limitMarketsPerLayer(output: AiInferenceOutput, maxMarketsPerLayer: number): AiInferenceOutput {
  const keptNodes: AiMarketNode[] = [];
  const candidatesByLayer = new Map<number, Array<{ node: AiMarketNode; index: number }>>();

  output.nodes.forEach((node, index) => {
    if (node.layer === 0) {
      keptNodes.push(node);
      return;
    }
    const candidates = candidatesByLayer.get(node.layer) ?? [];
    candidates.push({ node, index });
    candidatesByLayer.set(node.layer, candidates);
  });

  let truncated = false;
  for (const candidates of [...candidatesByLayer.entries()].sort(([leftLayer], [rightLayer]) => leftLayer - rightLayer).map(([, nodes]) => nodes)) {
    const selected = candidates
      .sort((left, right) => right.node.confidence - left.node.confidence || left.index - right.index)
      .slice(0, maxMarketsPerLayer)
      .sort((left, right) => left.index - right.index);
    truncated ||= selected.length < candidates.length;
    keptNodes.push(...selected.map(({ node }) => node));
  }

  if (!truncated) return output;

  const keptNodeIds = new Set(keptNodes.map((node) => node.clientNodeId));
  const edges = output.edges.filter(
    (edge) => keptNodeIds.has(edge.sourceClientNodeId) && keptNodeIds.has(edge.targetClientNodeId),
  );
  const warnings = output.warnings.includes('truncated_to_max_markets_per_layer')
    ? output.warnings
    : [...output.warnings, 'truncated_to_max_markets_per_layer'];

  return {
    ...output,
    nodes: keptNodes,
    edges,
    warnings,
  };
}

function assertConnectedGraph(output: AiInferenceOutput): void {
  const incomingNodeIds = new Set(output.edges.map((edge) => edge.targetClientNodeId));
  for (const node of output.nodes) {
    if (node.clientNodeId !== 'root' && !incomingNodeIds.has(node.clientNodeId)) {
      throw invalidOutput('AI output non-root nodes must have an incoming edge', {
        clientNodeId: node.clientNodeId,
      });
    }
  }
}

function assertAcyclicGraph(output: AiInferenceOutput): void {
  const childrenByNodeId = new Map<string, string[]>();
  for (const edge of output.edges) {
    const children = childrenByNodeId.get(edge.sourceClientNodeId) ?? [];
    children.push(edge.targetClientNodeId);
    childrenByNodeId.set(edge.sourceClientNodeId, children);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  for (const node of output.nodes) {
    visitNode(node.clientNodeId, childrenByNodeId, visiting, visited);
  }
}

function visitNode(
  nodeId: string,
  childrenByNodeId: Map<string, string[]>,
  visiting: Set<string>,
  visited: Set<string>,
): void {
  if (visited.has(nodeId)) return;
  if (visiting.has(nodeId)) {
    throw invalidOutput('AI output graph contains a cycle', { nodeId });
  }

  visiting.add(nodeId);
  for (const childNodeId of childrenByNodeId.get(nodeId) ?? []) {
    visitNode(childNodeId, childrenByNodeId, visiting, visited);
  }
  visiting.delete(nodeId);
  visited.add(nodeId);
}

function invalidOutput(message: string, details?: unknown): ApiException {
  return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, 'INFERENCE_FAILED', message, details);
}
