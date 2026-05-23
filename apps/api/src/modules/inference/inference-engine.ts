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

export const INFERENCE_PROMPT_VERSION = 'causeway-b5-v5';
export const INFERENCE_OUTPUT_SCHEMA_VERSION = 'causeway-ai-output-v1';

const CJK_TEXT_PATTERN = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/u;

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

export function validateAiInferenceOutput(output: unknown, input: InferencePromptInput): AiInferenceOutput {
  let parsedOutput = parseAiInferenceOutput(output);
  assertEnglishUserVisibleText(parsedOutput);

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
    if (node.clientNodeId !== 'root' && node.layer === 0) {
      throw invalidOutput('AI output non-root nodes must use layer 1 or higher', { clientNodeId: node.clientNodeId });
    }
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

  parsedOutput = normalizeEdgesForLayerOrder(parsedOutput, nodeByClientId);
  parsedOutput = deduplicateEdges(parsedOutput);
  assertValidEdges(parsedOutput, input);

  parsedOutput = limitMarketsPerLayer(parsedOutput, input.settings.maxMarketsPerLayer);
  parsedOutput = repairMissingIncomingEdges(parsedOutput, input);
  parsedOutput = deduplicateEdges(parsedOutput);
  assertValidEdges(parsedOutput, input);
  assertMaxMarketsPerLayer(parsedOutput, input.settings.maxMarketsPerLayer);
  assertConnectedGraph(parsedOutput);
  assertAcyclicGraph(parsedOutput);
  return parsedOutput;
}

function normalizeEdgesForLayerOrder(
  output: AiInferenceOutput,
  nodeByClientId: Map<string, AiMarketNode>,
): AiInferenceOutput {
  let reoriented = false;
  let droppedSameLayer = false;
  const edges: AiEdge[] = [];

  for (const edge of output.edges) {
    const sourceNode = nodeByClientId.get(edge.sourceClientNodeId);
    const targetNode = nodeByClientId.get(edge.targetClientNodeId);
    if (!sourceNode || !targetNode) {
      edges.push(edge);
      continue;
    }

    if (sourceNode.layer < targetNode.layer) {
      edges.push(edge);
      continue;
    }

    if (sourceNode.layer > targetNode.layer) {
      reoriented = true;
      edges.push({
        ...edge,
        sourceClientNodeId: edge.targetClientNodeId,
        targetClientNodeId: edge.sourceClientNodeId,
        sourceOutcomeId: edge.targetOutcomeId,
        targetOutcomeId: edge.sourceOutcomeId,
        reason: appendEdgeNormalizationNote(edge.reason),
      });
      continue;
    }

    droppedSameLayer = true;
  }

  if (!reoriented && !droppedSameLayer) return output;

  return {
    ...output,
    edges,
    warnings: [
      ...output.warnings,
      ...(reoriented ? ['ai_output_reoriented_edges_to_layer_order'] : []),
      ...(droppedSameLayer ? ['ai_output_dropped_same_layer_edges'] : []),
    ].filter(uniqueString),
  };
}

function deduplicateEdges(output: AiInferenceOutput): AiInferenceOutput {
  let deduplicated = false;
  const edgeIndexByKey = new Map<string, number>();
  const edges: AiEdge[] = [];

  for (const edge of output.edges) {
    const key = edgeIdentityKey(edge);
    const existingIndex = edgeIndexByKey.get(key);
    if (existingIndex === undefined) {
      edgeIndexByKey.set(key, edges.length);
      edges.push(edge);
      continue;
    }

    deduplicated = true;
    const existing = edges[existingIndex];
    if (isBetterDuplicateEdge(edge, existing)) {
      edges[existingIndex] = edge;
    }
  }

  if (!deduplicated) return output;

  return appendWarning(
    {
      ...output,
      edges,
    },
    'ai_output_deduplicated_edges',
  );
}

function edgeIdentityKey(edge: AiEdge): string {
  return [
    edge.sourceClientNodeId,
    edge.targetClientNodeId,
    edge.sourceOutcomeId,
    edge.targetOutcomeId,
  ].join('\u0000');
}

function isBetterDuplicateEdge(candidate: AiEdge, current: AiEdge): boolean {
  if (candidate.confidence !== current.confidence) return candidate.confidence > current.confidence;
  if (candidate.relation !== current.relation) return relationRank(candidate.relation) > relationRank(current.relation);
  return candidate.reason.length > current.reason.length;
}

function relationRank(relation: AiEdge['relation']): number {
  switch (relation) {
    case 'causes':
      return 5;
    case 'supports':
      return 4;
    case 'contradicts':
      return 3;
    case 'hedges':
      return 2;
    case 'correlates':
      return 1;
  }
}

function repairMissingIncomingEdges(output: AiInferenceOutput, input: InferencePromptInput): AiInferenceOutput {
  const incomingNodeIds = new Set(output.edges.map((edge) => edge.targetClientNodeId));
  const edges = [...output.edges];
  let repaired = false;

  const nodesByLayer = [...output.nodes].sort(
    (left, right) => left.layer - right.layer || right.confidence - left.confidence || left.clientNodeId.localeCompare(right.clientNodeId),
  );

  for (const node of nodesByLayer) {
    if (node.clientNodeId === 'root' || incomingNodeIds.has(node.clientNodeId)) continue;

    const sourceNode = selectRepairSourceNode(node, output.nodes, incomingNodeIds);
    if (!sourceNode) continue;

    edges.push(buildRepairedIncomingEdge(sourceNode, node, input));
    incomingNodeIds.add(node.clientNodeId);
    repaired = true;
  }

  if (!repaired) return output;

  return appendWarning(
    {
      ...output,
      edges,
    },
    'ai_output_repaired_missing_incoming_edges',
  );
}

function selectRepairSourceNode(
  targetNode: AiMarketNode,
  nodes: AiMarketNode[],
  connectedNodeIds: Set<string>,
): AiMarketNode | undefined {
  return nodes
    .filter((node) => {
      if (node.clientNodeId === targetNode.clientNodeId) return false;
      if (node.layer >= targetNode.layer) return false;
      return node.clientNodeId === 'root' || connectedNodeIds.has(node.clientNodeId);
    })
    .sort(
      (left, right) =>
        right.layer - left.layer || right.confidence - left.confidence || left.clientNodeId.localeCompare(right.clientNodeId),
    )[0];
}

function buildRepairedIncomingEdge(
  sourceNode: AiMarketNode,
  targetNode: AiMarketNode,
  input: InferencePromptInput,
): AiEdge {
  const sourceOutcome = pickEdgeOutcome(sourceNode, input);
  const targetOutcome = pickEdgeOutcome(targetNode, input);
  const sourceConfidence = sourceNode.clientNodeId === 'root' ? 1 : sourceNode.confidence;

  return {
    sourceClientNodeId: sourceNode.clientNodeId,
    targetClientNodeId: targetNode.clientNodeId,
    sourceOutcomeId: sourceOutcome.outcomeId,
    targetOutcomeId: targetOutcome.outcomeId,
    relation: relationFromImpactDirection(targetNode.impactDirection),
    confidence: roundConfidence(Math.min(sourceConfidence, targetNode.confidence)),
    reason:
      'Backend repaired a missing UI graph edge because the AI output selected this node without a valid incoming edge.',
  };
}

function pickEdgeOutcome(node: AiMarketNode, input: InferencePromptInput): AiOutcomeRecommendation {
  if (node.clientNodeId === 'root') {
    return {
      outcomeId: input.root.selectedOutcome.outcomeId,
      outcomeLabel: input.root.selectedOutcome.label,
      aiAction: 'buy',
      confidence: 1,
      reason: 'Selected root outcome.',
    };
  }

  return (
    node.outcomes.find((outcome) => outcome.aiAction === 'buy') ??
    [...node.outcomes].sort((left, right) => right.confidence - left.confidence || left.outcomeId.localeCompare(right.outcomeId))[0]
  );
}

function relationFromImpactDirection(direction: AiMarketNode['impactDirection']): AiEdge['relation'] {
  switch (direction) {
    case 'supports':
      return 'supports';
    case 'opposes':
      return 'contradicts';
    case 'unclear':
      return 'correlates';
  }
}

function appendEdgeNormalizationNote(reason: string): string {
  const note = 'Direction normalized by backend to match UI layer order.';
  return reason.includes(note) ? reason : `${reason} ${note}`;
}

function uniqueString(value: string, index: number, values: string[]): boolean {
  return values.indexOf(value) === index;
}

function appendWarning(output: AiInferenceOutput, warning: string): AiInferenceOutput {
  return {
    ...output,
    warnings: [...output.warnings, warning].filter(uniqueString),
  };
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

function assertEnglishUserVisibleText(output: AiInferenceOutput): void {
  assertEnglishText(output.summary, 'summary');
  output.warnings.forEach((warning, index) => assertEnglishText(warning, `warnings.${index}`));
  output.nodes.forEach((node, nodeIndex) => {
    assertEnglishText(node.reason, `nodes.${nodeIndex}.reason`);
    node.outcomes.forEach((outcome, outcomeIndex) => {
      assertEnglishText(outcome.reason, `nodes.${nodeIndex}.outcomes.${outcomeIndex}.reason`);
    });
  });
  output.edges.forEach((edge, edgeIndex) => {
    assertEnglishText(edge.reason, `edges.${edgeIndex}.reason`);
  });
}

function assertEnglishText(value: string, path: string): void {
  if (!CJK_TEXT_PATTERN.test(value)) return;
  throw invalidOutput('AI output user-visible text must be English', {
    path,
  });
}

function assertValidEdges(output: AiInferenceOutput, input: InferencePromptInput): void {
  const nodeByClientId = new Map(output.nodes.map((node) => [node.clientNodeId, node]));

  for (const edge of output.edges) {
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
