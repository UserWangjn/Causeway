import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  applyNodeChanges,
  useInternalNode,
  type Edge,
  type EdgeProps,
  type InternalNode,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type NodeProps,
  type XYPosition,
} from '@xyflow/react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bitcoin,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  Factory,
  Flame,
  Globe2,
  Info,
  Landmark,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Search,
  Share2,
  ShieldCheck,
  Star,
  Trash2,
  WalletCards,
} from 'lucide-react'

type View = 'network' | 'detail' | 'infer' | 'progress' | 'script' | 'scripts'

type Market = {
  id: string
  slug?: string | null
  title: string
  groupItemTitle?: string | null
  category: string
  categoryKey?: string
  officialCategory?: string | null
  tags?: string[]
  icon: 'landmark' | 'bank' | 'bitcoin' | 'factory' | 'flame' | 'cpu' | 'globe'
  iconUrl?: string | null
  eventId?: string | null
  eventSlug?: string | null
  eventTitle?: string | null
  endDate?: string | null
  description?: string | null
  rules?: string | null
  acceptingOrders?: boolean
  syncedAt?: string | null
  outcomes?: { label: string; price: number | null; tokenId: string | null }[]
  bestBid?: number | null
  bestAsk?: number | null
  lastTradePrice?: number | null
  orderMinSize?: number | null
  tickSize?: number | null
  price: number
  change: number
  volume: string
  volumeValue?: number | null
  liquidity?: number | null
  traders: string
  x: number
  y: number
  tone: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan'
}

type ApiMarketNode = {
  id: string
  slug?: string | null
  title: string
  groupItemTitle?: string | null
  eventId?: string | null
  eventSlug?: string | null
  eventTitle: string | null
  category: string | null
  categoryKey: string | null
  officialCategory: string | null
  tags: string[]
  icon: string | null
  image: string | null
  price: number | null
  volume: number | null
  volume24hr: number | null
  liquidity: number | null
  endDate: string | null
  description: string | null
  rules: string | null
  acceptingOrders: boolean
  outcomes: { label: string; price: number | null; tokenId: string | null }[]
  bestBid?: number | null
  bestAsk?: number | null
  lastTradePrice?: number | null
  orderMinSize?: number | null
  tickSize?: number | null
  syncedAt: string | null
  x: number
  y: number
}

type ApiMarketEdge = {
  id: string
  source: string
  target: string
  relationType: 'tag' | 'event' | 'semantic' | 'price_correlation' | 'ai'
  weight: number
  reason: string
}

type MarketNetworkResponse = {
  data: {
    nodes: ApiMarketNode[]
    edges: ApiMarketEdge[]
    source: string
    generatedAt: string
  }
}

type EventDetail = {
  event: {
    id: string | null
    slug: string | null
    title: string
    category: string | null
    categoryKey: string | null
    officialCategory: string | null
    tags: string[]
    icon: string | null
    image: string | null
    endDate: string | null
    volume: number | null
    volume24hr: number | null
    liquidity: number | null
    description: string | null
    rules: string | null
    marketsCount: number | null
    syncedAt: string | null
  } | null
  markets: ApiMarketNode[]
  source: string
  generatedAt: string
}

type EventDetailResponse = {
  data: EventDetail
}

type PricePoint = {
  t: number
  p: number
}

type PriceHistoryResponse = {
  data: {
    history: Record<string, PricePoint[]>
    source: string
    generatedAt: string
  }
}

type InferenceEvidence = {
  source: string
  title: string
  url?: string
  snippet?: string
  publishedAt?: string | null
}

type InferenceRelatedMarket = {
  id: string
  title: string
  slug?: string | null
  eventTitle?: string | null
  category: string
  price: number | null
  volume: string
  icon?: string | null
  image?: string | null
  confidence: number
  verificationScore?: number
  relation: string
  direction?: string
  impact?: string
  reason?: string
  evidenceSummary?: string
  evidenceIds?: string[]
  checkedSources?: string[]
  evidenceCount?: number
  url?: string
}

type InferenceCausalLink = {
  sourceMarketId?: string | null
  targetMarketId?: string | null
  source: string
  target: string
  direction: 'positive' | 'negative' | 'conditional' | 'unknown' | string
  confidence: number
  impact?: string
  rationale: string
  evidenceSummary?: string
  evidenceIds?: string[]
}

type InferenceScriptLeg = {
  marketId: string
  marketTitle: string
  side: string
  probability?: number | null
  direction: 'positive' | 'negative' | 'conditional' | 'unknown' | string
  impact?: string
  confidence: number
  rationale: string
  orderHint?: string
  evidenceIds?: string[]
}

type InferenceScriptChain = {
  id: string
  title: string
  summary: string
  confidence: number
  expectedReturnHint?: string
  legs: InferenceScriptLeg[]
}

type InferenceScenario = {
  name: string
  probabilityShift: string
  description: string
  signals: string[]
}

type InferenceResult = {
  runId: string
  status: 'completed' | 'fallback' | string
  aiAvailable: boolean
  model: string
  providerBaseUrl?: string | null
  rootMarket?: {
    id?: string
    title?: string
    price?: number | null
    volume?: number | null
    liquidity?: number | null
    endDate?: string | null
  }
  summary: string
  thesis: string
  confidence: number
  causalLinks: InferenceCausalLink[]
  scriptChains?: InferenceScriptChain[]
  scenarios: InferenceScenario[]
  riskFactors: string[]
  evidence: InferenceEvidence[]
  relatedMarkets: InferenceRelatedMarket[]
  excludedMarkets?: { id: string; title?: string; score?: number; reason?: string }[]
  verification?: {
    summary?: string
    candidateCount?: number
    verifiedCount?: number
    excludedCount?: number
    model?: string | null
  }
  logs: string[]
  generatedAt: string
  error?: string | null
}

type InferenceRunResponse = {
  data: InferenceResult
}

type InferenceScope = 'news' | 'markets' | 'social' | 'all'
type InferenceDepth = 1 | 2 | 3
type InferenceModelPreference = 'auto' | 'deepseek-v4-pro' | 'deepseek-v4-flash'
type ConfidenceMode = 'broad' | 'balanced' | 'strict'

type InferenceSettingsState = {
  scope: InferenceScope
  timeRange: 'until_close' | '24h' | '7d' | '30d'
  modelPreference: InferenceModelPreference
  confidenceMode: ConfidenceMode
  depth: InferenceDepth
  confidenceThreshold: number
  includeWebSearch: boolean
}

const defaultInferenceSettings: InferenceSettingsState = {
  scope: 'all',
  timeRange: 'until_close',
  modelPreference: 'auto',
  confidenceMode: 'balanced',
  depth: 2,
  confidenceThreshold: 0.55,
  includeWebSearch: true,
}

type ApiMarketCategory = {
  key: string
  label: string
  count: number
}

type MarketCategoriesResponse = {
  data: {
    categories: ApiMarketCategory[]
    generatedAt: string
    source: string
  }
}

type MarketSearchResult = {
  type: 'market' | 'event' | 'topic'
  id: string
  marketId?: string | null
  eventId?: string | null
  eventSlug?: string | null
  topic?: string | null
  slug?: string | null
  title: string
  subtitle?: string | null
  category?: string | null
  categoryKey?: string | null
  icon?: string | null
  image?: string | null
  price?: number | null
  volume?: number | null
  liquidity?: number | null
  endDate?: string | null
  score: number
  matchedBy: string
}

type MarketSearchResponse = {
  data: {
    results: MarketSearchResult[]
    generatedAt: string
    source: string
  }
}

type MarketNodeRole = 'focus' | 'upstream' | 'downstream' | 'lateral'

type MarketFlowNodeData = {
  market: Market
  role: MarketNodeRole
  isFocus: boolean
  isSelected: boolean
  onIconMouseEnter?: (event: ReactMouseEvent<HTMLElement>, market: Market) => void
  onIconMouseLeave?: () => void
}

type MarketFlowEdgeData = {
  relationType: ApiMarketEdge['relationType']
  weight: number
  reason: string
  strength: 'primary' | 'secondary'
  tone: 'positive' | 'neutral' | 'warning'
}

type MarketFlowNode = Node<MarketFlowNodeData, 'market'>
type MarketFlowEdge = Edge<MarketFlowEdgeData, 'causal'>

type HoverPlacement = 'right' | 'left' | 'bottom' | 'top'

type ScriptRow = {
  title: string
  status: '进行中' | '已完成'
  created: string
  favorite?: boolean
  points: number[]
}

const rootMarket: Market = {
  id: 'trump-2024',
  title: '特朗普赢得2024年大选?',
  category: '政治',
  icon: 'landmark',
  price: 62,
  change: 5,
  volume: '$28.4M',
  traders: '3.2K',
  x: 48,
  y: 46,
  tone: 'blue',
}

const markets: Market[] = [
  rootMarket,
  {
    id: 'congress',
    title: '美国国会选举结果?',
    category: '政治',
    icon: 'bank',
    price: 71,
    change: 4,
    volume: '$15.2M',
    traders: '1.9K',
    x: 38,
    y: 22,
    tone: 'blue',
  },
  {
    id: 'fed',
    title: '美联储降息概率?',
    category: '宏观经济',
    icon: 'landmark',
    price: 68,
    change: 2,
    volume: '$11.8M',
    traders: '1.4K',
    x: 70,
    y: 20,
    tone: 'green',
  },
  {
    id: 'tech',
    title: '美国科技股Q3表现?',
    category: '科技',
    icon: 'cpu',
    price: 57,
    change: 3,
    volume: '$9.8M',
    traders: '1.2K',
    x: 88,
    y: 35,
    tone: 'green',
  },
  {
    id: 'btc',
    title: '比特币突破8万美元?',
    category: '加密货币',
    icon: 'bitcoin',
    price: 41,
    change: -1,
    volume: '$9.3M',
    traders: '943',
    x: 91,
    y: 56,
    tone: 'orange',
  },
  {
    id: 'oil',
    title: '原油价格上涨?',
    category: '商品',
    icon: 'factory',
    price: 31,
    change: -2,
    volume: '$7.6M',
    traders: '816',
    x: 72,
    y: 73,
    tone: 'orange',
  },
  {
    id: 'china',
    title: '比特币与AI板块联动?',
    category: '科技',
    icon: 'cpu',
    price: 27,
    change: -1,
    volume: '$5.1M',
    traders: '642',
    x: 42,
    y: 72,
    tone: 'blue',
  },
  {
    id: 'recession',
    title: '拜登退选概率?',
    category: '政治',
    icon: 'globe',
    price: 37,
    change: 1,
    volume: '$6.9M',
    traders: '902',
    x: 24,
    y: 45,
    tone: 'purple',
  },
  {
    id: 'halving',
    title: '比特币年底走势?',
    category: '加密货币',
    icon: 'bitcoin',
    price: 29,
    change: -3,
    volume: '$4.7M',
    traders: '521',
    x: 25,
    y: 63,
    tone: 'red',
  },
]

const scriptRows: ScriptRow[] = [
  { title: '特朗普赢得2024年大选?', status: '进行中', created: '2024-07-15 14:30', points: [71, 62, 41, 68] },
  { title: '美联储降息影响路径', status: '已完成', created: '2024-07-14 09:15', points: [68, 52, 38, 59] },
  { title: '比特币减半影响分析', status: '已完成', created: '2024-07-12 16:45', points: [57, 63, 47] },
  { title: 'AI 技术突破对市场影响', status: '进行中', created: '2024-07-10 11:20', favorite: true, points: [73, 58, 42, 66] },
  { title: '碳中和政策影响推演', status: '已完成', created: '2024-07-08 15:30', points: [61, 48, 36] },
  { title: '中东局势升级影响分析', status: '已完成', created: '2024-07-07 22:10', points: [65, 54, 39, 62] },
]

const categoryTones: Record<string, Market['tone']> = {
  政治: 'blue',
  politics: 'blue',
  宏观: 'green',
  宏观经济: 'green',
  macro: 'green',
  加密: 'orange',
  加密货币: 'orange',
  crypto: 'orange',
  科技: 'cyan',
  tech: 'cyan',
  体育: 'purple',
  sports: 'purple',
  文化: 'purple',
  娱乐: 'purple',
  entertainment: 'purple',
  其他: 'purple',
  other: 'purple',
}

const fallbackCategories: ApiMarketCategory[] = [
  { key: 'all', label: '全部', count: 0 },
  { key: 'hot', label: '热门', count: 0 },
  { key: 'politics', label: '政治', count: 0 },
  { key: 'macro', label: '宏观', count: 0 },
  { key: 'crypto', label: '加密', count: 0 },
  { key: 'tech', label: '科技', count: 0 },
  { key: 'entertainment', label: '娱乐', count: 0 },
  { key: 'other', label: '其他', count: 0 },
]

function formatCompactMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A'
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '未提供'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '未提供'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatProbability(value: number | null | undefined) {
  return value == null ? '' : `${Math.round(value * 100)}%`
}

function formatMarketPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A'
  if (value > 0 && value < 1) return '<1%'
  if (value % 1 === 0) return `${value}%`
  return `${value.toFixed(1)}%`
}

function formatConfidence(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return 'N/A'
  return `${Math.round(value * 100)}%`
}

function directionLabel(value: string | null | undefined) {
  if (value === 'positive') return '正向'
  if (value === 'negative') return '反向'
  if (value === 'conditional') return '条件'
  return '待判定'
}

function marketSubtitle(market: Market) {
  return [market.category, market.eventTitle, market.officialCategory || market.tags?.[0]]
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ') || 'Polymarket 市场'
}

function marketRuleCopy(market: Market) {
  return market.rules?.trim() || market.description?.trim() || 'Polymarket 未提供详细规则说明。'
}

function marketDescriptionCopy(market: Market) {
  return market.description?.trim() || market.rules?.trim() || '该市场来自 Polymarket，当前没有额外描述。'
}

function marketChangeText(market: Market) {
  if (!market.change) return '0%'
  return `${market.change > 0 ? '+' : ''}${market.change}%`
}

function unitPriceToPercent(price: number | null | undefined) {
  if (price == null || Number.isNaN(price)) return null
  return Math.round(clamp(price, 0, 1) * 100)
}

function formatUnitPercent(price: number | null | undefined) {
  const percent = unitPriceToPercent(price)
  return percent == null ? 'N/A' : `${percent}%`
}

function formatCents(price: number | null | undefined) {
  if (price == null || Number.isNaN(price)) return 'N/A'
  const cents = clamp(price, 0, 1) * 100
  const precision = cents < 1 || cents > 99 || cents % 1 ? 1 : 0
  return `${cents.toFixed(precision)}¢`
}

function getOutcomeRows(market: Market) {
  const sourceOutcomes =
    market.outcomes?.filter((outcome) => outcome.label) ||
    [
      { label: 'Yes', price: market.price / 100, tokenId: null },
      { label: 'No', price: 1 - market.price / 100, tokenId: null },
    ]
  return sourceOutcomes.map((outcome, index) => {
    const price = typeof outcome.price === 'number' ? clamp(outcome.price, 0, 1) : null
    return {
      ...outcome,
      index,
      price,
      yesPrice: price,
      noPrice: price == null ? null : 1 - price,
      percent: unitPriceToPercent(price),
    }
  })
}

function outcomeTone(index: number) {
  return ['blue', 'indigo', 'amber', 'orange', 'green', 'purple'][index % 6]
}

function outcomeTrend(index: number, price: number | null) {
  if (price == null) return 0
  const direction = index % 2 === 0 ? 1 : -1
  return Math.round((price * 18 + index * 3) * direction)
}

function outcomePath(index: number, price: number | null) {
  const base = price == null ? 0.5 : clamp(price, 0.03, 0.97)
  const points = Array.from({ length: 18 }, (_, pointIndex) => {
    const x = 24 + pointIndex * 42
    const wave = Math.sin((pointIndex + 1) * (0.72 + index * 0.08)) * (18 + index * 2)
    const drift = (pointIndex - 8) * (base - 0.5) * -7
    const y = clamp(250 - base * 210 + wave + drift, 24, 268)
    return `${pointIndex === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return points.join(' ')
}

const HISTORY_CHART_LEFT = 36
const HISTORY_CHART_RIGHT = 724
const HISTORY_CHART_TOP = 38
const HISTORY_CHART_BOTTOM = 272

function chartY(price: number, maxPrice: number) {
  const scale = Math.max(0.01, maxPrice)
  return HISTORY_CHART_BOTTOM - (clamp(price, 0, scale) / scale) * (HISTORY_CHART_BOTTOM - HISTORY_CHART_TOP)
}

function chartMaxPrice(points: PricePoint[], prices: Array<number | null | undefined>) {
  const maxValue = Math.max(
    0,
    ...points.map((point) => clamp(point.p, 0, 1)),
    ...prices.map((price) => (price == null ? 0 : clamp(price, 0, 1))),
  )
  if (maxValue <= 0.15) return 0.15
  if (maxValue <= 0.3) return 0.3
  if (maxValue <= 0.45) return 0.45
  if (maxValue <= 0.6) return 0.6
  if (maxValue <= 0.8) return 0.8
  return 1
}

function chartTicks(maxPrice: number) {
  return [maxPrice, maxPrice * 0.75, maxPrice * 0.5, maxPrice * 0.25, 0]
}

function historyPath(points: PricePoint[], minT: number, maxT: number, maxPrice: number) {
  if (points.length < 2) return ''
  const span = Math.max(1, maxT - minT)
  return points
    .map((point, index) => {
      const x = HISTORY_CHART_LEFT + ((point.t - minT) / span) * (HISTORY_CHART_RIGHT - HISTORY_CHART_LEFT)
      const y = chartY(point.p, maxPrice)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function compactHistory(points: PricePoint[]) {
  if (points.length <= 240) return points
  const step = Math.ceil(points.length / 240)
  return points.filter((_, index) => index % step === 0 || index === points.length - 1)
}

function formatToken(tokenId: string | null | undefined) {
  if (!tokenId) return '未提供'
  return `${tokenId.slice(0, 6)}...${tokenId.slice(-6)}`
}

function marketDisplayLabel(market: Market) {
  if (market.groupItemTitle) return market.groupItemTitle
  let label = market.title
  label = label.replace(/^Will\s+/i, '')
  label = label.replace(/\s+be\s+the\s+top\s+grossing\s+movie\s+of\s+2026\??$/i, '')
  label = label.replace(/\s+win\s+on\s+\d{4}-\d{2}-\d{2}\??$/i, '')
  label = label.replace(/\?$/, '')
  return label || market.title
}

function eventToMarket(event: EventDetail['event'], fallback: Market): Market {
  if (!event) return fallback
  const category = event.category || fallback.category
  const categoryKey = event.categoryKey || fallback.categoryKey || category
  return {
    ...fallback,
    id: event.id || fallback.eventId || fallback.id,
    slug: event.slug || fallback.eventSlug || fallback.slug,
    title: event.title || fallback.eventTitle || fallback.title,
    category,
    categoryKey,
    officialCategory: event.officialCategory || fallback.officialCategory,
    tags: event.tags || fallback.tags,
    iconUrl: event.icon || event.image || fallback.iconUrl,
    eventId: event.id || fallback.eventId,
    eventSlug: event.slug || fallback.eventSlug,
    eventTitle: event.title || fallback.eventTitle,
    endDate: event.endDate || fallback.endDate,
    description: event.description || fallback.description,
    rules: event.rules || fallback.rules,
    syncedAt: event.syncedAt || fallback.syncedAt,
    price: fallback.price,
    volume: formatCompactMoney(event.volume),
    volumeValue: event.volume,
    liquidity: event.liquidity,
    traders: event.volume24hr ? formatCompactMoney(event.volume24hr) : fallback.traders,
    tone: categoryTones[categoryKey] || categoryTones[category] || fallback.tone,
  }
}

const FLOW_NODE_WIDTH = 168
const FLOW_NODE_HEIGHT = 94
const FLOW_FOCUS_WIDTH = 260
const FLOW_FOCUS_HEIGHT = 122
const FLOW_CANVAS_WIDTH = 1600
const FLOW_CANVAS_HEIGHT = 760
const FLOW_CENTER = { x: FLOW_CANVAS_WIDTH / 2, y: 382 }
const MAX_FLOW_NODES = 25
const HOVER_CARD_WIDTH = 360
const HOVER_CARD_HEIGHT = 390
const HOVER_CARD_GAP = 24
const HOVER_CARD_MARGIN = 18

function getNodeSize(role: MarketNodeRole) {
  return role === 'focus'
    ? { width: FLOW_FOCUS_WIDTH, height: FLOW_FOCUS_HEIGHT }
    : { width: FLOW_NODE_WIDTH, height: FLOW_NODE_HEIGHT }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function arcAngles(count: number, start: number, end: number) {
  if (count <= 0) return []
  if (count === 1) return [(start + end) / 2]
  const step = (end - start) / (count - 1)
  return Array.from({ length: count }, (_, index) => start + step * index)
}

function ellipsePoint(angle: number, radiusX: number, radiusY: number): XYPosition {
  const radians = (angle * Math.PI) / 180
  return {
    x: FLOW_CENTER.x + Math.cos(radians) * radiusX,
    y: FLOW_CENTER.y + Math.sin(radians) * radiusY,
  }
}

function nodeCenterToPosition(center: XYPosition, role: MarketNodeRole): XYPosition {
  const size = getNodeSize(role)
  return {
    x: clamp(center.x - size.width / 2, 44, FLOW_CANVAS_WIDTH - size.width - 44),
    y: clamp(center.y - size.height / 2, 52, FLOW_CANVAS_HEIGHT - size.height - 52),
  }
}

function getNodeCenter(node: MarketFlowNode) {
  const size = getNodeSize(node.data.role)
  return {
    x: node.position.x + size.width / 2,
    y: node.position.y + size.height / 2,
  }
}

function positionVector(position: Position) {
  if (position === Position.Left) return { x: -1, y: 0 }
  if (position === Position.Right) return { x: 1, y: 0 }
  if (position === Position.Top) return { x: 0, y: -1 }
  return { x: 0, y: 1 }
}

function positionFromVector(dx: number, dy: number) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? Position.Right : Position.Left
  return dy >= 0 ? Position.Bottom : Position.Top
}

function getFloatingNodeCenter(node: InternalNode<MarketFlowNode>) {
  const role = node.data.role
  const measuredWidth = node.measured.width || getNodeSize(role).width
  return {
    x: node.internals.positionAbsolute.x + measuredWidth / 2,
    y: node.internals.positionAbsolute.y + 29,
  }
}

function getFloatingNodeRadius() {
  return 33
}

function getFloatingAnchor(
  node: InternalNode<MarketFlowNode>,
  targetCenter: XYPosition,
) {
  const center = getFloatingNodeCenter(node)
  const dx = targetCenter.x - center.x
  const dy = targetCenter.y - center.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const radius = getFloatingNodeRadius()

  return {
    x: center.x + (dx / distance) * radius,
    y: center.y + (dy / distance) * radius,
    position: positionFromVector(dx, dy),
  }
}

function getFloatingEdgePath(sourceNode: InternalNode<MarketFlowNode>, targetNode: InternalNode<MarketFlowNode>) {
  const sourceCenter = getFloatingNodeCenter(sourceNode)
  const targetCenter = getFloatingNodeCenter(targetNode)
  const sourceAnchor = getFloatingAnchor(sourceNode, targetCenter)
  const targetAnchor = getFloatingAnchor(targetNode, sourceCenter)
  const distance = Math.hypot(targetAnchor.x - sourceAnchor.x, targetAnchor.y - sourceAnchor.y)
  const curve = clamp(distance * 0.34, 52, 210)
  const sourceTangent = positionVector(sourceAnchor.position)
  const targetTangent = positionVector(targetAnchor.position)
  const c1 = {
    x: sourceAnchor.x + sourceTangent.x * curve,
    y: sourceAnchor.y + sourceTangent.y * curve,
  }
  const c2 = {
    x: targetAnchor.x + targetTangent.x * curve,
    y: targetAnchor.y + targetTangent.y * curve,
  }

  return `M ${sourceAnchor.x},${sourceAnchor.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${targetAnchor.x},${targetAnchor.y}`
}

function rectsOverlap(
  rect: { left: number; top: number; right: number; bottom: number },
  target: { left: number; top: number; right: number; bottom: number },
  padding = 0,
) {
  return !(
    rect.right + padding <= target.left ||
    rect.left - padding >= target.right ||
    rect.bottom + padding <= target.top ||
    rect.top - padding >= target.bottom
  )
}

function getOverflowPenalty(
  rect: { left: number; top: number; right: number; bottom: number },
  width: number,
  height: number,
) {
  return (
    Math.max(0, HOVER_CARD_MARGIN - rect.left) +
    Math.max(0, HOVER_CARD_MARGIN - rect.top) +
    Math.max(0, rect.right - width + HOVER_CARD_MARGIN) +
    Math.max(0, rect.bottom - height + HOVER_CARD_MARGIN)
  )
}

function clampHoverOrigin(x: number, y: number, width: number, height: number) {
  return {
    x: clamp(x, HOVER_CARD_MARGIN, Math.max(HOVER_CARD_MARGIN, width - HOVER_CARD_WIDTH - HOVER_CARD_MARGIN)),
    y: clamp(y, HOVER_CARD_MARGIN, Math.max(HOVER_CARD_MARGIN, height - HOVER_CARD_HEIGHT - HOVER_CARD_MARGIN)),
  }
}

function getHoverCardPlacement(containerBounds: DOMRect, nodeBounds: DOMRect) {
  const node = {
    left: nodeBounds.left - containerBounds.left,
    top: nodeBounds.top - containerBounds.top,
    right: nodeBounds.right - containerBounds.left,
    bottom: nodeBounds.bottom - containerBounds.top,
  }
  const centerX = (node.left + node.right) / 2
  const centerY = (node.top + node.bottom) / 2
  const candidates: { placement: HoverPlacement; x: number; y: number }[] = [
    { placement: 'right', x: node.right + HOVER_CARD_GAP, y: centerY - HOVER_CARD_HEIGHT / 2 },
    { placement: 'left', x: node.left - HOVER_CARD_GAP - HOVER_CARD_WIDTH, y: centerY - HOVER_CARD_HEIGHT / 2 },
    { placement: 'bottom', x: centerX - HOVER_CARD_WIDTH / 2, y: node.bottom + HOVER_CARD_GAP },
    { placement: 'top', x: centerX - HOVER_CARD_WIDTH / 2, y: node.top - HOVER_CARD_GAP - HOVER_CARD_HEIGHT },
  ]

  const scored = candidates.map((candidate, index) => {
    const origin = clampHoverOrigin(candidate.x, candidate.y, containerBounds.width, containerBounds.height)
    const rect = {
      left: origin.x,
      top: origin.y,
      right: origin.x + HOVER_CARD_WIDTH,
      bottom: origin.y + HOVER_CARD_HEIGHT,
    }
    const overflow = getOverflowPenalty(rect, containerBounds.width, containerBounds.height)
    const overlapPenalty = rectsOverlap(rect, node, 14) ? 10_000 : 0
    const movementPenalty = Math.abs(origin.x - candidate.x) * 0.18 + Math.abs(origin.y - candidate.y) * 0.18
    return {
      ...candidate,
      ...origin,
      score: overlapPenalty + overflow * 12 + movementPenalty + index,
    }
  })

  return scored.sort((left, right) => left.score - right.score)[0]
}

function clampCenterForRole(center: XYPosition, role: MarketNodeRole): XYPosition {
  const size = getNodeSize(role)
  return {
    x: clamp(center.x, 44 + size.width / 2, FLOW_CANVAS_WIDTH - 44 - size.width / 2),
    y: clamp(center.y, 52 + size.height / 2, FLOW_CANVAS_HEIGHT - 52 - size.height / 2),
  }
}

function relaxNodeCenters(
  centers: Map<string, XYPosition>,
  roles: Map<string, MarketNodeRole>,
  pinnedId: string,
) {
  const relaxed = new Map(centers)
  const ids = Array.from(relaxed.keys())

  for (let pass = 0; pass < 72; pass += 1) {
    let moved = false
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        const leftId = ids[left]
        const rightId = ids[right]
        const leftRole = roles.get(leftId) || 'lateral'
        const rightRole = roles.get(rightId) || 'lateral'
        const leftCenter = relaxed.get(leftId)!
        const rightCenter = relaxed.get(rightId)!
        const leftSize = getNodeSize(leftRole)
        const rightSize = getNodeSize(rightRole)
        const dx = rightCenter.x - leftCenter.x
        const dy = rightCenter.y - leftCenter.y
        const minX = (leftSize.width + rightSize.width) / 2 + 34
        const minY = (leftSize.height + rightSize.height) / 2 + 24

        if (Math.abs(dx) >= minX || Math.abs(dy) >= minY) continue

        const overlapX = minX - Math.abs(dx)
        const overlapY = minY - Math.abs(dy)
        const directionX = dx === 0 ? (left % 2 === 0 ? 1 : -1) : Math.sign(dx)
        const directionY = dy === 0 ? (right % 2 === 0 ? 1 : -1) : Math.sign(dy)
        const shift = overlapX < overlapY
          ? { x: (overlapX + 6) * directionX, y: 0 }
          : { x: 0, y: (overlapY + 6) * directionY }

        if (leftId === pinnedId) {
          relaxed.set(rightId, clampCenterForRole({ x: rightCenter.x + shift.x, y: rightCenter.y + shift.y }, rightRole))
        } else if (rightId === pinnedId) {
          relaxed.set(leftId, clampCenterForRole({ x: leftCenter.x - shift.x, y: leftCenter.y - shift.y }, leftRole))
        } else {
          relaxed.set(leftId, clampCenterForRole({ x: leftCenter.x - shift.x / 2, y: leftCenter.y - shift.y / 2 }, leftRole))
          relaxed.set(rightId, clampCenterForRole({ x: rightCenter.x + shift.x / 2, y: rightCenter.y + shift.y / 2 }, rightRole))
        }
        moved = true
      }
    }
    if (!moved) break
  }

  return relaxed
}

function getHandlePair(source: XYPosition, target: XYPosition) {
  const dx = target.x - source.x
  const dy = target.y - source.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 'out-right', targetHandle: 'in-left' }
      : { sourceHandle: 'out-left', targetHandle: 'in-right' }
  }
  return dy >= 0
    ? { sourceHandle: 'out-bottom', targetHandle: 'in-top' }
    : { sourceHandle: 'out-top', targetHandle: 'in-bottom' }
}

function edgeTone(relationType: ApiMarketEdge['relationType'], weight: number): MarketFlowEdgeData['tone'] {
  if (relationType === 'event' || weight >= 0.7) return 'positive'
  if (relationType === 'price_correlation') return 'warning'
  return 'neutral'
}

function trimNodeTitle(value: string, max = 58) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized
}

function getRelationEdges(visibleMarkets: Market[], edges: ApiMarketEdge[]) {
  const marketById = new Map(visibleMarkets.map((market) => [market.id, market]))
  const validEdges = edges
    .filter((edge) => marketById.has(edge.source) && marketById.has(edge.target) && edge.source !== edge.target)
    .sort((left, right) => right.weight - left.weight)

  if (validEdges.length) return validEdges

  return visibleMarkets.slice(1).map((market, index) => {
    const previous = visibleMarkets[Math.max(0, index - 1)]
    const source = index % 2 === 0 ? previous : market
    const target = index % 2 === 0 ? market : previous
    return {
      id: `fallback-${source.id}-${target.id}`,
      source: source.id,
      target: target.id,
      relationType: index % 3 === 0 ? 'event' : 'semantic',
      weight: Math.max(0.35, 0.72 - index * 0.035),
      reason: 'Fallback local topology edge',
    } satisfies ApiMarketEdge
  })
}

function buildMarketFlowGraph(
  visibleMarkets: Market[],
  edges: ApiMarketEdge[],
  focusId: string | undefined,
  manualPositions: Record<string, XYPosition>,
) {
  const marketById = new Map(visibleMarkets.map((market) => [market.id, market]))
  const activeFocusId = focusId && marketById.has(focusId) ? focusId : visibleMarkets[0]?.id
  const focusMarket = activeFocusId ? marketById.get(activeFocusId) : undefined
  if (!focusMarket) return { nodes: [] as MarketFlowNode[], edges: [] as MarketFlowEdge[] }

  const relationEdges = getRelationEdges(visibleMarkets, edges)
  const directEdges = relationEdges
    .filter((edge) => edge.source === focusMarket.id || edge.target === focusMarket.id)
    .sort((left, right) => right.weight - left.weight)
  const included = new Set<string>([focusMarket.id])
  const upstreamIds: string[] = []
  const downstreamIds: string[] = []
  const lateralIds: string[] = []
  const requiredEdgeIds = new Set<string>()
  const roleById = new Map<string, MarketNodeRole>([[focusMarket.id, 'focus']])

  const addId = (list: string[], id: string, role: MarketNodeRole, edgeId?: string) => {
    if (included.has(id) || !marketById.has(id) || included.size >= MAX_FLOW_NODES) return
    included.add(id)
    roleById.set(id, role)
    if (edgeId) requiredEdgeIds.add(edgeId)
    list.push(id)
  }

  directEdges
    .filter((edge) => edge.target === focusMarket.id)
    .slice(0, 5)
    .forEach((edge) => addId(upstreamIds, edge.source, 'upstream', edge.id))
  directEdges
    .filter((edge) => edge.source === focusMarket.id)
    .slice(0, 6)
    .forEach((edge) => addId(downstreamIds, edge.target, 'downstream', edge.id))

  const frontier = new Set([focusMarket.id, ...upstreamIds, ...downstreamIds])
  relationEdges.forEach((edge) => {
    if (included.size >= MAX_FLOW_NODES) return
    if (frontier.has(edge.source) && !included.has(edge.target)) addId(lateralIds, edge.target, 'lateral', edge.id)
    if (frontier.has(edge.target) && !included.has(edge.source)) addId(lateralIds, edge.source, 'lateral', edge.id)
  })
  relationEdges.forEach((edge) => {
    if (included.size >= MAX_FLOW_NODES) return
    const hasSource = included.has(edge.source)
    const hasTarget = included.has(edge.target)
    if (hasSource && !hasTarget) addId(lateralIds, edge.target, 'lateral', edge.id)
    if (hasTarget && !hasSource) addId(lateralIds, edge.source, 'lateral', edge.id)
    if (!hasSource && !hasTarget && included.size <= MAX_FLOW_NODES - 2) {
      addId(lateralIds, edge.source, 'lateral', edge.id)
      addId(lateralIds, edge.target, 'lateral', edge.id)
    }
  })

  const centerById = new Map<string, XYPosition>()
  centerById.set(focusMarket.id, FLOW_CENTER)

  arcAngles(upstreamIds.length, 138, 222).forEach((angle, index) => {
    centerById.set(upstreamIds[index], ellipsePoint(angle, 520, 282))
  })
  arcAngles(downstreamIds.length, -48, 48).forEach((angle, index) => {
    centerById.set(downstreamIds[index], ellipsePoint(angle, 520, 282))
  })

  const upperLateralIds = lateralIds.filter((_, index) => index % 2 === 0)
  const lowerLateralIds = lateralIds.filter((_, index) => index % 2 === 1)
  arcAngles(upperLateralIds.length, -155, -25).forEach((angle, index) => {
    centerById.set(upperLateralIds[index], ellipsePoint(angle, 630, 312))
  })
  arcAngles(lowerLateralIds.length, 25, 155).forEach((angle, index) => {
    centerById.set(lowerLateralIds[index], ellipsePoint(angle, 630, 312))
  })
  const relaxedCenters = relaxNodeCenters(centerById, roleById, focusMarket.id)

  const nodes: MarketFlowNode[] = Array.from(included).map((id) => {
    const market = marketById.get(id)!
    const role = roleById.get(id) || 'lateral'
    const position = manualPositions[id] || nodeCenterToPosition(relaxedCenters.get(id) || FLOW_CENTER, role)
    return {
      id,
      type: 'market',
      position,
      data: { market, role, isFocus: role === 'focus', isSelected: role === 'focus' },
      draggable: true,
      selectable: true,
    }
  })

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const includedEdges = relationEdges.filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))
  const selectedEdgeIds = new Set<string>()
  const incidentCount = new Map<string, number>()
  const registerEdge = (edge: ApiMarketEdge) => {
    if (selectedEdgeIds.has(edge.id)) return
    selectedEdgeIds.add(edge.id)
    incidentCount.set(edge.source, (incidentCount.get(edge.source) || 0) + 1)
    incidentCount.set(edge.target, (incidentCount.get(edge.target) || 0) + 1)
  }

  includedEdges
    .filter((edge) => edge.source === focusMarket.id || edge.target === focusMarket.id || requiredEdgeIds.has(edge.id))
    .forEach(registerEdge)

  includedEdges.forEach((edge) => {
    if (selectedEdgeIds.size >= 24) return
    if (selectedEdgeIds.has(edge.id)) return
    const sourceCount = incidentCount.get(edge.source) || 0
    const targetCount = incidentCount.get(edge.target) || 0
    if (sourceCount < 3 || targetCount < 3 || edge.weight >= 0.72) registerEdge(edge)
  })

  nodes.forEach((node) => {
    if (node.id === focusMarket.id || (incidentCount.get(node.id) || 0) > 0) return
    const backupEdge = includedEdges.find((edge) => edge.source === node.id || edge.target === node.id)
    if (backupEdge) registerEdge(backupEdge)
  })

  const flowEdges = includedEdges
    .filter((edge) => selectedEdgeIds.has(edge.id))
    .map<MarketFlowEdge>((edge) => {
      const sourceNode = nodeById.get(edge.source)!
      const targetNode = nodeById.get(edge.target)!
      const sourceCenter = getNodeCenter(sourceNode)
      const targetCenter = getNodeCenter(targetNode)
      const handles = getHandlePair(sourceCenter, targetCenter)
      const primary = edge.source === focusMarket.id || edge.target === focusMarket.id
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        type: 'causal',
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        data: {
          relationType: edge.relationType,
          weight: edge.weight,
          reason: edge.reason,
          strength: primary ? 'primary' : 'secondary',
          tone: edgeTone(edge.relationType, edge.weight),
        },
      }
    })

  return { nodes, edges: flowEdges }
}

function apiNodeToMarket(node: ApiMarketNode, index: number): Market {
  const category = node.category || '其他'
  const categoryKey = node.categoryKey || category
  const price = node.price == null ? 0 : Math.round(node.price * 100)
  return {
    id: node.id,
    slug: node.slug,
    title: node.title,
    groupItemTitle: node.groupItemTitle,
    category,
    categoryKey,
    officialCategory: node.officialCategory,
    tags: node.tags || [],
    icon: categoryKey === 'crypto' || category === '加密' || category === '加密货币'
      ? 'bitcoin'
      : categoryKey === 'tech' || category === '科技'
        ? 'cpu'
        : categoryKey === 'macro' || category === '宏观'
          ? 'bank'
          : 'landmark',
    iconUrl: node.icon || node.image,
    eventId: node.eventId,
    eventSlug: node.eventSlug,
    eventTitle: node.eventTitle,
    endDate: node.endDate,
    description: node.description,
    rules: node.rules,
    acceptingOrders: node.acceptingOrders,
    syncedAt: node.syncedAt,
    outcomes: node.outcomes,
    bestBid: node.bestBid,
    bestAsk: node.bestAsk,
    lastTradePrice: node.lastTradePrice,
    orderMinSize: node.orderMinSize,
    tickSize: node.tickSize,
    price,
    change: 0,
    volume: formatCompactMoney(node.volume),
    volumeValue: node.volume,
    liquidity: node.liquidity,
    traders: node.volume24hr ? formatCompactMoney(node.volume24hr) : '24h N/A',
    x: node.x,
    y: node.y,
    tone: categoryTones[categoryKey] || categoryTones[category] || (index % 5 === 0 ? 'purple' : index % 3 === 0 ? 'orange' : index % 2 === 0 ? 'green' : 'blue'),
  }
}

function App() {
  const [view, setView] = useState<View>('network')
  const [selectedMarket, setSelectedMarket] = useState<Market>(rootMarket)
  const [inferenceResult, setInferenceResult] = useState<InferenceResult | null>(null)
  const [inferenceSettings, setInferenceSettings] = useState<InferenceSettingsState>(defaultInferenceSettings)
  const activeNav = view === 'scripts' ? 'scripts' : view === 'progress' ? 'monitor' : 'network'

  const openMarketDetail = useCallback((market: Market) => {
    setSelectedMarket(market)
    setInferenceResult(null)
    setView('detail')
  }, [])

  const startInference = useCallback((settings: InferenceSettingsState) => {
    setInferenceSettings(settings)
    setInferenceResult(null)
    setView('progress')
  }, [])

  return (
    <div className="app-shell">
      <Header activeNav={activeNav} onNavigate={setView} />
      <main className={view === 'network' ? 'app-main network-main' : 'app-main'}>
        {view === 'network' && <MarketNetwork onConfirmMarket={openMarketDetail} />}
        {view === 'detail' && <MarketDetail market={selectedMarket} onBack={() => setView('network')} onInfer={() => setView('infer')} />}
        {view === 'infer' && <InferenceSettings initialSettings={inferenceSettings} market={selectedMarket} onBack={() => setView('detail')} onStart={startInference} />}
        {view === 'progress' && (
          <InferenceProgress
            market={selectedMarket}
            onBack={() => setView('infer')}
            onDone={() => setView('script')}
            onResult={setInferenceResult}
            result={inferenceResult}
            settings={inferenceSettings}
          />
        )}
        {view === 'script' && <CausalScript market={selectedMarket} onBack={() => setView('progress')} onScripts={() => setView('scripts')} result={inferenceResult} />}
        {view === 'scripts' && <MyScripts onNew={() => setView('infer')} onOpen={() => setView('script')} />}
      </main>
    </div>
  )
}

function Header({ activeNav, onNavigate }: { activeNav: string; onNavigate: (view: View) => void }) {
  const navItems = [
    { id: 'network', label: '市场网络', view: 'network' as View },
    { id: 'discover', label: '发现', view: 'infer' as View },
    { id: 'monitor', label: '监控', view: 'progress' as View },
    { id: 'scripts', label: '我的脚本', view: 'scripts' as View },
  ]

  return (
    <header className="topbar">
      <button className="brand-button" type="button" onClick={() => onNavigate('network')}>
        <CausewayLogo />
        <span>Causeway</span>
      </button>
      <nav className="topnav" aria-label="Primary">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={activeNav === item.id ? 'nav-button active' : 'nav-button'}
            type="button"
            onClick={() => onNavigate(item.view)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="header-actions">
        <button className="icon-button" aria-label="搜索" type="button">
          <Search size={20} />
        </button>
        <button className="icon-button has-dot" aria-label="通知" type="button">
          <Bell size={20} />
        </button>
        <button className="cash-pill" type="button">
          <WalletCards size={16} />
          Cash unavailable
        </button>
        <div className="avatar">CW</div>
      </div>
    </header>
  )
}

function MarketNetwork({ onConfirmMarket }: { onConfirmMarket: (market: Market) => void }) {
  const searchAreaRef = useRef<HTMLDivElement | null>(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [categories, setCategories] = useState<ApiMarketCategory[]>(fallbackCategories)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSearch, setSelectedSearch] = useState<MarketSearchResult | null>(null)
  const [searchResults, setSearchResults] = useState<MarketSearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [networkMarkets, setNetworkMarkets] = useState<Market[]>(markets)
  const [networkEdges, setNetworkEdges] = useState<ApiMarketEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/markets/categories', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<MarketCategoriesResponse>
      })
      .then((payload) => {
        if (payload.data.categories.length) setCategories(payload.data.categories)
      })
      .catch(() => {
        if (!controller.signal.aborted) setCategories(fallbackCategories)
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof globalThis.Node) || !searchAreaRef.current?.contains(target)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    const trimmedQuery = searchQuery.trim()
    if (selectedSearch && trimmedQuery === selectedSearch.title) {
      return
    }
    if (trimmedQuery.length < 2) {
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearchLoading(true)
      const params = new URLSearchParams({ q: trimmedQuery, limit: '8' })
      fetch(`/api/markets/search?${params.toString()}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          return response.json() as Promise<MarketSearchResponse>
        })
        .then((payload) => {
          setSearchResults(payload.data.results)
          setSearchOpen(true)
        })
        .catch((fetchError: Error) => {
          if (fetchError.name !== 'AbortError') {
            setSearchResults([])
            setSearchOpen(false)
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false)
        })
    }, 180)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [searchQuery, selectedSearch])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ limit: '25' })
    const trimmedQuery = searchQuery.trim()
    if (selectedSearch?.type === 'market' && selectedSearch.marketId) {
      params.set('focusMarketId', selectedSearch.marketId)
    } else if (selectedSearch?.type === 'event' && (selectedSearch.eventId || selectedSearch.eventSlug)) {
      params.set('eventId', selectedSearch.eventId || selectedSearch.eventSlug || '')
    } else if (selectedSearch?.type === 'topic' && (selectedSearch.topic || selectedSearch.categoryKey)) {
      params.set('topic', selectedSearch.topic || selectedSearch.categoryKey || '')
    } else {
      if (activeCategory !== 'all') params.set('categoryKey', activeCategory)
      if (trimmedQuery) params.set('q', trimmedQuery)
    }
    fetch(`/api/markets/network?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<MarketNetworkResponse>
      })
      .then((payload) => {
        const nodes = payload.data.nodes.map(apiNodeToMarket)
        if (nodes.length) {
          setNetworkMarkets(nodes)
          setNetworkEdges(payload.data.edges)
        }
        setError(null)
      })
      .catch((fetchError: Error) => {
        if (fetchError.name !== 'AbortError') {
          setError(fetchError.message)
          setNetworkMarkets(markets)
          setNetworkEdges([])
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [activeCategory, searchQuery, selectedSearch])

  const chooseSearchResult = useCallback((result: MarketSearchResult) => {
    setSelectedSearch(result)
    setSearchQuery(result.title)
    setSearchOpen(false)
    setLoading(true)
  }, [])

  const clearSearch = useCallback(() => {
    setSelectedSearch(null)
    setSearchQuery('')
    setSearchResults([])
    setSearchOpen(false)
    setLoading(true)
  }, [])

  return (
    <section className="page page-network">
      <div className="search-row">
        <div className="search-area" ref={searchAreaRef}>
          <div className="searchbox">
            <Search size={18} />
            <input
              aria-label="搜索市场、事件或主题"
              onChange={(event) => {
                const nextValue = event.target.value
                setSelectedSearch(null)
                setLoading(true)
                setSearchQuery(nextValue)
                if (nextValue.trim().length < 2) {
                  setSearchResults([])
                  setSearchOpen(false)
                  setSearchLoading(false)
                }
              }}
              onFocus={() => {
                if (searchResults.length) setSearchOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && searchResults[0]) chooseSearchResult(searchResults[0])
                if (event.key === 'Escape') setSearchOpen(false)
              }}
              placeholder="搜索市场、事件、主题或粘贴 Polymarket 链接..."
              type="text"
              value={searchQuery}
            />
            {searchQuery ? (
              <button className="search-clear" type="button" aria-label="清空搜索" onClick={clearSearch}>
                ×
              </button>
            ) : null}
          </div>
          {searchOpen && (searchLoading || searchResults.length) ? (
            <SearchPopover
              loading={searchLoading}
              onSelect={chooseSearchResult}
              query={searchQuery}
              results={searchResults}
            />
          ) : null}
        </div>
      </div>
      <CategoryChips
        active={activeCategory}
        categories={categories}
        onChange={(category) => {
          setLoading(true)
          setActiveCategory(category)
        }}
      />
      <div className="network-stage">
        <NetworkMap edges={networkEdges} loading={loading} markets={networkMarkets} onConfirmMarket={onConfirmMarket} />
        {error ? <div className="network-error">后端数据暂不可用，正在显示本地示例图谱：{error}</div> : null}
      </div>
    </section>
  )
}

function MarketDetail({ market, onBack, onInfer }: { market: Market; onBack: () => void; onInfer: () => void }) {
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ marketId: market.id })
    fetch(`/api/events/detail?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<EventDetailResponse>
      })
      .then((payload) => setEventDetail(payload.data))
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setEventDetail(null)
      })
    return () => controller.abort()
  }, [market.id])

  const eventMarkets = useMemo(
    () => eventDetail?.markets.map(apiNodeToMarket) || [],
    [eventDetail],
  )
  const displayMarket = eventMarkets.length > 1 ? eventToMarket(eventDetail?.event || null, market) : market
  const detailMarkets = eventMarkets.length > 1 ? eventMarkets : [market]
  const ruleCopy = marketRuleCopy(displayMarket)
  const primaryMarket = [...detailMarkets].sort((a, b) => b.price - a.price || (b.volumeValue || 0) - (a.volumeValue || 0))[0] || market
  return (
    <section className="page market-detail-page">
      <BackButton onClick={onBack} />
      <div className="market-detail-layout">
        <div className="market-detail-content">
          <div className="market-page-head">
            <MarketIcon market={displayMarket} size="large" />
            <div>
              <div className="market-page-meta">
                <span>{displayMarket.officialCategory || displayMarket.category}</span>
                {eventMarkets.length > 1 ? <span>{detailMarkets.length} 个盘口</span> : displayMarket.eventTitle ? <span>{displayMarket.eventTitle}</span> : null}
              </div>
              <h1>{displayMarket.title}</h1>
            </div>
            <div className="market-head-actions">
              <button className="outline-button square" type="button" aria-label="收藏">
                <Star size={18} />
              </button>
              <button className="outline-button" type="button">
                <Share2 size={17} /> 分享
              </button>
            </div>
          </div>

          <Card className="market-live-card">
            <div className="market-live-strip">
              <div>
                <span>{eventMarkets.length > 1 ? '领先盘口' : '当前概率'}</span>
                <strong>{primaryMarket.price}%</strong>
                <em className={primaryMarket.change >= 0 ? 'green-text' : 'red-text'}>{eventMarkets.length > 1 ? marketDisplayLabel(primaryMarket) : marketChangeText(primaryMarket)}</em>
              </div>
              <div>
                <span>成交量</span>
                <strong>{displayMarket.volume}</strong>
              </div>
              <div>
                <span>流动性</span>
                <strong>{formatCompactMoney(displayMarket.liquidity)}</strong>
              </div>
              <div>
                <span>结束时间</span>
                <strong>{formatDate(displayMarket.endDate)}</strong>
              </div>
            </div>
            <MarketPriceChart eventMarkets={detailMarkets} market={displayMarket} />
            <MarketOrderBook eventMarkets={detailMarkets} loading={!eventDetail} market={displayMarket} />
          </Card>
        </div>

        <aside className="market-detail-side">
          <Card className="market-side-card">
            <SectionHeader title="市场描述" />
            <div className="market-rule-copy">
              <p>{marketDescriptionCopy(displayMarket)}</p>
              {ruleCopy !== marketDescriptionCopy(displayMarket) ? <p>{ruleCopy}</p> : null}
            </div>
          </Card>
          <Card className="market-side-card">
            <SectionHeader title="市场信息" />
            <InfoTable
              rows={[
                ['市场 ID', market.id],
                ['事件', displayMarket.eventTitle || '未提供'],
                ['到期时间', formatDate(displayMarket.endDate)],
                ['类别', displayMarket.category],
                ['来源', 'Polymarket'],
                ['合约类型', detailMarkets.length > 1 ? 'Event 多盘口' : '二元事件'],
                ['交易状态', detailMarkets.some((item) => item.acceptingOrders !== false) ? '可交易' : '暂停接单'],
                ['最小下单', market.orderMinSize ? `${market.orderMinSize}` : '未提供'],
                ['最小报价单位', market.tickSize ? `${market.tickSize}` : '未提供'],
                ['同步时间', formatDate(displayMarket.syncedAt)],
              ]}
            />
          </Card>
          <Card className="market-side-card">
            <SectionHeader title="相关市场" />
            <RelatedMarketList currentMarket={market} />
          </Card>
        </aside>
      </div>
      <button className="primary-action" type="button" onClick={onInfer}>
        <BrainCircuit size={20} /> 设定作为推演节点
      </button>
    </section>
  )
}

function scopeLabel(scope: InferenceScope) {
  return {
    news: '相关新闻',
    markets: '相关市场',
    social: '社交媒体',
    all: '全部',
  }[scope]
}

function timeRangeLabel(range: InferenceSettingsState['timeRange'], market: Market) {
  return {
    until_close: `至市场结束：${formatDate(market.endDate)}`,
    '24h': '最近 24 小时',
    '7d': '最近 7 天',
    '30d': '最近 30 天',
  }[range]
}

function modelPreferenceLabel(model: InferenceModelPreference) {
  return {
    auto: 'DeepSeek v4 Pro / Flash',
    'deepseek-v4-pro': 'DeepSeek v4 Pro',
    'deepseek-v4-flash': 'DeepSeek v4 Flash',
  }[model]
}

function confidenceModeLabel(mode: ConfidenceMode) {
  return {
    broad: '更广覆盖',
    balanced: '平衡（推荐）',
    strict: '高置信',
  }[mode]
}

function estimateInference(settings: InferenceSettingsState) {
  const scopeCost = settings.scope === 'all' ? 12 : settings.scope === 'markets' ? 5 : 8
  const depthCost = settings.depth * 5
  const modelCost = settings.modelPreference === 'deepseek-v4-flash' ? 3 : 8
  const minutes = settings.modelPreference === 'deepseek-v4-flash' ? '1-2 分钟' : settings.depth === 3 ? '3-5 分钟' : '2-3 分钟'
  return { minutes, points: scopeCost + depthCost + modelCost }
}

function InferenceSettings({
  initialSettings,
  market,
  onBack,
  onStart,
}: {
  initialSettings: InferenceSettingsState
  market: Market
  onBack: () => void
  onStart: (settings: InferenceSettingsState) => void
}) {
  const [settings, setSettings] = useState<InferenceSettingsState>(initialSettings)
  const updateSettings = useCallback((patch: Partial<InferenceSettingsState>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])
  const selectConfidenceMode = useCallback((mode: ConfidenceMode) => {
    updateSettings({
      confidenceMode: mode,
      confidenceThreshold: mode === 'broad' ? 0.35 : mode === 'strict' ? 0.7 : 0.55,
    })
  }, [updateSettings])
  const estimate = estimateInference(settings)
  const scopeOptions: Array<[InferenceScope, string, string]> = [
    ['news', '相关新闻', '新闻报道和媒体'],
    ['markets', '相关市场', 'Polymarket 市场'],
    ['social', '社交媒体', '社交讨论和情绪'],
    ['all', '全部', '所有可用数据源'],
  ]
  return (
    <section className="page">
      <BackButton onClick={onBack} />
      <PageTitle title="AI 推演设置" subtitle="配置推演参数，AI 将为您分析事件的潜在影响。" />
      <div className="content-grid settings-grid">
        <Card className="span-8 settings-panel">
          <SectionHeader title="根节点市场" />
          <div className="root-market-card">
            <MarketIcon market={market} size="medium" />
            <div>
              <h3>{market.title}</h3>
              <p>{marketSubtitle(market)}</p>
            </div>
            <strong>{market.price}%</strong>
            <span className={market.change >= 0 ? 'green-text' : 'red-text'}>{marketChangeText(market)}</span>
            <div className="mini-stat">
              <b>{market.volume}</b>
              <span>成交量</span>
            </div>
            <div className="mini-stat">
              <b>{formatCompactMoney(market.liquidity)}</b>
              <span>流动性</span>
            </div>
          </div>
          <Divider />
          <SectionHeader title="推演范围" note="选择要纳入分析的数据源范围。" />
          <div className="option-grid four">
            {scopeOptions.map(([scope, title, subtitle], index) => (
              <button
                className={settings.scope === scope ? 'option-card selected' : 'option-card'}
                key={scope}
                type="button"
                onClick={() => updateSettings({ scope, includeWebSearch: scope !== 'markets' })}
              >
                <span className="option-icon">{index + 1}</span>
                <b>{title}</b>
                <small>{subtitle}</small>
              </button>
            ))}
          </div>
          <Divider />
          <div className="form-grid">
            <label className="field">
              <span>时间周期</span>
              <select value={settings.timeRange} onChange={(event) => updateSettings({ timeRange: event.target.value as InferenceSettingsState['timeRange'] })}>
                <option value="until_close">至市场结束</option>
                <option value="24h">最近 24 小时</option>
                <option value="7d">最近 7 天</option>
                <option value="30d">最近 30 天</option>
              </select>
              <small>{timeRangeLabel(settings.timeRange, market)}</small>
            </label>
            <label className="field">
              <span>AI 模型</span>
              <select value={settings.modelPreference} onChange={(event) => updateSettings({ modelPreference: event.target.value as InferenceModelPreference })}>
                <option value="auto">自动：v4 Pro 优先，Flash 兜底</option>
                <option value="deepseek-v4-pro">DeepSeek v4 Pro</option>
                <option value="deepseek-v4-flash">DeepSeek v4 Flash</option>
              </select>
              <small>{settings.modelPreference === 'deepseek-v4-flash' ? '速度更快，适合快速预览' : '优先使用推理模型，适合正式推演'}</small>
            </label>
            <label className="field">
              <span>置信度偏好</span>
              <select value={settings.confidenceMode} onChange={(event) => selectConfidenceMode(event.target.value as ConfidenceMode)}>
                <option value="broad">更广覆盖</option>
                <option value="balanced">平衡（推荐）</option>
                <option value="strict">高置信</option>
              </select>
              <small>{confidenceModeLabel(settings.confidenceMode)} · 阈值 {settings.confidenceThreshold.toFixed(2)}</small>
            </label>
          </div>
          <SectionHeader title="推演层数" note="控制 AI 生成的解释和洞察的详细程度。" />
          <div className="segmented">
            {[1, 2, 3].map((depth) => (
              <button className={settings.depth === depth ? 'active' : ''} key={depth} type="button" onClick={() => updateSettings({ depth: depth as InferenceDepth })}>{depth} 层</button>
            ))}
          </div>
          <div className="range-block">
            <div className="range-label">
              <span>置信度阈值</span>
              <b>{settings.confidenceThreshold.toFixed(2)}</b>
            </div>
            <input
              aria-label="置信度阈值"
              className="confidence-slider"
              max="0.85"
              min="0.1"
              onChange={(event) => updateSettings({ confidenceThreshold: Number(event.target.value) })}
              step="0.05"
              type="range"
              value={settings.confidenceThreshold}
            />
            <div className="range-track">
              <span style={{ width: `${(settings.confidenceThreshold / 0.85) * 100}%` }} />
            </div>
            <div className="range-scale">
              <span>更广覆盖</span>
              <span>平衡</span>
              <span>高置信</span>
            </div>
          </div>
          <div className="estimate-strip">
            <span>
              <Bot size={18} /> 预计处理时间：{estimate.minutes}
            </span>
            <span>
              <ShieldCheck size={18} /> 预计消耗积分：{estimate.points} 积分
            </span>
          </div>
          <button className="primary-action inside" type="button" onClick={() => onStart(settings)}>
            <Play size={18} /> 启动 AI 推演
          </button>
        </Card>
        <div className="side-stack">
          <Card>
            <SectionHeader title="推演设置预览" note="以下是您将要运行的推演配置摘要。" />
            <PreviewList market={market} settings={settings} />
          </Card>
          <Card>
            <SectionHeader title="预期分析内容" />
            <Checklist
              items={[
                '直接影响的相关市场变化',
                '中长期因果链路与传导路径',
                '社交媒体情绪与观点变化',
                '关键事件节点与时间线',
                '风险因素与不确定性分析',
              ]}
            />
          </Card>
          <Card className="tip-card">
            <SectionHeader title="使用小贴士" />
            <ul>
              <li>范围越广，发现的潜在影响越多，但耗时越长。</li>
              <li>建议使用 30%-50% 强度进行首次探索。</li>
              <li>推演结果将基于历史数据和 AI 推理生成。</li>
            </ul>
          </Card>
        </div>
      </div>
    </section>
  )
}

function InferenceProgress({
  market,
  onBack,
  onDone,
  onResult,
  result,
  settings,
}: {
  market: Market
  onBack: () => void
  onDone: () => void
  onResult: (result: InferenceResult) => void
  result: InferenceResult | null
  settings: InferenceSettingsState
}) {
  const steps = ['已选择根节点', '候选市场召回', '逐市场证据核实', 'AI 关联度打分', '生成因果脚本']
  const [loading, setLoading] = useState(!result)
  const [error, setError] = useState<string | null>(null)
  const hasCurrentResult = result?.rootMarket?.id === market.id
  const isComplete = hasCurrentResult && !error
  const progress = hasCurrentResult ? 100 : error ? 100 : loading ? 62 : 35
  const currentStep = hasCurrentResult ? 5 : error ? 3 : loading ? 3 : 1

  useEffect(() => {
    if (result?.rootMarket?.id === market.id) {
      return
    }
    const controller = new AbortController()
    fetch('/api/inference/run', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        marketId: market.id,
        settings,
      }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<InferenceRunResponse>
      })
      .then((payload) => {
        onResult(payload.data)
      })
      .catch((fetchError: Error) => {
        if (fetchError.name !== 'AbortError') setError(fetchError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [market.id, onResult, result?.rootMarket?.id, settings])

  return (
    <section className="page">
      <BackButton onClick={onBack} />
      <PageTitle
        title={hasCurrentResult ? 'AI 推演已完成' : 'AI 推演进行中...'}
        subtitle={`正在基于「${market.title}」核实相关市场并构建因果链条。`}
      />
      <div className="progress-steps">
        {steps.map((step, index) => {
          const done = isComplete || index < currentStep - 1
          const current = !isComplete && index === currentStep - 1
          return (
          <div className={done ? 'step done' : current ? 'step current' : 'step'} key={step}>
            <div className="step-circle">{done ? <CheckCircle2 size={26} /> : index + 1}</div>
            <strong>{step}</strong>
            <span>{done ? '已完成' : current ? '处理中' : `等待中`}</span>
          </div>
        )})}
      </div>
      <div className="global-progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-caption">
        <span>{hasCurrentResult ? '推演完成' : error ? '推演异常' : '推演中...'} <b>{progress}%</b></span>
        <span>{result?.model ? `模型：${result.model}` : 'DeepSeek 正在核实候选市场与外部信息'}</span>
      </div>
      {error ? <div className="status-note error">推演请求失败：{error}</div> : null}
      {result?.status === 'fallback' ? <div className="status-note warning">当前 AI 调用不可用，已使用本地市场数据生成结构化推演。{result.error ? `原因：${result.error}` : null}</div> : null}
      <div className="content-grid progress-grid">
        <Card>
          <SectionHeader
            title="AI 核实后的相关市场"
            note={result?.verification ? `候选 ${result.verification.candidateCount || 0} · 保留 ${result.verification.verifiedCount || result.relatedMarkets.length} · 排除 ${result.verification.excludedCount || 0}` : undefined}
          />
          <DiscoveryTable market={market} relatedMarkets={result?.relatedMarkets} />
          <button className="link-button" type="button">
            共 {result?.relatedMarkets.length || 0} 个已核实市场 <ArrowRight size={15} />
          </button>
        </Card>
        <Card>
          <SectionHeader title="实时推演日志" />
          <LogList logs={result?.logs} loading={loading && !hasCurrentResult} />
        </Card>
      </div>
      <Card>
        <SectionHeader title="当前推演信息" />
        <div className="info-strip-grid">
          {[ 
            ['根节点市场', market.title],
            ['推演深度', `${settings.depth} 阶关联`],
            ['时间范围', timeRangeLabel(settings.timeRange, market)],
            ['分析维度', scopeLabel(settings.scope)],
            ['AI 模型', result?.model || 'DeepSeek v4 Pro'],
          ].map(([label, value]) => (
            <div className="info-item" key={label}>
              <div className="info-icon">
                <Info size={18} />
              </div>
              <span>{label}</span>
              <b>{value}</b>
            </div>
        ))}
        </div>
        <div className="soft-note">{result?.verification?.summary || result?.summary || '提示：AI 会综合 Polymarket 盘口、相关市场、新闻和社交信息生成因果推演。'}</div>
      </Card>
      <button className="floating-next" type="button" onClick={onDone} disabled={!hasCurrentResult}>
        查看已生成脚本 <ArrowRight size={18} />
      </button>
    </section>
  )
}

function CausalScript({
  market,
  onBack,
  onScripts,
  result,
}: {
  market: Market
  onBack: () => void
  onScripts: () => void
  result: InferenceResult | null
}) {
  return (
    <section className="page">
      <BackButton onClick={onBack} />
      <div className="script-header">
        <PageTitle
          title="因果脚本"
          subtitle={result?.thesis || `基于 AI 分析的因果剧本链，展示「${market.title}」发生后可能影响的真实市场盘口。`}
        />
        <div className="script-actions">
          <button className="outline-button" type="button">
            <Download size={17} /> 导出图谱
          </button>
          <button className="outline-button" type="button">
            <Share2 size={17} /> 分享
          </button>
        </div>
      </div>
      <div className="tabbar">
        <button className="active" type="button">图谱视图</button>
        <button type="button">脚本详情</button>
      </div>
      <div className="content-grid script-grid">
        <Card className="script-map-card">
          <CausalMap market={market} result={result} />
        </Card>
        <Card>
          <SectionHeader title="因果链路摘要" />
          <p className="body-copy">{result?.summary || '基于当前市场价格、成交量和结构化因果模型，AI 识别出以下主要影响路径及逻辑关系。'}</p>
          <SummaryList market={market} result={result} />
          <div className="soft-note">以上为 AI 基于当前数据与模型的推演结果，不构成任何投资建议，市场有风险，决策需谨慎。</div>
        </Card>
      </div>
      <Card className="script-footer-card">
        <div className="footer-meta">
          <span><BrainCircuit size={16} /> 推演模型：{result?.model || 'DeepSeek / local-fallback'}</span>
          <span><Globe2 size={16} /> 数据来源：Polymarket / 新闻搜索 / 相关市场</span>
          <span><Activity size={16} /> 推演时间：{formatDateTime(result?.generatedAt)}</span>
          <span><Bot size={16} /> 置信度：{formatConfidence(result?.confidence)}</span>
        </div>
        <div className="footer-actions">
          <button className="outline-button" type="button" onClick={onScripts}>保存到我的脚本</button>
          <button className="primary-button" type="button"><RotateCw size={17} /> 重新推演</button>
        </div>
      </Card>
    </section>
  )
}

function MyScripts({ onNew, onOpen }: { onNew: () => void; onOpen: () => void }) {
  return (
    <section className="page">
      <div className="scripts-headline">
        <PageTitle title="我的脚本" subtitle="管理和回顾您的事件推演脚本与分析历史。" />
        <button className="primary-button" type="button" onClick={onNew}>
          <Plus size={17} /> 新建推演
        </button>
      </div>
      <div className="stats-row">
        {[
          ['全部脚本', '28', '较昨日 +3', 'blue'],
          ['进行中', '6', '较昨日 +1', 'orange'],
          ['已完成', '17', '较昨日 +2', 'green'],
          ['收藏', '5', '较昨日 +1', 'purple'],
        ].map(([label, value, note, tone]) => (
          <Card className="stat-card" key={label}>
            <span className={`stat-icon ${tone}`}>{value === '6' ? <Play size={19} /> : value === '17' ? <CheckCircle2 size={19} /> : <Star size={19} />}</span>
            <div>
              <span>{label}</span>
              <b>{value}</b>
              <small>{note}</small>
            </div>
          </Card>
        ))}
      </div>
      <div className="scripts-toolbar">
        <div className="tabbar inline">
          <button className="active" type="button">全部</button>
          <button type="button">进行中</button>
          <button type="button">已完成</button>
          <button type="button">收藏</button>
        </div>
        <div className="searchbox narrow">
          <Search size={17} />
          <span>搜索脚本名称、关键词...</span>
        </div>
        <button className="outline-button" type="button">最新创建</button>
      </div>
      <div className="script-list">
        {scriptRows.map((row) => (
          <button className="script-row" key={row.title} type="button" onClick={onOpen}>
            <MarketIcon market={markets[row.points.length]} size="small" />
            <div className="script-row-title">
              <b>{row.title}</b>
              {row.favorite ? <Star className="starred" size={17} fill="currentColor" /> : <Star size={17} />}
              <span>创建时间：{row.created}</span>
            </div>
            <span className={row.status === '进行中' ? 'status-badge running' : 'status-badge done'}>{row.status}</span>
            <MiniPath values={row.points} />
            <div className="row-actions">
              <ExternalLink size={18} />
              <Pencil size={18} />
              <Share2 size={18} />
              <Trash2 size={18} />
            </div>
          </button>
        ))}
      </div>
      <div className="pagination">共 28 条 <button type="button">1</button><span>2</span><span>3</span><span>下一页</span></div>
    </section>
  )
}

function FlowHandle({ id, position, type }: { id: string; position: Position; type: 'source' | 'target' }) {
  return <Handle className={`flow-handle ${id}`} id={id} isConnectable={false} position={position} type={type} />
}

function MarketFlowNodeView({ data }: NodeProps<MarketFlowNode>) {
  const { market, role, isFocus, isSelected, onIconMouseEnter, onIconMouseLeave } = data
  return (
    <div className={`flow-market-node ${role}${isFocus ? ' focus' : ''}${isSelected ? ' selected' : ''}`}>
      <FlowHandle id="in-left" position={Position.Left} type="target" />
      <FlowHandle id="out-left" position={Position.Left} type="source" />
      <FlowHandle id="in-right" position={Position.Right} type="target" />
      <FlowHandle id="out-right" position={Position.Right} type="source" />
      <FlowHandle id="in-top" position={Position.Top} type="target" />
      <FlowHandle id="out-top" position={Position.Top} type="source" />
      <FlowHandle id="in-bottom" position={Position.Bottom} type="target" />
      <FlowHandle id="out-bottom" position={Position.Bottom} type="source" />
      <span
        className="flow-node-icon-target"
        onMouseEnter={(event) => onIconMouseEnter?.(event, market)}
        onMouseLeave={onIconMouseLeave}
      >
        <MarketIcon market={market} size="small" />
      </span>
      <div className="flow-node-copy">
        <b>{trimNodeTitle(market.title, isFocus ? 76 : 46)}</b>
        <em>{market.price}%</em>
      </div>
    </div>
  )
}

function CausalFlowEdgeView(props: EdgeProps<MarketFlowEdge>) {
  const sourceNode = useInternalNode<MarketFlowNode>(props.source)
  const targetNode = useInternalNode<MarketFlowNode>(props.target)
  const edgePath = sourceNode && targetNode
    ? getFloatingEdgePath(sourceNode, targetNode)
    : `M ${props.sourceX},${props.sourceY} L ${props.targetX},${props.targetY}`
  const tone = props.data?.tone || 'neutral'
  const strength = props.data?.strength || 'secondary'
  return (
    <g className={`flow-edge ${tone} ${strength}`}>
      <BaseEdge className="flow-edge-base" id={props.id} markerEnd={props.markerEnd} path={edgePath} />
      {strength === 'primary' ? <path className="flow-edge-pulse" d={edgePath} /> : null}
    </g>
  )
}

const nodeTypes = { market: MarketFlowNodeView }
const edgeTypes = { causal: CausalFlowEdgeView }
const reactFlowFitViewOptions = { padding: 0.2 }
const reactFlowProOptions = { hideAttribution: true }

function applyFocusSelection(
  nodes: MarketFlowNode[],
  edges: MarketFlowEdge[],
  selectedFocusId: string | undefined,
) {
  const selectedId = selectedFocusId && nodes.some((node) => node.id === selectedFocusId)
    ? selectedFocusId
    : nodes.find((node) => node.data.isFocus)?.id

  return {
    nodes: nodes.map((node) => ({
      ...node,
      selected: node.id === selectedId,
      data: {
        ...node.data,
        isSelected: node.id === selectedId,
      },
    })),
    edges: edges.map((edge) => {
      const related = selectedId ? edge.source === selectedId || edge.target === selectedId : edge.data?.strength === 'primary'
      return {
        ...edge,
        data: edge.data
          ? {
              ...edge.data,
              strength: related ? 'primary' : 'secondary',
            }
          : edge.data,
      }
    }),
  }
}

function NetworkMap({
  edges,
  loading,
  markets: graphMarkets,
  onConfirmMarket,
}: {
  edges: ApiMarketEdge[]
  loading: boolean
  markets: Market[]
  onConfirmMarket: (market: Market) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hoverCloseTimerRef = useRef<number | null>(null)
  const [hoveredMarket, setHoveredMarket] = useState<Market | null>(null)
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null)
  const [hoverPlacement, setHoverPlacement] = useState<HoverPlacement>('right')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const visibleMarkets = useMemo(() => (graphMarkets.length ? graphMarkets : markets).slice(0, MAX_FLOW_NODES), [graphMarkets])
  const layoutFocusId = visibleMarkets[0]?.id
  const selectedFocusId = selectedId && visibleMarkets.some((market) => market.id === selectedId) ? selectedId : layoutFocusId
  const graph = useMemo(
    () => buildMarketFlowGraph(visibleMarkets, edges, layoutFocusId, {}),
    [layoutFocusId, edges, visibleMarkets],
  )
  const graphKey = useMemo(
    () => `${layoutFocusId || 'empty'}:${visibleMarkets.map((market) => market.id).join('|')}:${edges.map((edge) => edge.id).join('|')}`,
    [layoutFocusId, edges, visibleMarkets],
  )

  const clearHoverCloseTimer = useCallback(() => {
    if (hoverCloseTimerRef.current != null) {
      window.clearTimeout(hoverCloseTimerRef.current)
      hoverCloseTimerRef.current = null
    }
  }, [])

  const closeHoverCard = useCallback(() => {
    setHoveredMarket(null)
    setHoverPoint(null)
  }, [])

  const scheduleHoverClose = useCallback(() => {
    clearHoverCloseTimer()
    hoverCloseTimerRef.current = window.setTimeout(closeHoverCard, 220)
  }, [clearHoverCloseTimer, closeHoverCard])

  useEffect(() => () => clearHoverCloseTimer(), [clearHoverCloseTimer])

  const updateHoverPoint = useCallback((event: ReactMouseEvent<HTMLElement>, market: Market) => {
    clearHoverCloseTimer()
    const bounds = containerRef.current?.getBoundingClientRect()
    if (!bounds) return
    const nodeBounds = event.currentTarget.getBoundingClientRect()
    const placement = getHoverCardPlacement(bounds, nodeBounds)
    setHoveredMarket(market)
    setHoverPlacement(placement.placement)
    setHoverPoint({ x: placement.x, y: placement.y })
  }, [clearHoverCloseTimer])

  const handleIconMouseEnter = useCallback(
    (event: ReactMouseEvent<HTMLElement>, market: Market) => updateHoverPoint(event, market),
    [updateHoverPoint],
  )

  const handleIconMouseLeave = useCallback(() => {
    scheduleHoverClose()
  }, [scheduleHoverClose])

  const handleNodeClick = useCallback<NodeMouseHandler<MarketFlowNode>>(
    (_, node) => {
      if (selectedId === node.id) {
        onConfirmMarket(node.data.market)
        return
      }
      setSelectedId(node.id)
    },
    [onConfirmMarket, selectedId],
  )

  const graphWithHover = useMemo(
    () => ({
      nodes: graph.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onIconMouseEnter: handleIconMouseEnter,
          onIconMouseLeave: handleIconMouseLeave,
        },
      })),
      edges: graph.edges,
    }),
    [graph, handleIconMouseEnter, handleIconMouseLeave],
  )

  const hoverStyle: CSSProperties | undefined = hoverPoint ? { left: hoverPoint.x, top: hoverPoint.y } : undefined

  return (
    <div className="network-map flow-network-map" ref={containerRef}>
      <NetworkFlowCanvas
        key={graphKey}
        graph={graphWithHover}
        selectedFocusId={selectedFocusId}
        onNodeClick={handleNodeClick}
      />
      {hoveredMarket ? (
        <MarketHoverCard
          market={hoveredMarket}
          placement={hoverPlacement}
          style={hoverStyle}
          onMouseEnter={clearHoverCloseTimer}
          onMouseLeave={handleIconMouseLeave}
        />
      ) : null}
      {loading ? <div className="network-loading">正在从 SQLite / Polymarket 同步市场网络...</div> : null}
      <div className="legend">
        <span><i className="dot blue" />政治</span>
        <span><i className="dot green" />宏观经济</span>
        <span><i className="dot orange" />加密货币</span>
        <span><i className="line solid" />强相关</span>
        <span><i className="line dashed" />中等相关</span>
      </div>
    </div>
  )
}

function NetworkFlowCanvas({
  graph,
  selectedFocusId,
  onNodeClick,
}: {
  graph: { nodes: MarketFlowNode[]; edges: MarketFlowEdge[] }
  selectedFocusId: string | undefined
  onNodeClick: NodeMouseHandler<MarketFlowNode>
}) {
  const [flowNodes, setFlowNodes] = useState<MarketFlowNode[]>(() => graph.nodes)
  const draggingRef = useRef(false)
  const renderedGraph = useMemo(
    () => applyFocusSelection(flowNodes, graph.edges, selectedFocusId),
    [flowNodes, graph.edges, selectedFocusId],
  )

  const onNodesChange = useCallback((changes: NodeChange<MarketFlowNode>[]) => {
    setFlowNodes((currentNodes) => applyNodeChanges(changes, currentNodes) as MarketFlowNode[])
  }, [])

  const handleNodeClick = useCallback<NodeMouseHandler<MarketFlowNode>>(
    (event, node) => {
      if (draggingRef.current) return
      onNodeClick(event, node)
    },
    [onNodeClick],
  )

  const handleNodeDragStart = useCallback(() => {
    draggingRef.current = true
  }, [])

  const handleNodeDragStop = useCallback(() => {
    window.setTimeout(() => {
      draggingRef.current = false
    }, 0)
  }, [])

  return (
    <ReactFlow
      colorMode="light"
      edges={renderedGraph.edges}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={reactFlowFitViewOptions}
      maxZoom={1.28}
      minZoom={0.5}
      nodeOrigin={[0, 0]}
      nodeTypes={nodeTypes}
      nodes={renderedGraph.nodes}
      nodesConnectable={false}
      nodesDraggable
      onNodeClick={handleNodeClick}
      onNodeDragStart={handleNodeDragStart}
      onNodeDragStop={handleNodeDragStop}
      onNodesChange={onNodesChange}
      panOnDrag
      panOnScroll
      proOptions={reactFlowProOptions}
      zoomOnDoubleClick={false}
    >
      <Background color="rgba(226, 235, 247, 0.62)" gap={92} size={1} />
      <Controls position="bottom-right" showInteractive={false} />
    </ReactFlow>
  )
}

function scriptTone(direction: string | null | undefined, confidence: number | null | undefined): 'green' | 'orange' | 'red' | 'purple' {
  if (direction === 'negative') return 'red'
  if (direction === 'conditional') return 'orange'
  if ((confidence || 0) < 0.35) return 'purple'
  return 'green'
}

function scriptSideTone(side: string | null | undefined) {
  const normalized = (side || '').toLowerCase()
  if (normalized.includes('no')) return 'red'
  if (normalized.includes('观察') || normalized.includes('watch')) return 'muted'
  return 'green'
}

function scriptFallbackChains(market: Market, result: InferenceResult | null): InferenceScriptChain[] {
  const relatedById = new Map((result?.relatedMarkets || []).map((item) => [item.id, item]))
  const linkChains: InferenceScriptChain[] = (result?.causalLinks || [])
    .flatMap((link, index) => {
      const target = link.targetMarketId ? relatedById.get(link.targetMarketId) : undefined
      if (!target) return []
      return [{
        id: `fallback_chain_${index + 1}`,
        title: `${directionLabel(link.direction)}：${trimNodeTitle(target.title, 26)}`,
        summary: link.rationale || target.reason || '根节点发生后，该盘口可能出现联动重定价。',
        confidence: link.confidence,
        expectedReturnHint: '按当前盘口方向加入交易草稿前，仍需确认实时深度和滑点。',
        legs: [{
          marketId: target.id,
          marketTitle: target.title,
          side: link.direction === 'negative' ? 'Buy No' : 'Buy Yes',
          probability: target.price,
          direction: link.direction,
          impact: link.impact,
          confidence: link.confidence,
          rationale: link.rationale || target.reason || target.evidenceSummary || 'AI 已核实该市场与根节点有关联。',
          orderHint: link.direction === 'negative' ? 'Buy No' : 'Buy Yes',
          evidenceIds: link.evidenceIds || target.evidenceIds || [],
        }],
      }]
    })
  if (linkChains.length) return linkChains.slice(0, 4)
  const related = (result?.relatedMarkets || []).slice(0, 4)
  if (related.length) {
    return related.map((item, index) => ({
      id: `related_chain_${index + 1}`,
      title: `链路 ${index + 1}：${trimNodeTitle(item.title, 28)}`,
      summary: item.reason || item.evidenceSummary || '该市场已通过相关性核实，可作为根节点发生后的观察链路。',
      confidence: item.verificationScore || item.confidence,
      expectedReturnHint: '该链路由相关市场自动编排，交易前需复核实时盘口。',
      legs: [{
        marketId: item.id,
        marketTitle: item.title,
        side: item.direction === 'negative' ? 'Buy No' : 'Buy Yes',
        probability: item.price,
        direction: item.direction || 'unknown',
        impact: item.impact,
        confidence: item.verificationScore || item.confidence,
        rationale: item.reason || item.evidenceSummary || 'AI 已核实该市场与根节点有关联。',
        orderHint: item.direction === 'negative' ? 'Buy No' : 'Buy Yes',
        evidenceIds: item.evidenceIds || [],
      }],
    }))
  }
  return [{
    id: 'pending_chain',
    title: '等待 AI 生成剧本链',
    summary: `推演完成后，这里会展示「${market.title}」发生后影响哪些真实 Polymarket 盘口。`,
    confidence: 0.5,
    expectedReturnHint: '暂无可执行盘口。',
    legs: [],
  }]
}

function CausalMap({ market, result }: { market: Market; result: InferenceResult | null }) {
  const relatedById = useMemo(() => new Map((result?.relatedMarkets || []).map((item) => [item.id, item])), [result])
  const chains = useMemo(() => {
    const apiChains = (result?.scriptChains || []).filter((chain) => chain.legs?.length)
    return (apiChains.length ? apiChains : scriptFallbackChains(market, result)).slice(0, 4)
  }, [market, result])
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null)

  const selectedChain = chains.find((chain) => chain.id === selectedChainId) || chains[0]
  const activeChainId = selectedChain?.id || null
  const chainCount = Math.max(1, chains.length)
  const branchXs = chains.map((_, index) => (chainCount === 1 ? 500 : 120 + (760 / (chainCount - 1)) * index))

  return (
    <div className="causal-map script-chain-map">
      <div className="script-map-head">
        <span>根因事件</span>
        <div>
          <span><i className="line green" />正向影响</span>
          <span><i className="line red" />负向影响</span>
          <span><i className="line orange" />条件传导</span>
        </div>
      </div>
      <div className="script-root-card">
        <MarketIcon market={market} size="medium" />
        <div>
          <small>根节点市场</small>
          <b>{market.title}</b>
          <strong>{market.price}% <span>{formatConfidence(result?.confidence)}</span></strong>
          <em>同步于 {formatDate(market.syncedAt)}</em>
        </div>
      </div>
      <svg className="script-chain-lines" viewBox="0 0 1000 310" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <marker id="script-chain-arrow" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
            <path d="M0,0 L8,4 L0,8 Z" />
          </marker>
        </defs>
        {chains.map((chain, index) => {
          const firstLeg = chain.legs[0]
          const tone = scriptTone(firstLeg?.direction, chain.confidence)
          const targetX = branchXs[index]
          return (
            <path
              className={`${tone}${chain.id === activeChainId ? ' selected' : ''}`}
              d={`M500 92 C500 160, ${targetX} 128, ${targetX} 246`}
              key={chain.id}
              markerEnd="url(#script-chain-arrow)"
            />
          )
        })}
      </svg>
      <div className="script-chain-lanes" style={{ '--chain-count': chainCount } as CSSProperties}>
        {chains.map((chain, index) => {
          const firstLeg = chain.legs[0]
          const tone = scriptTone(firstLeg?.direction, chain.confidence)
          const selected = chain.id === activeChainId
          return (
            <button
              className={`script-chain-lane ${tone}${selected ? ' selected' : ''}`}
              key={chain.id}
              onClick={() => setSelectedChainId(chain.id)}
              type="button"
            >
              <div className="script-chain-title">
                <span>{index + 1}</span>
                <b>{chain.title}</b>
                <strong>{formatConfidence(chain.confidence)}</strong>
              </div>
              <p>{chain.summary}</p>
              <div className="script-leg-stack">
                {chain.legs.map((leg, legIndex) => {
                  const related = relatedById.get(leg.marketId)
                  const legTone = scriptTone(leg.direction, leg.confidence)
                  return (
                    <div className={`script-leg-card ${legTone}`} key={`${chain.id}-${leg.marketId}-${legIndex}`}>
                      <MarketIcon
                        market={{
                          icon: market.icon,
                          iconUrl: related?.icon || related?.image || null,
                          tone: categoryTones[related?.category || market.category] || market.tone,
                        }}
                        size="small"
                      />
                      <div>
                        <b>{trimNodeTitle(leg.marketTitle, 56)}</b>
                        <small>{directionLabel(leg.direction)} · {leg.impact || '待观察'}</small>
                        <p>{leg.rationale}</p>
                      </div>
                      <strong>{formatMarketPercent(leg.probability)}</strong>
                      <span className={`script-side-badge ${scriptSideTone(leg.side)}`}>{leg.orderHint || leg.side}</span>
                    </div>
                  )
                })}
              </div>
            </button>
          )
        })}
      </div>
      <div className="script-chain-action">
        <div>
          <b>已选择剧本链：{selectedChain?.title || '暂无'}</b>
          <span>{selectedChain?.expectedReturnHint || '选择一条剧本链后，可将其中所有盘口方向加入交易草稿。'}</span>
        </div>
        <button type="button" disabled={!selectedChain?.legs.length}>买入该剧本链盘口</button>
      </div>
      <div className="confidence-legend">
        <b>置信度说明</b>
        <span><i className="dot green" />高置信度 ≥ 0.65</span>
        <span><i className="dot orange" />较高置信度 0.45 - 0.64</span>
        <span><i className="dot red" />中等置信度 0.25 - 0.44</span>
        <span><i className="dot purple" />较低置信度 0.10 - 0.24</span>
      </div>
    </div>
  )
}

function CausewayLogo() {
  return (
    <svg className="logo-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#081B33" />
      <circle cx="20" cy="32" r="5" fill="#fff" />
      <path d="M24 32H47" stroke="#1677FF" strokeWidth="6" strokeLinecap="round" />
      <path d="M24 32L45 20" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <path d="M24 32L45 44" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

function MarketIcon({ market, size }: { market: Pick<Market, 'icon' | 'tone' | 'iconUrl'>; size: 'small' | 'medium' | 'large' }) {
  const maybeImage = market.iconUrl
  if (maybeImage) {
    return (
      <span className={`market-icon image ${market.tone} ${size}`}>
        <img alt="" src={maybeImage} />
      </span>
    )
  }
  const Icon = {
    landmark: Landmark,
    bank: Landmark,
    bitcoin: Bitcoin,
    factory: Factory,
    flame: Flame,
    cpu: Cpu,
    globe: Globe2,
  }[market.icon]
  return (
    <span className={`market-icon ${market.tone} ${size}`}>
      <Icon size={size === 'large' ? 32 : size === 'medium' ? 23 : 17} />
    </span>
  )
}

function MarketHoverCard({
  market,
  placement = 'right',
  style,
  onMouseEnter,
  onMouseLeave,
}: {
  market: Market
  placement?: HoverPlacement
  style?: CSSProperties
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}) {
  const topOutcome = market.outcomes?.[0]
  const description = market.description?.trim() || ''
  const rules = market.rules?.trim() || ''
  const hasDistinctSummary = Boolean(description && rules && description !== rules)
  const rulesText = rules || description || 'Polymarket 未提供详细规则说明。'
  return (
    <aside
      className={`market-hover-card ${placement}`}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="hover-card-head">
        <MarketIcon market={market} size="small" />
        <div>
          <b>{market.title}</b>
          <span>{market.eventTitle || market.category}</span>
        </div>
      </div>
      <div className="hover-card-stats">
        <div><span>价格</span><b>{market.price}%</b></div>
        <div><span>成交量</span><b>{market.volume}</b></div>
        <div><span>流动性</span><b>{formatCompactMoney(market.liquidity)}</b></div>
        <div><span>结束时间</span><b>{formatDate(market.endDate)}</b></div>
      </div>
      <div className="hover-card-body" tabIndex={0}>
        {hasDistinctSummary ? (
          <section className="hover-card-section">
            <span>简介</span>
            <p>{description}</p>
          </section>
        ) : null}
        <section className="hover-card-section">
          <span>规则说明</span>
          <p>{rulesText}</p>
        </section>
      </div>
      <div className="hover-card-footer">
        <span className={market.acceptingOrders === false ? 'closed' : 'open'}>{market.acceptingOrders === false ? '暂停接单' : '可交易'}</span>
        {topOutcome ? <span>{topOutcome.label}: {topOutcome.price == null ? 'N/A' : `${Math.round(topOutcome.price * 100)}%`}</span> : null}
      </div>
    </aside>
  )
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-title">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>
}

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {note ? <span>{note}</span> : null}
    </div>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="back-button" type="button" onClick={onClick}>
      <ArrowLeft size={17} /> 返回
    </button>
  )
}

function SearchPopover({
  loading,
  onSelect,
  query,
  results,
}: {
  loading: boolean
  onSelect: (result: MarketSearchResult) => void
  query: string
  results: MarketSearchResult[]
}) {
  return (
    <div className="search-popover">
      <div className="search-tabs">
        <span className="active">盘口</span>
        <span>事件</span>
        <span>主题</span>
      </div>
      <div className="search-result-list">
        {results.map((result) => (
          <button className="search-result-item" key={`${result.type}:${result.id}`} type="button" onClick={() => onSelect(result)}>
            <span className="search-result-avatar">
              {result.image || result.icon ? <img alt="" src={result.image || result.icon || ''} /> : <i>{result.title.slice(0, 1)}</i>}
            </span>
            <span className="search-result-main">
              <b>{result.title}</b>
              <small>{result.subtitle || result.category || 'Polymarket 市场'}</small>
            </span>
            <span className="search-result-meta">
              <b>{formatProbability(result.price)}</b>
              <small>{result.type === 'topic' ? '主题' : result.endDate ? formatDate(result.endDate) : formatCompactMoney(result.volume)}</small>
            </span>
          </button>
        ))}
        {!loading && !results.length ? <div className="search-empty">没有找到 “{query}” 的相关市场</div> : null}
        {loading ? <div className="search-empty">正在搜索 Polymarket 市场...</div> : null}
      </div>
      {results.length ? <button className="search-all" type="button">查看全部结果 <ArrowRight size={15} /></button> : null}
    </div>
  )
}

function CategoryChips({
  active,
  categories,
  onChange,
}: {
  active: string
  categories: ApiMarketCategory[]
  onChange: (category: string) => void
}) {
  return (
    <div className="chip-row">
      {categories.map((category) => (
        <button
          className={active === category.key ? 'chip active' : 'chip'}
          key={category.key}
          type="button"
          onClick={() => onChange(category.key)}
        >
          {category.key === 'hot' ? <Flame size={15} /> : null}
          {category.label}
        </button>
      ))}
    </div>
  )
}

function MarketPriceChart({ eventMarkets, market }: { eventMarkets: Market[]; market: Market }) {
  return <HistoricalMarketPriceChart eventMarkets={eventMarkets} market={market} />
}

function HistoricalMarketPriceChart({ eventMarkets, market }: { eventMarkets: Market[]; market: Market }) {
  const [historyState, setHistoryState] = useState<{ key: string; history: Record<string, PricePoint[]> }>({
    key: '',
    history: {},
  })
  const chartRows =
    eventMarkets.length > 1
      ? [...eventMarkets]
          .sort((a, b) => b.price - a.price || (b.volumeValue || 0) - (a.volumeValue || 0))
          .slice(0, 8)
          .map((item, index) => ({
            id: item.id,
            index,
            label: marketDisplayLabel(item),
            price: item.price / 100,
            tokenId: item.outcomes?.[0]?.tokenId || '',
          }))
      : getOutcomeRows(market).slice(0, 5).map((outcome) => ({
          id: `${outcome.label}-${outcome.index}`,
          index: outcome.index,
          label: outcome.label,
          price: outcome.price,
          tokenId: outcome.tokenId || '',
        }))
  const tokenIds = chartRows.map((row) => row.tokenId).filter(Boolean)
  const historyKey = tokenIds.join(',')

  useEffect(() => {
    if (!historyKey) return
    const controller = new AbortController()
    const params = new URLSearchParams({ tokenIds: historyKey, interval: 'all', fidelity: '1440' })
    fetch(`/api/markets/history?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<PriceHistoryResponse>
      })
      .then((payload) => {
        const normalizedHistory = Object.fromEntries(
          Object.entries(payload.data.history || {}).map(([tokenId, points]) => [
            tokenId,
            compactHistory(points.filter((point) => typeof point.t === 'number' && typeof point.p === 'number')),
          ]),
        )
        setHistoryState({ key: historyKey, history: normalizedHistory })
      })
      .catch((error: Error) => {
        if (error.name !== 'AbortError') setHistoryState({ key: historyKey, history: {} })
      })
    return () => controller.abort()
  }, [historyKey])

  const currentHistory = historyState.key === historyKey ? historyState.history : {}
  const allPoints = tokenIds.flatMap((tokenId) => currentHistory[tokenId] || [])
  const minT = allPoints.length ? Math.min(...allPoints.map((point) => point.t)) : 0
  const maxT = allPoints.length ? Math.max(...allPoints.map((point) => point.t)) : 1
  const hasHistory = allPoints.length > 1
  const maxPrice = chartMaxPrice(allPoints, chartRows.map((row) => row.price))
  const ticks = chartTicks(maxPrice)

  return (
    <div className="market-price-chart">
      <div className="market-chart-toolbar">
        <div className="market-chart-legend">
          {chartRows.slice(0, 4).map((outcome) => (
            <span className={`chart-key ${outcomeTone(outcome.index)}`} key={outcome.id}>
              <i />
              {outcome.label} <b>{formatUnitPercent(outcome.price)}</b>
            </span>
          ))}
        </div>
        <div className="chart-range-tabs">
          {['1H', '6H', '1D', '1W', '1M', 'ALL'].map((range) => (
            <button className={range === 'ALL' ? 'active' : ''} key={range} type="button">
              {range}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 760 336" aria-label="市场价格走势">
        <g className="grid-lines">
          {ticks.map((tick) => {
            const y = chartY(tick, maxPrice)
            return <path d={`M${HISTORY_CHART_LEFT} ${y.toFixed(1)}H${HISTORY_CHART_RIGHT}`} key={tick} />
          })}
        </g>
        <text className="chart-watermark" x="560" y="62">Polymarket</text>
        <g className="chart-axis">
          {ticks.map((tick) => {
            const y = chartY(tick, maxPrice)
            return (
              <text x="725" y={y + 4} key={`label:${tick}`}>
                {Math.round(tick * 100)}%
              </text>
            )
          })}
          <text x="36" y="314">市场开始</text>
          <text x="648" y="314">{formatDate(market.endDate)}</text>
        </g>
        {chartRows.map((outcome) => (
          <path
            className={`market-chart-line ${outcomeTone(outcome.index)}`}
            d={
              outcome.tokenId && currentHistory[outcome.tokenId]?.length > 1
                ? historyPath(currentHistory[outcome.tokenId], minT, maxT, maxPrice)
                : outcomePath(outcome.index, outcome.price)
            }
            key={outcome.id}
          />
        ))}
        {hasHistory
          ? chartRows.map((outcome) => {
              const points = outcome.tokenId ? currentHistory[outcome.tokenId] : undefined
              const lastPoint = points?.[points.length - 1]
              if (!lastPoint) return null
              const x =
                HISTORY_CHART_LEFT +
                ((lastPoint.t - minT) / Math.max(1, maxT - minT)) * (HISTORY_CHART_RIGHT - HISTORY_CHART_LEFT)
              const y = chartY(lastPoint.p, maxPrice)
              return <circle className={`chart-last-point ${outcomeTone(outcome.index)}`} cx={x} cy={y} key={`${outcome.id}:last`} r="5" />
            })
          : null}
      </svg>
    </div>
  )
}

function MarketOrderBook({ eventMarkets, loading, market }: { eventMarkets: Market[]; loading: boolean; market: Market }) {
  const outcomeRows =
    eventMarkets.length > 1
      ? [...eventMarkets]
          .sort((a, b) => b.price - a.price || (b.volumeValue || 0) - (a.volumeValue || 0))
          .map((item, index) => ({
            id: item.id,
            label: marketDisplayLabel(item),
            subtitle: `Token ${formatToken(item.outcomes?.[0]?.tokenId)} · 市场成交量 ${item.volume}`,
            index,
            percent: item.price,
            yesPrice: item.bestAsk ?? item.price / 100,
            noPrice: item.bestBid == null ? 1 - item.price / 100 : 1 - item.bestBid,
            bid: item.bestBid ?? item.price / 100,
            ask: item.bestAsk ?? item.price / 100,
            trend: outcomeTrend(index, item.price / 100),
          }))
      : getOutcomeRows(market).map((outcome) => ({
          id: `${outcome.label}-${outcome.index}`,
          label: outcome.label,
          subtitle: `Token ${formatToken(outcome.tokenId)} · 市场成交量 ${market.volume}`,
          index: outcome.index,
          percent: outcome.percent,
          yesPrice: outcome.yesPrice,
          noPrice: outcome.noPrice,
          bid: outcome.index === 0 ? market.bestBid ?? outcome.yesPrice : outcome.yesPrice,
          ask: outcome.index === 0 ? market.bestAsk ?? outcome.yesPrice : outcome.yesPrice,
          trend: outcomeTrend(outcome.index, outcome.price),
        }))
  return (
    <div className="market-orderbook">
      <div className="orderbook-head">
        <div>
          <b>盘口</b>
          <span>{loading ? '正在同步 event 盘口...' : `${outcomeRows.length} 个盘口 · ${market.acceptingOrders === false ? '暂停接单' : '可交易'}`}</span>
        </div>
        <div className="orderbook-meta">
          <span>Vol. {market.volume}</span>
          {market.lastTradePrice != null ? <span>Last {formatCents(market.lastTradePrice)}</span> : null}
        </div>
      </div>
      <div className="orderbook-list">
        {outcomeRows.map((outcome) => {
          return (
            <div className="orderbook-row" key={outcome.id}>
              <div className="orderbook-title">
                <b>{outcome.label}</b>
                <span>{outcome.subtitle}</span>
              </div>
              <div className="orderbook-price">
                <strong>{outcome.percent == null ? 'N/A' : `${outcome.percent}%`}</strong>
                <span className={outcome.trend >= 0 ? 'green-text' : 'red-text'}>{outcome.trend >= 0 ? '▲' : '▼'} {Math.abs(outcome.trend)}%</span>
              </div>
              <div className="orderbook-quotes">
                <span>Bid {formatCents(outcome.bid)}</span>
                <span>Ask {formatCents(outcome.ask)}</span>
              </div>
              <button className="buy-yes" type="button">Buy Yes {formatCents(outcome.yesPrice)}</button>
              <button className="buy-no" type="button">Buy No {formatCents(outcome.noPrice)}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChartMini() {
  return (
    <svg className="mini-chart" viewBox="0 0 220 64" aria-hidden="true">
      <path d="M6 48 L28 44 L42 46 L60 38 L83 34 L105 30 L125 36 L143 22 L165 29 L188 20 L213 13" />
    </svg>
  )
}

function RelatedMarketList({ currentMarket }: { currentMarket: Market }) {
  const relatedMarkets = markets
    .filter((market) => market.id !== currentMarket.id && (market.category === currentMarket.category || market.tone === currentMarket.tone))
    .slice(0, 3)
  const items = relatedMarkets.length ? relatedMarkets : markets.filter((market) => market.id !== currentMarket.id).slice(0, 3)
  return (
    <div className="related-list">
      {items.map((market) => (
        <div className="related-item" key={market.id}>
          <MarketIcon market={market} size="small" />
          <div>
            <b>{market.title}</b>
            <span>成交量 {market.volume} · 交易者 {market.traders}</span>
          </div>
          <strong>{market.price}%</strong>
          <span className={market.change > 0 ? 'green-text' : 'red-text'}>{market.change > 0 ? '+' : ''}{market.change}%</span>
          <Star size={17} />
        </div>
      ))}
    </div>
  )
}

function InfoTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="info-table">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </div>
  )
}

function Divider() {
  return <div className="divider" />
}

function PreviewList({ market, settings }: { market: Market; settings: InferenceSettingsState }) {
  const items = [
    ['根节点市场', market.title],
    ['推演范围', scopeLabel(settings.scope)],
    ['时间周期', timeRangeLabel(settings.timeRange, market)],
    ['推演层数', `${settings.depth} 层`],
    ['AI 模型', modelPreferenceLabel(settings.modelPreference)],
    ['置信度偏好', `${confidenceModeLabel(settings.confidenceMode)} · ${settings.confidenceThreshold.toFixed(2)}`],
  ]
  return (
    <div className="preview-list">
      {items.map(([label, value]) => (
        <div key={label}>
          <span className="preview-icon"><CheckCircle2 size={16} /></span>
          <div><b>{label}</b><p>{value}</p></div>
        </div>
      ))}
    </div>
  )
}

function Checklist({ items }: { items: string[] }) {
  return <ul className="checklist">{items.map((item) => <li key={item}><CheckCircle2 size={16} />{item}</li>)}</ul>
}

function DiscoveryTable({ market, relatedMarkets }: { market?: Market; relatedMarkets?: InferenceRelatedMarket[] }) {
  const seedMarket = market || rootMarket
  if (relatedMarkets?.length) {
    return (
      <div className="discovery-table">
        {relatedMarkets.map((item) => {
          const tone = categoryTones[item.category] || seedMarket.tone
          const score = item.verificationScore ?? item.confidence
          return (
          <div key={item.id}>
            <MarketIcon market={{ icon: seedMarket.icon, iconUrl: item.icon || item.image || null, tone }} size="small" />
            <div className="discovery-market-title">
              <b>{item.title}</b>
              {item.eventTitle ? <small>{item.eventTitle}</small> : null}
            </div>
            <span className="relation-cell">
              <b>{item.relation || item.category}</b>
              <small>{directionLabel(item.direction)} · 证据 {item.evidenceCount || item.evidenceIds?.length || 1}</small>
            </span>
            <strong>{formatConfidence(score)}</strong>
            <em>{item.volume}</em>
            <div className="impact-cell">
              <b>{item.impact || '待观察'}</b>
              <small>{formatMarketPercent(item.price)}</small>
            </div>
          </div>
        )})}
      </div>
    )
  }
  const discoveryMarkets = [seedMarket, ...markets.filter((item) => item.id !== seedMarket.id)].slice(0, 5)
  return (
    <div className="discovery-table">
      {discoveryMarkets.map((market) => (
        <div key={market.id}>
          <MarketIcon market={market} size="small" />
          <b>{market.title}</b>
          <span>{market.category}</span>
          <strong>{market.price}%</strong>
          <em>{market.volume}</em>
          <ChartMini />
        </div>
      ))}
    </div>
  )
}

function LogList({ logs, loading }: { logs?: string[]; loading?: boolean }) {
  const displayLogs = logs?.length
    ? logs
    : [
        '正在检索根节点的直接关联市场...',
        '正在扩展二阶关联市场...',
        '正在收集新闻和社交信息...',
        '正在请求 DeepSeek 推演模型...',
      ]
  return (
    <div className="log-list">
      {displayLogs.map((title, index) => (
        <div key={`${title}-${index}`}>
          <i className={`dot ${index > 3 ? 'green' : index > 1 ? 'cyan' : 'blue'}`} />
          <span>{loading && index === displayLogs.length - 1 ? '进行中' : '完成'}</span>
          <b>{title}</b>
          <small>{index === 0 ? '根节点、同事件盘口和本地边已纳入上下文' : '用于生成因果链路、情景和风险提示'}</small>
        </div>
      ))}
    </div>
  )
}

function SummaryList({ market, result }: { market: Market; result: InferenceResult | null }) {
  if (result) {
    const chainItems = (result.scriptChains || []).slice(0, 5).map((chain) => [
      chain.title,
      `${formatConfidence(chain.confidence)} · ${chain.legs.length} 个盘口。${chain.summary}${chain.expectedReturnHint ? ` ${chain.expectedReturnHint}` : ''}`,
    ])
    const linkItems = result.causalLinks.slice(0, 5).map((link) => [
      `${market.title} → ${link.target}`,
      `${directionLabel(link.direction)} · ${formatConfidence(link.confidence)} · ${link.impact || '待观察'}。${link.rationale}${link.evidenceSummary ? ` 证据：${link.evidenceSummary}` : ''}`,
    ])
    const scenarioItems = result.scenarios.slice(0, 2).map((scenario) => [scenario.name, `${scenario.probabilityShift}：${scenario.description}`])
    const excludedNote = result.excludedMarkets?.length
      ? [[`已排除 ${result.excludedMarkets.length} 个低相关候选`, result.excludedMarkets.slice(0, 3).map((item) => `${item.title || item.id}：${item.reason}`).join('；')]]
      : []
    const items = [
      ['根市场推演结论', result.thesis],
      ...chainItems,
      ...(chainItems.length ? [] : linkItems),
      ...scenarioItems,
      ...excludedNote,
    ]
    return (
      <div className="summary-list">
        {items.slice(0, 8).map(([title, detail], index) => (
          <div key={`${title}-${index}`}>
            <span>{index + 1}</span>
            <div><b>{title}</b><p>{detail}</p></div>
          </div>
        ))}
      </div>
    )
  }
  const items = [
    [market.title, `市场当前价格为 ${market.price}%，成交量为 ${market.volume}，这是本次推演的根节点。`],
    ['同事件市场联动', market.eventTitle ? `优先检索「${market.eventTitle}」事件下的其他盘口，判断同事件内概率迁移。` : '优先检索同主题和同分类市场，判断相近盘口的概率迁移。'],
    ['流动性与定价强度', `当前流动性为 ${formatCompactMoney(market.liquidity)}，将作为评估信号强弱和噪声水平的输入。`],
    ['时间约束', `市场结束时间为 ${formatDate(market.endDate)}，推演将优先关注结束前的关键触发因素。`],
    ['风险提示', '该脚本为基于市场数据和 AI 推理的情景分析，不构成交易建议。'],
  ]
  return (
    <div className="summary-list">
      {items.map(([title, detail], index) => (
        <div key={title}>
          <span>{index + 1}</span>
          <div><b>{title}</b><p>{detail}</p></div>
        </div>
      ))}
    </div>
  )
}

function MiniPath({ values }: { values: number[] }) {
  return (
    <div className="mini-path">
      <svg viewBox="0 0 300 70" aria-hidden="true">
        <path d="M20 36 C70 8 82 62 130 34 S205 14 252 36" />
        {values.map((value, index) => (
          <g key={`${value}-${index}`}>
            <circle cx={35 + index * 70} cy={36 + (index % 2 ? 7 : -6)} r="9" />
            <text x={35 + index * 70} y={61 + (index % 2 ? 0 : -38)}>{value}%</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

export default App
