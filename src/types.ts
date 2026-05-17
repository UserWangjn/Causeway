export type Outcome = 'YES' | 'NO'
export type Language = 'en' | 'zh'
export type ImpactDirection = 'up' | 'down' | 'uncertain'
export type ImpactStrength = 'weak' | 'medium' | 'strong'
export type NodeStatus = 'idle' | 'active' | 'impacted' | 'muted'

export type GraphNode = {
  id: string
  question: string
  outcome: Outcome
  price: number
  category: string
  volume?: number
  status: NodeStatus
}

export type UniverseMarket = {
  id: string
  question: string
  category: string
  eventTitle?: string
  price: number
  volume: number
  slug?: string
  endDate?: string
}

export type GenerationEvent = {
  type: 'root' | 'related' | 'evidence' | 'draft' | 'ai' | 'done' | 'error'
  step: number
  message: string
  data?: {
    root?: UniverseMarket
    markets?: UniverseMarket[]
    evidence?: Array<{
      title: string
      url: string
      source?: string
      published?: string
    }>
    edgeCount?: number
    nodeCount?: number
    aiStatus?: ScenarioPreset['aiStatus']
    aiError?: string | null
  }
  scenario?: ScenarioPreset
}

export type GraphEdge = {
  id: string
  source: string
  target: string
  sourceOutcome: Outcome
  targetOutcome: Outcome
  direction: ImpactDirection
  strength: ImpactStrength
  confidence: number
  deltaRange: [number, number]
  explanation: string
  evidenceUrls: string[]
}

export type ScenarioStep = {
  id: string
  title: string
  sourceNodeId: string
  edgeIds: string[]
  impactedNodeIds: string[]
  narrative: string
}

export type ScenarioPreset = {
  id: string
  title: string
  subtitle: string
  rootNodeId: string
  summary: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  steps: ScenarioStep[]
  source?: 'polymarket-gamma' | 'polymarket-gamma-ai' | 'mock-fallback'
  aiStatus?: 'disabled' | 'refined' | 'failed'
  aiError?: string
}
