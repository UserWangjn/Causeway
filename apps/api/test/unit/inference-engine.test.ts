import { describe, expect, it } from 'vitest';
import {
  buildInferenceCacheKey,
  validateAiInferenceOutput,
} from '../../src/modules/inference/inference-engine';
import type { AiInferenceOutput, InferenceMarketInput, InferencePromptInput } from '../../src/modules/inference/inference.types';
import { buildFixtureInferenceOutput } from '../support/inference-output.fixture';

describe('inference engine helpers', () => {
  it('builds a stable cache key independent of object key ordering', () => {
    const candidates = [candidateMarket('market_1', ['outcome_1', 'outcome_2'])];

    expect(
      buildInferenceCacheKey({
        promptInput: {
          ...inferencePromptInput(),
          candidateMarkets: candidates,
        },
        model: 'deepseek-v4-flash',
      }),
    ).toBe(
      buildInferenceCacheKey({
        model: 'deepseek-v4-flash',
        promptInput: {
          candidateMarkets: candidates,
          settings: {
            confidenceThreshold: 0.55,
            maxMarketsPerLayer: 3,
            depth: 2,
          },
          root: {
            selectedOutcome: {
              bestAsk: null,
              bestBid: null,
              label: 'Yes',
              lastTradePrice: null,
              outcomeId: 'root_outcome',
              price: 0.5,
              tokenId: 'root_token',
            },
            marketQuestion: 'Will the root event happen?',
            marketId: 'root_market',
          },
        },
      }),
    );
  });

  it('validates complete fixture output with candidate market/outcome references', () => {
    const promptInput = inferencePromptInput();

    const output = buildFixtureInferenceOutput(promptInput);

    expect(output.nodes.length).toBeGreaterThan(1);
    expect(output.nodes[1]?.outcomes).toHaveLength(promptInput.candidateMarkets[0]?.outcomes.length);
    expect(() => validateAiInferenceOutput(output, promptInput)).not.toThrow();
  });

  it('rejects output that references unknown outcomes', () => {
    const promptInput = inferencePromptInput();
    const output = validInferenceOutput(promptInput);
    output.nodes[1].outcomes = [
      {
        outcomeId: 'unknown_outcome',
        outcomeLabel: 'Unknown',
        aiAction: 'buy',
        confidence: 0.8,
        reason: 'bad',
      },
    ];

    expect(() => validateAiInferenceOutput(output, promptInput)).toThrow('AI output referenced an unknown outcome');
  });

  it('rejects provider output that does not match the runtime schema', () => {
    const promptInput = inferencePromptInput();
    const output = validInferenceOutput(promptInput) as unknown as {
      nodes: Array<{ outcomes: Array<{ aiAction: string }> }>;
    };
    output.nodes[1].outcomes[0].aiAction = 'sell';

    expect(() => validateAiInferenceOutput(output, promptInput)).toThrow('AI output schema is invalid');
  });

  it('rejects Chinese user-visible text from provider output', () => {
    const promptInput = inferencePromptInput();
    const output = validInferenceOutput(promptInput);
    output.summary = '这是中文摘要';

    expect(() => validateAiInferenceOutput(output, promptInput)).toThrow('AI output user-visible text must be English');
  });

  it('normalizes numeric strings from provider output at the schema boundary', () => {
    const promptInput = inferencePromptInput();
    const output = validInferenceOutput(promptInput) as unknown as {
      nodes: Array<{
        layer: string | number;
        confidence: string | number;
        outcomes: Array<{ confidence: string | number }>;
      }>;
      edges: Array<{ confidence: string | number }>;
    };
    output.nodes[0].layer = '0';
    output.nodes[0].confidence = '1';
    output.nodes[0].outcomes[0].confidence = '1';
    output.nodes[1].layer = '1';
    output.nodes[1].confidence = '0.8';
    output.nodes[1].outcomes[0].confidence = '0.8';
    output.nodes[1].outcomes[1].confidence = '0.6';
    output.edges[0].confidence = '0.8';

    const validated = validateAiInferenceOutput(output, promptInput);

    expect(validated.nodes[0].layer).toBe(0);
    expect(validated.nodes[1].layer).toBe(1);
    expect(validated.nodes[1].confidence).toBe(0.8);
    expect(validated.edges[0].confidence).toBe(0.8);
  });

  it('rejects duplicate outcome recommendations', () => {
    const promptInput = inferencePromptInput();
    const output = validInferenceOutput(promptInput);
    output.nodes[1].outcomes = [
      { ...output.nodes[1].outcomes[0] },
      { ...output.nodes[1].outcomes[0] },
    ];

    expect(() => validateAiInferenceOutput(output, promptInput)).toThrow(
      'AI output contains duplicate outcome recommendations',
    );
  });

  it('repairs non-root nodes without an incoming edge', () => {
    const promptInput = inferencePromptInput();
    const output = validInferenceOutput(promptInput);
    output.edges = [];

    const validated = validateAiInferenceOutput(output, promptInput);

    expect(validated.edges).toEqual([
      expect.objectContaining({
        sourceClientNodeId: 'root',
        targetClientNodeId: 'candidate_1',
        sourceOutcomeId: promptInput.root.selectedOutcome.outcomeId,
        targetOutcomeId: 'outcome_1',
      }),
    ]);
    expect(validated.warnings).toContain('ai_output_repaired_missing_incoming_edges');
  });

  it('normalizes edges that point backward across graph layers', () => {
    const promptInput = inferencePromptInput();
    const output = validInferenceOutput(promptInput);
    output.edges = [{
      sourceClientNodeId: 'candidate_1',
      targetClientNodeId: 'root',
      sourceOutcomeId: 'outcome_1',
      targetOutcomeId: 'root_outcome',
      relation: 'contradicts',
      confidence: 0.7,
      reason: 'backward edge',
    }];

    const validated = validateAiInferenceOutput(output, promptInput);

    expect(validated.edges).toEqual([
      expect.objectContaining({
        sourceClientNodeId: 'root',
        targetClientNodeId: 'candidate_1',
        sourceOutcomeId: 'root_outcome',
        targetOutcomeId: 'outcome_1',
        reason: 'backward edge Direction normalized by backend to match UI layer order.',
      }),
    ]);
    expect(validated.warnings).toContain('ai_output_reoriented_edges_to_layer_order');
  });

  it('drops same-layer edges while keeping connected lower-to-higher edges', () => {
    const promptInput = inferencePromptInput();
    const secondCandidate = promptInput.candidateMarkets[1];
    const output = validInferenceOutput(promptInput);
    output.nodes.push({
      clientNodeId: 'candidate_2',
      marketId: secondCandidate.marketId,
      layer: 1,
      confidence: 0.76,
      impactDirection: 'supports',
      reason: 'second candidate',
      outcomes: secondCandidate.outcomes.map((outcome, index) => ({
        outcomeId: outcome.outcomeId,
        outcomeLabel: outcome.label,
        aiAction: index === 0 ? 'buy' : 'avoid',
        confidence: index === 0 ? 0.76 : 0.56,
        reason: `recommendation ${index}`,
      })),
    });
    output.edges.push(
      {
        sourceClientNodeId: 'root',
        targetClientNodeId: 'candidate_2',
        sourceOutcomeId: promptInput.root.selectedOutcome.outcomeId,
        targetOutcomeId: secondCandidate.outcomes[0].outcomeId,
        relation: 'supports',
        confidence: 0.76,
        reason: 'root to second candidate',
      },
      {
        sourceClientNodeId: 'candidate_1',
        targetClientNodeId: 'candidate_2',
        sourceOutcomeId: 'outcome_1',
        targetOutcomeId: secondCandidate.outcomes[0].outcomeId,
        relation: 'correlates',
        confidence: 0.7,
        reason: 'same layer edge',
      },
    );

    const validated = validateAiInferenceOutput(output, promptInput);

    expect(validated.edges).toHaveLength(2);
    expect(validated.edges.some((edge) => edge.reason === 'same layer edge')).toBe(false);
    expect(validated.warnings).toContain('ai_output_dropped_same_layer_edges');
  });

  it('deduplicates equivalent edges after normalization', () => {
    const promptInput = inferencePromptInput();
    const output = validInferenceOutput(promptInput);
    output.edges.push({
      sourceClientNodeId: 'candidate_1',
      targetClientNodeId: 'root',
      sourceOutcomeId: 'outcome_1',
      targetOutcomeId: 'root_outcome',
      relation: 'supports',
      confidence: 0.7,
      reason: 'backward duplicate edge',
    });

    const validated = validateAiInferenceOutput(output, promptInput);

    expect(validated.edges).toHaveLength(1);
    expect(validated.edges[0]).toEqual(
      expect.objectContaining({
        sourceClientNodeId: 'root',
        targetClientNodeId: 'candidate_1',
        sourceOutcomeId: 'root_outcome',
        targetOutcomeId: 'outcome_1',
        confidence: 0.8,
      }),
    );
    expect(validated.warnings).toContain('ai_output_deduplicated_edges');
    expect(validated.warnings).toContain('ai_output_reoriented_edges_to_layer_order');
  });

  it('validates all provider market references before truncating excess nodes', () => {
    const promptInput = {
      ...inferencePromptInput(),
      settings: {
        depth: 2,
        maxMarketsPerLayer: 1,
        confidenceThreshold: 0.55,
      },
    };
    const output = validInferenceOutput(promptInput);
    output.nodes.push({
      clientNodeId: 'unknown_candidate',
      marketId: 'unknown_market',
      layer: 1,
      confidence: 0.1,
      impactDirection: 'supports',
      reason: 'unknown market should still be rejected',
      outcomes: [
        {
          outcomeId: 'unknown_outcome',
          outcomeLabel: 'Unknown',
          aiAction: 'buy',
          confidence: 0.1,
          reason: 'invalid provider reference',
        },
      ],
    });

    expect(() => validateAiInferenceOutput(output, promptInput)).toThrow('AI output referenced an unknown market');
  });

  it('truncates outputs that exceed maxMarketsPerLayer', () => {
    const promptInput = {
      ...inferencePromptInput(),
      settings: {
        depth: 2,
        maxMarketsPerLayer: 1,
        confidenceThreshold: 0.55,
      },
    };
    const secondCandidate = promptInput.candidateMarkets[1];
    const output = validInferenceOutput(promptInput);
    output.nodes.push({
      clientNodeId: 'candidate_2',
      marketId: secondCandidate.marketId,
      layer: 1,
      confidence: 0.75,
      impactDirection: 'supports',
      reason: 'second candidate',
      outcomes: secondCandidate.outcomes.map((outcome, index) => ({
        outcomeId: outcome.outcomeId,
        outcomeLabel: outcome.label,
        aiAction: index === 0 ? 'buy' : 'avoid',
        confidence: index === 0 ? 0.75 : 0.55,
        reason: `recommendation ${index}`,
      })),
    });
    output.edges.push({
      sourceClientNodeId: 'root',
      targetClientNodeId: 'candidate_2',
      sourceOutcomeId: promptInput.root.selectedOutcome.outcomeId,
      targetOutcomeId: secondCandidate.outcomes[0].outcomeId,
      relation: 'supports',
      confidence: 0.75,
      reason: 'root to second candidate',
    });

    const validated = validateAiInferenceOutput(output, promptInput);

    expect(validated.nodes.map((node) => node.clientNodeId)).toEqual(['root', 'candidate_1']);
    expect(validated.edges.map((edge) => edge.targetClientNodeId)).toEqual(['candidate_1']);
    expect(validated.warnings).toContain('truncated_to_max_markets_per_layer');
  });

  it('rejects non-root confidence values below the requested threshold', () => {
    const promptInput = {
      ...inferencePromptInput(),
      settings: {
        depth: 2,
        maxMarketsPerLayer: 3,
        confidenceThreshold: 0.75,
      },
    };
    const output = validInferenceOutput(promptInput);
    output.nodes[1].confidence = 0.74;

    expect(() => validateAiInferenceOutput(output, promptInput)).toThrow('AI output confidence is below threshold');
  });
});

function inferencePromptInput(): InferencePromptInput {
  return {
    root: {
      marketId: 'root_market',
      marketQuestion: 'Will the root event happen?',
      selectedOutcome: {
        outcomeId: 'root_outcome',
        label: 'Yes',
        tokenId: 'root_token',
        price: 0.5,
        bestBid: null,
        bestAsk: null,
        lastTradePrice: null,
      },
    },
    settings: {
      depth: 2,
      maxMarketsPerLayer: 3,
      confidenceThreshold: 0.55,
    },
    candidateMarkets: [
      candidateMarket('market_1', ['outcome_1', 'outcome_2']),
      candidateMarket('market_2', ['outcome_3', 'outcome_4']),
    ],
  };
}

function candidateMarket(marketId: string, outcomeIds: string[]): InferenceMarketInput {
  return {
    marketId,
    eventTitle: 'Fixture Event',
    question: `Question for ${marketId}?`,
    description: null,
    rules: null,
    category: 'fixture',
    tags: ['fixture'],
    active: true,
    closed: false,
    acceptingOrders: true,
    enableOrderBook: true,
    orderMinSize: null,
    orderPriceMinTickSize: null,
    bestBid: 0.59,
    bestAsk: 0.61,
    lastTradePrice: 0.6,
    spread: 0.02,
    volume: 100,
    volume24hr: 10,
    liquidity: 50,
    endDate: null,
    outcomes: outcomeIds.map((outcomeId, index) => ({
      outcomeId,
      label: index === 0 ? 'Yes' : 'No',
      tokenId: `${outcomeId}_token`,
      price: index === 0 ? 0.6 : 0.4,
      bestBid: index === 0 ? 0.59 : 0.39,
      bestAsk: index === 0 ? 0.61 : 0.41,
      lastTradePrice: index === 0 ? 0.6 : 0.4,
    })),
  };
}

function validInferenceOutput(input: InferencePromptInput): AiInferenceOutput {
  const candidate = input.candidateMarkets[0];
  return {
    summary: 'valid output',
    warnings: [],
    nodes: [
      {
        clientNodeId: 'root',
        marketId: input.root.marketId,
        layer: 0,
        confidence: 1,
        impactDirection: 'supports',
        reason: 'root',
        outcomes: [
          {
            outcomeId: input.root.selectedOutcome.outcomeId,
            outcomeLabel: input.root.selectedOutcome.label,
            aiAction: 'buy',
            confidence: 1,
            reason: 'root',
          },
        ],
      },
      {
        clientNodeId: 'candidate_1',
        marketId: candidate.marketId,
        layer: 1,
        confidence: 0.8,
        impactDirection: 'supports',
        reason: 'candidate',
        outcomes: candidate.outcomes.map((outcome, index) => ({
          outcomeId: outcome.outcomeId,
          outcomeLabel: outcome.label,
          aiAction: index === 0 ? 'buy' : 'avoid',
          confidence: index === 0 ? 0.8 : 0.6,
          reason: `recommendation ${index}`,
        })),
      },
    ],
    edges: [
      {
        sourceClientNodeId: 'root',
        targetClientNodeId: 'candidate_1',
        sourceOutcomeId: input.root.selectedOutcome.outcomeId,
        targetOutcomeId: candidate.outcomes[0].outcomeId,
        relation: 'supports',
        confidence: 0.8,
        reason: 'root to candidate',
      },
    ],
  };
}
