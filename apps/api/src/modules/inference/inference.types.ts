export type InferenceOutcomeInput = {
  outcomeId: string;
  label: string;
  tokenId: string;
  price: number | null;
};

export type InferenceMarketInput = {
  marketId: string;
  eventTitle: string | null;
  question: string;
  description: string | null;
  rules: string | null;
  category: string | null;
  tags: string[];
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  volume: number | null;
  liquidity: number | null;
  outcomes: InferenceOutcomeInput[];
};

export type InferencePromptInput = {
  root: {
    marketId: string;
    marketQuestion: string;
    selectedOutcome: InferenceOutcomeInput;
  };
  settings: {
    depth: number;
    maxMarketsPerLayer: number;
    confidenceThreshold: number;
  };
  candidateMarkets: InferenceMarketInput[];
};

export type AiOutcomeRecommendation = {
  outcomeId: string;
  outcomeLabel: string;
  aiAction: 'buy' | 'avoid';
  confidence: number;
  reason: string;
};

export type AiMarketNode = {
  clientNodeId: string;
  marketId: string;
  layer: 0 | 1 | 2 | 3;
  confidence: number;
  impactDirection: 'supports' | 'opposes' | 'unclear';
  reason: string;
  outcomes: AiOutcomeRecommendation[];
};

export type AiEdge = {
  sourceClientNodeId: string;
  targetClientNodeId: string;
  sourceOutcomeId: string;
  targetOutcomeId: string;
  relation: 'causes' | 'supports' | 'hedges' | 'contradicts' | 'correlates';
  confidence: number;
  reason: string;
};

export type AiInferenceOutput = {
  summary: string;
  nodes: AiMarketNode[];
  edges: AiEdge[];
  warnings: string[];
};
