import type {
  AiEdge,
  AiInferenceOutput,
  AiMarketNode,
  AiOutcomeRecommendation,
  InferenceMarketInput,
  InferencePromptInput,
} from '../../src/modules/inference/inference.types';

export function buildFixtureInferenceOutput(input: InferencePromptInput): AiInferenceOutput {
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
      throw new Error('Fixture inference produced a node without outcomes');
    }
    return {
      sourceClientNodeId: index < input.settings.maxMarketsPerLayer ? 'root' : nodes[index]?.clientNodeId ?? 'root',
      targetClientNodeId: node.clientNodeId,
      sourceOutcomeId: index < input.settings.maxMarketsPerLayer ? input.root.selectedOutcome.outcomeId : nodes[index]?.outcomes[0]?.outcomeId ?? input.root.selectedOutcome.outcomeId,
      targetOutcomeId,
      relation: index % 2 === 0 ? 'supports' : 'correlates',
      confidence: node.confidence,
      reason: `Fixture inference links the selected root outcome to ${node.marketId}.`,
    };
  });

  return {
    summary: `Generated ${nodes.length - 1} candidate market links from the selected root outcome.`,
    nodes,
    edges,
    warnings: [],
  };
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
  return `If "${rootOutcomeLabel}" occurs, ${market.question}${eventText} is a relevant candidate market from fixture data.`;
}

function roundConfidence(value: number): number {
  return Math.round(Math.min(Math.max(value, 0), 1) * 100) / 100;
}
