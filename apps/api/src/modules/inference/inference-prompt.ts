import { createHash } from 'crypto';
import type { InferencePromptInput } from './inference.types';

export const MAX_INFERENCE_REPAIR_PREVIOUS_OUTPUT_CHARS = 4_000;
export const MAX_INFERENCE_REPAIR_VALIDATION_ERROR_CHARS = 1_000;

export type InferencePromptRepairContext = {
  previousOutput: unknown;
  validationError: string;
};

export type StructuredAiPrompt = {
  systemPrompt: string;
  userPayload: Record<string, unknown>;
};

export function buildInferenceAiPrompt(
  input: InferencePromptInput,
  repairContext?: InferencePromptRepairContext,
): StructuredAiPrompt {
  return {
    systemPrompt: [
      "You are Causeway's prediction-market causal reasoning engine.",
      'Analyze Polymarket markets only from the structured market data provided by the backend.',
      'Do not invent markets, token IDs, prices, market state, or external facts.',
      'Do not use news, social media, macro data, or world knowledge unless it is explicitly included in the input.',
      'Do not assume outcomes are Yes/No; outcome labels may be teams, ranges, Over/Under, Odd/Even, or arbitrary labels.',
      'Never provide financial advice language. Describe causal reasoning and uncertainty only.',
      'Return only a JSON object that matches the requested Causeway inference output schema.',
      'Do not include markdown, prose, code fences, or fields outside the schema.',
      'Use numeric JSON numbers for layer and confidence values.',
      'Every edge must point from a lower layer node to a higher layer node; never point an edge into the root node.',
    ].join(' '),
    userPayload: {
      task: repairContext
        ? 'Repair the previous Causeway causal graph output so it passes validation. Keep the same intent, but fix schema, references, confidence, and graph rules.'
        : 'Analyze the root Polymarket outcome and candidate markets, then produce a Causeway causal graph.',
      contract: [
        'The root node must have clientNodeId "root", layer 0, the requested root marketId, and only the selected root outcome.',
        'Non-root nodes must use only candidate marketIds from input.candidateMarkets and must have layer 1, 2, or 3.',
        'Every non-root node must include one recommendation for every outcome in that market.',
        'Do not output more than input.settings.maxMarketsPerLayer non-root nodes in any layer.',
        'Do not output non-root nodes with layer greater than input.settings.depth.',
        'Every non-root node confidence, every edge confidence, and every buy recommendation confidence must be greater than or equal to input.settings.confidenceThreshold.',
        'If confidence is below the threshold for a market, omit that non-root node. If confidence is below the threshold for an outcome, mark it avoid.',
        'Prefer active, open, acceptingOrders markets with enableOrderBook, positive liquidity, and usable bid/ask or last-trade data. Mention data gaps in warnings.',
        'Edges are UI graph edges, not free-form causal arrows: sourceClientNodeId must be a lower layer node and targetClientNodeId must be a higher layer node.',
        'The root node may be an edge source but must never be an edge target.',
        'If a candidate market is a cause or indicator for the root hypothesis, still orient the UI edge from root to that candidate node and explain the causal direction in reason.',
        'Do not invent marketId, outcomeId, tokenId, price, or clientNodeId values outside the input and nodes you output.',
        'Reason about specific outcome-to-outcome relationships, not only market titles.',
      ],
      outputShape: inferenceOutputShape(),
      ...(repairContext
        ? {
            repair: {
              validationError: truncateText(
                repairContext.validationError,
                MAX_INFERENCE_REPAIR_VALIDATION_ERROR_CHARS,
              ),
              previousOutput: summarizeRepairPreviousOutput(repairContext.previousOutput),
              instructions: [
                'Return a complete corrected JSON object, not a patch.',
                'Use only marketId and outcomeId values present in input.',
                'Remove any non-root node that cannot be connected from a lower layer node.',
                'Use the previousOutput preview only for diagnosis; the canonical market and outcome IDs are in input.',
              ],
            },
          }
        : {}),
      input,
    },
  };
}

function inferenceOutputShape(): Record<string, unknown> {
  return {
    summary: 'string',
    nodes: [
      {
        clientNodeId: 'string',
        marketId: 'string',
        layer: 'number: 0 | 1 | 2 | 3',
        confidence: 'number between 0 and 1',
        impactDirection: 'supports | opposes | unclear',
        reason: 'string',
        outcomes: [
          {
            outcomeId: 'string',
            outcomeLabel: 'string',
            aiAction: 'buy | avoid',
            confidence: 'number between 0 and 1',
            reason: 'string',
          },
        ],
      },
    ],
    edges: [
      {
        sourceClientNodeId: 'string',
        targetClientNodeId: 'string',
        sourceOutcomeId: 'string',
        targetOutcomeId: 'string',
        relation: 'causes | supports | hedges | contradicts | correlates',
        confidence: 'number between 0 and 1',
        reason: 'string',
      },
    ],
    warnings: ['string'],
  };
}

function summarizeRepairPreviousOutput(value: unknown): Record<string, unknown> {
  const serialized = serializeRepairPreviousOutput(value);
  return {
    kind: Array.isArray(value) ? 'array' : typeof value,
    preview: truncateText(serialized, MAX_INFERENCE_REPAIR_PREVIOUS_OUTPUT_CHARS),
    length: serialized.length,
    truncated: serialized.length > MAX_INFERENCE_REPAIR_PREVIOUS_OUTPUT_CHARS,
    sha256: hashString(serialized),
  };
}

function serializeRepairPreviousOutput(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
}

function hashString(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
