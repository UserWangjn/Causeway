import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Factory,
  Flame,
  Globe2,
  Info,
  Landmark,
  ListOrdered,
  LogOut,
  Play,
  Plus,
  RotateCw,
  Search,
  Share2,
  ShieldCheck,
  Star,
  WalletCards,
  X,
} from 'lucide-react'
import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit'
import { useAccount, useDisconnect, useSignMessage, useSignTypedData, useSwitchChain, useWalletClient, useWriteContract } from 'wagmi'
import { createPublicClient, erc20Abi, http } from 'viem'
import { MarketOrderBook, type OrderbookOutcomeAction } from './components/market/MarketOrderBook'
import { MarketPriceChart } from './components/market/MarketPriceChart'
import { copy } from './lib/copy'
import { formatDate, formatDateTime, formatRelativeTime } from './lib/datetime'
import { formatCompactCount, formatCompactMoney, formatConfidence, formatProbability } from './lib/format'
import { clamp } from './lib/math'
import {
  formatMarketPercent,
  formatUnitPercent,
  marketDisplayLabel,
  marketInferenceOutcome,
  marketIsTradable,
  marketTradingStatusLabel,
  outcomePriceToPercent,
  unitPriceToPercent,
} from './lib/market'
import type { ApiMarketEdge, ApiMarketNode, EventDetail, EventDetailResponse, Market, MarketNetworkResponse, PriceHistoryResponse } from './types/market'
import { arcChain, arcTestnet, supportedChain } from './wallet-config'

const CJK_TEXT_PATTERN = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/u

function hasCjkText(value: string | null | undefined) {
  return Boolean(value && CJK_TEXT_PATTERN.test(value))
}

function englishTextOrFallback(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim()
  return trimmed && !hasCjkText(trimmed) ? trimmed : fallback
}

type View = 'network' | 'detail' | 'infer' | 'progress' | 'script' | 'scripts' | 'account'

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
  selectionId?: string
  marketId: string
  marketTitle: string
  eventTitle?: string | null
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

type OrderExecutionMode = 'dry_run' | 'real'
type TradingAccountType = 'auto' | 'gnosis_safe' | 'proxy' | 'deposit_wallet'
type OrderMode = 'market' | 'limit'
type LimitOrderType = 'GTC' | 'GTD' | 'FOK' | 'FAK'
type OrderSizingMode = 'amountUsd' | 'size'
type OrderSubmissionStatus = 'idle' | 'saving' | 'previewing' | 'checking' | 'preparing_signature' | 'signing' | 'submitting'

type ScriptOrderCandidate = {
  selectionId: string
  marketId: string
  marketTitle: string
  eventTitle?: string | null
  layer: number
  outcomeId: string
  outcomeLabel: string
  tokenId: string
  aiAction: 'buy' | 'avoid'
  userAction: 'buy' | 'skip'
  side: 'BUY'
  orderMode: OrderMode
  limitPrice: number | null
  size: number | null
  amountUsd: number | null
  confidence: number | null
  reason: string
  price: number | null
  tickSize: number | null
  minOrderSize: number | null
  isTradable: boolean
  marketStatus: string | null
}

type OrderDraftSelection = ScriptOrderCandidate & {
  enabled: boolean
  sizingMode: OrderSizingMode
  orderType: LimitOrderType
}

type OrderPreviewOrder = {
  selectionId: string
  marketId: string
  outcomeId: string
  tokenId: string
  outcomeLabel: string
  side: 'BUY'
  orderMode: OrderMode
  orderType: LimitOrderType | null
  limitPrice: number | null
  estimatedFillPrice: number | null
  amountUsd: number
  size: number
  tickSize: number | null
  minOrderSize: number | null
  orderBookRefreshedAt: string | null
  orderBookError?: string | null
  orderBookStatusCode?: number | null
  valid: boolean
  warnings: string[]
  error: string | null
}

type OrderPreview = {
  intentId: string
  executionMode: OrderExecutionMode
  tradingCapability: 'available' | 'degraded' | 'unavailable'
  balanceCapability: 'available' | 'degraded' | 'unavailable'
  requestedTradingAccountType?: TradingAccountType
  tradingAccountType?: Exclude<TradingAccountType, 'auto'> | null
  tradingAccountLabel?: string | null
  signatureType?: 0 | 1 | 2 | 3 | null
  funderAddress?: string | null
  accountOptions?: TradingAccountOption[]
  tradingCapabilityReason: string | null
  balanceCapabilityReason: string | null
  cashAvailable: number | null
  totalAmountUsd: number
  estimatedMaxPayout: number
  estimatedMaxLoss: number
  requiresSignature: boolean
  submitMode: 'dry_run_no_signature' | 'signed_clob_order' | 'unavailable'
  refreshedAt: string
  expiresAt: string
  orders: OrderPreviewOrder[]
}

type PreparedOrderPayload = {
  orderId: string
  protocol: 'polymarket_clob_eip712_v2'
  orderType: LimitOrderType
  signatureType: 0 | 1 | 2 | 3
  makerAddress: string
  signerAddress: string
  funderAddress: string | null
  expiresAt?: string
  eip712: TypedDataPayload
}

type TradingAccountOption = {
  type: Exclude<TradingAccountType, 'auto'>
  label: string
  signatureType: 0 | 1 | 2 | 3
  funderAddress: string | null
  status: TradingReadiness['status']
  canTrade: boolean
  reason: string | null
  cashAvailable: number | null
  collateralAvailable: number | null
  balance?: {
    raw: string | null
    allowances: Record<string, string>
    checkedAt: string | null
  }
}

type PrepareSignatureResult = {
  intentId: string
  executionMode: OrderExecutionMode
  signingStatus: 'ready' | 'not_required' | 'unavailable'
  protocol: 'dry_run_no_signature' | 'polymarket_clob_eip712_v2'
  expiresAt: string | null
  payloads: PreparedOrderPayload[]
  error: string | null
}

type OrderSubmitResult = {
  intentId: string
  executionMode: OrderExecutionMode
  status: 'dry_run_completed' | 'submitted' | 'partially_submitted' | 'unknown' | 'failed'
  orders: {
    orderId: string
    externalOrderId: string | null
    status: string
    errorMessage: string | null
  }[]
}

type OpenOrderItem = {
  orderId: string | null
  intentId: string | null
  externalOrderId: string
  status: string
  rawStatus: string
  marketId: string | null
  outcomeId: string | null
  clobTokenId: string
  side: string
  orderType: string | null
  price: number | null
  originalSize: number | null
  sizeMatched: number
  remainingSize: number | null
  amountUsd: number | null
  outcomeLabel: string | null
  marketTitle: string | null
  eventTitle: string | null
  marketImage?: string | null
  createdAt: string | null
  makerAddress: string | null
  canCancel: boolean
}

type OrderStatusItem = {
  orderId: string
  intentId: string
  externalOrderId: string | null
  status: string
  marketTitle: string | null
  eventTitle: string | null
  marketImage?: string | null
  outcomeLabel: string | null
  side: string
  orderType: string | null
  price: number | null
  size: number | null
  amountUsd: number | null
  makerAddress: string | null
  createdAt: string
  updatedAt: string
  errorMessage: string | null
}

type TradeStatusItem = {
  tradeId: string
  orderId: string | null
  status: string
  marketId: string | null
  outcomeId: string | null
  clobTokenId: string
  marketTitle: string | null
  eventTitle: string | null
  marketImage?: string | null
  outcomeLabel: string | null
  side: string
  price: number | null
  size: number | null
  amountUsd: number | null
  makerAddress: string | null
  transactionHash: string | null
  traderSide: string | null
  matchedAt: string | null
}

type OpenOrdersResult = {
  capability: 'available' | 'degraded' | 'unavailable'
  dataSource: 'polymarket_clob' | string
  ownerWalletAddress?: string | null
  tradingWalletAddress?: string | null
  walletRole?: string | null
  items: OpenOrderItem[]
  recentOrders?: OrderStatusItem[]
  trades?: TradeStatusItem[]
  refreshedAt: string
  error: string | null
}

type PortfolioSummary = {
  capability: 'available' | 'degraded' | 'unavailable'
  dataSource: 'polymarket_data_api' | 'pending_sync' | 'unavailable' | string
  cashAvailable: number | null
  portfolioValue: number | null
  openPositionsValue: number | null
  openOrdersValue: number | null
  pnl: number | null
  refreshedAt: string
  error: string | null
}

type PortfolioPositionItem = {
  marketId: string
  outcomeId: string
  tokenId: string
  title: string
  marketImage?: string | null
  outcomeLabel: string
  size: number | null
  avgPrice: number | null
  currentPrice: number | null
  currentValue: number | null
  pnl: number | null
}

type PortfolioPositionsResult = {
  capability: 'available' | 'degraded' | 'unavailable'
  dataSource: string
  items: PortfolioPositionItem[]
  refreshedAt: string
  error: string | null
}

type PortfolioOrderItem = {
  intentId: string
  status: string
  executionMode: OrderExecutionMode
  totalAmountUsd: number | null
  createdAt: string
  updatedAt: string
  orders: Array<{
    id: string
    side: string
    orderMode: OrderMode
    orderType: LimitOrderType | null
    limitPrice: number | null
    estimatedFillPrice: number | null
    size: number | null
    amountUsd: number | null
    externalOrderId: string | null
    status: string
    errorMessage: string | null
    marketImage?: string | null
    market?: { question?: string | null; title?: string | null } | null
    outcome?: { label?: string | null } | null
  }>
}

type PortfolioOrdersResult = {
  capability: 'available' | 'degraded' | 'unavailable'
  dataSource: string
  items: PortfolioOrderItem[]
  refreshedAt: string
  error: string | null
}

type PortfolioTradeItem = {
  tradeId: string
  orderId: string
  intentId: string
  side: string
  orderMode: OrderMode
  orderType: LimitOrderType | null
  price: number | null
  size: number | null
  amountUsd: number | null
  externalOrderId: string | null
  status: string
  marketImage?: string | null
  market?: { question?: string | null; title?: string | null } | null
  outcome?: { label?: string | null } | null
  tradedAt: string
}

type PortfolioTradesResult = {
  capability: 'available' | 'degraded' | 'unavailable'
  dataSource: string
  items: PortfolioTradeItem[]
  refreshedAt: string
  error: string | null
}

type CancelOrderResult = {
  orderId: string | null
  intentId: string | null
  externalOrderId: string
  status: 'cancelled' | string
  errorMessage: string | null
}

type OrderIntentDetail = {
  intentId: string
  executionMode: OrderExecutionMode
  status: string
  preview: OrderPreview | null
  submitResult: OrderSubmitResult | null
  createdAt: string
  updatedAt: string
}

type InferenceScenario = {
  name: string
  probabilityShift: string
  description: string
  signals: string[]
}

type InferenceResult = {
  runId: string
  scriptId?: string | null
  status: 'completed' | string
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
  orderCandidates?: ScriptOrderCandidate[]
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

type BackendInferenceCreateResponse = {
  runId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  cacheKey: string
  cacheHit: boolean
  scriptId: string | null
}

type BackendInferenceStatus = {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  stage: string | null
  progress: number
  cacheHit: boolean
  scriptId: string | null
  errorMessage: string | null
  model?: string
  createdAt?: string
  completedAt?: string | null
}

type BackendInferenceCapability = {
  status: 'available' | 'unavailable'
  reason: string | null
  defaultModel: string | null
  models: string[]
  freeModel: string
  freeMaxDepth: number
  premiumModels: string[]
}

type TypedDataPayload = {
  primaryType: string
  domain: {
    name?: string
    version?: string
    chainId?: number
    verifyingContract?: string
  }
  types: Record<string, { name: string; type: string }[]>
  message: Record<string, unknown>
}

type TradingReadiness = {
  status: 'disabled' | 'needs_clob_auth' | 'needs_deposit_wallet' | 'deposit_wallet_pending' | 'needs_funding' | 'ready' | 'degraded' | 'unavailable'
  canTrade: boolean
  reason: string | null
  walletAddress: string
  chainId: number
  signatureType: 0 | 1 | 2 | 3
  requestedTradingAccountType?: TradingAccountType
  tradingAccountType: Exclude<TradingAccountType, 'auto'>
  tradingAccountLabel: string
  funderAddress: string | null
  clobApiKeyConfigured: boolean
  clobApiKeyPreview: string | null
  depositWalletAddress: string | null
  depositWalletDeployed: boolean
  depositWalletTxId: string | null
  depositWalletTxState: string | null
  balance: {
    raw: string | null
    allowances: Record<string, string>
    checkedAt: string | null
  }
  builderConfigured: boolean
  steps: { code: string; message: string; action: string }[]
  accountOptions?: TradingAccountOption[]
}

type ClobAuthPrepareResult = {
  challengeId: string
  walletAddress: string
  chainId: number
  timestamp: number
  nonce: number
  expiresAt: string
  eip712: TypedDataPayload
}

type RelayerTransactionResult = {
  transactionId: string | null
  state: string | null
  transactionHash: string | null
}

type DepositWalletApprovalPrepareResult = {
  walletAddress: string
  chainId: number
  nonce: string
  deadline: string
  calls: { target: string; value: string; data: string }[]
  eip712: TypedDataPayload
}

type DepositWalletFundingPrepareResult = {
  walletAddress: string
  chainId: number
  safeAddress: string
  depositWalletAddress: string
  amountMicroUsd: number
  amountUsd: number
  nonce: string
  messageHash: string
}

type DepositWalletTransferPrepareResult = DepositWalletApprovalPrepareResult & {
  recipientAddress: string
  amountMicroUsd: number
  amountUsd: number
}

type DepositWalletActionResult = {
  transaction: RelayerTransactionResult
  readiness: TradingReadiness
}

type BridgeWalletResult = {
  ownerAddress: string
  polymarketWalletAddress: string
  walletKind: 'safe' | 'proxy' | 'deposit_wallet'
  warning: string | null
  bridgeBaseUrl: string
}

type BridgeAddressSet = {
  evm?: string
  svm?: string
  btc?: string
}

type BridgeDepositResult = {
  wallet: BridgeWalletResult
  deposit: {
    address?: BridgeAddressSet
    note?: string
  }
}

type BridgeWithdrawalResult = {
  wallet: BridgeWalletResult
  withdrawal: {
    address?: BridgeAddressSet
    note?: string
  }
}

type BridgeSupportedAsset = {
  chainId: string
  chainName: string
  token: {
    name: string
    symbol: string
    address: string
    decimals: number
  }
  minCheckoutUsd?: number
}

type BridgeSupportedAssetsResult = {
  supportedAssets: BridgeSupportedAsset[]
}

type BridgeTransactionStatusResult = {
  transactions: Array<{
    fromChainId?: string
    fromTokenAddress?: string
    fromAmountBaseUnit?: string
    toChainId?: string
    toTokenAddress?: string
    status?: string
    txHash?: string
    createdTimeMs?: number
  }>
}

type TradingWalletActivityItem = {
  id: string
  label: string
  detail: string
  status: 'pending' | 'done' | 'error'
  createdAt: string
}

type TradingWalletActivityStatus = TradingWalletActivityItem['status']

type TradingWalletActivityContextValue = {
  activityItems: TradingWalletActivityItem[]
  addActivity: (label: string, detail: string, status?: TradingWalletActivityStatus) => string
  updateActivity: (id: string, status: TradingWalletActivityStatus, detail: string) => void
}

const TradingWalletActivityContext = createContext<TradingWalletActivityContextValue | null>(null)

function useTradingWalletActivity() {
  const context = useContext(TradingWalletActivityContext)
  if (!context) {
    throw new Error('Trading wallet activity context is missing.')
  }
  return context
}

function BodyPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

type BackendScript = {
  id: string
  title: string
  status: string
  summary: string
  root?: {
    marketId: string
    outcomeId: string
    outcomeLabel: string
  }
  graph: {
    nodes: Array<{
      nodeId: string
      marketId: string
      title: string
      eventId?: string | null
      eventSlug?: string | null
      eventTitle?: string | null
      layer: number
      confidence: number
      direction: string
      price: number | null
      recommendedOutcomes?: { outcomeId: string; label: string; tokenId: string }[]
    }>
    edges: Array<{
      sourceNodeId: string
      targetNodeId: string
      sourceOutcomeId: string
      targetOutcomeId: string
      relation: string
      confidence: number
      reason: string
    }>
  }
  inferenceRun?: Omit<BackendInferenceStatus, 'scriptId'> & {
    model: string
  }
  markets: Array<{
    scriptMarketId?: string
    marketId: string
    title: string
    eventId?: string | null
    eventSlug?: string | null
    eventTitle?: string | null
    layer: number
    impactDirection?: string
    confidence: number | null
    reason?: string
    active?: boolean
    closed?: boolean
    archived?: boolean
    staleDetectedAt?: string | null
    acceptingOrders?: boolean
    enableOrderBook?: boolean
    icon?: string | null
    image?: string | null
    orderMinSize?: number | null
    tickSize?: number | null
    bestAsk?: number | null
    lastTradePrice?: number | null
    volume?: number | null
    volume24hr?: number | null
    liquidity?: number | null
    outcomes: Array<{
      selectionId: string
      outcomeId: string
      label: string
      tokenId: string
      price?: number | null
      aiAction: 'buy' | 'avoid'
      userAction: 'buy' | 'skip'
      side?: 'BUY'
      orderMode?: OrderMode
      limitPrice?: number | null
      size?: number | null
      amountUsd?: number | null
      confidence: number | null
      reason: string
    }>
  }>
  createdAt: string
  updatedAt: string
}

type BackendScriptListItem = {
  id: string
  title: string
  status: string
  summary: string | null
  rootMarketId: string
  rootOutcomeId: string
  rootEventId?: string | null
  rootEventSlug?: string | null
  rootEventTitle?: string | null
  rootOutcomeLabel: string | null
  rootPrice: number | null
  rootVolume: number | null
  rootVolume24hr: number | null
  rootLiquidity: number | null
  icon: string | null
  image: string | null
  marketCount: number
  orderIntentCount: number
  createdAt: string
  updatedAt: string
}

type BackendScriptListResponse = {
  items: BackendScriptListItem[]
  nextCursor: string | null
  hasMore: boolean
}

type ArcProofAnchor = {
  chainId: number
  fromAddress: string
  txHash: string
  traceHash: string
  calldata: string
  arcscanUrl: string
  anchoredAt: string
}

type ArcProofResult = {
  chainId: number
  chainName: string
  explorerBaseUrl: string
  traceHash: string
  calldata: string
  capsule: Record<string, unknown>
  anchor: ArcProofAnchor | null
}

type ScriptStatusFilter = 'all' | 'draft' | 'active' | 'archived'

type InferenceDepth = 1 | 2 | 3
type InferenceModelPreference =
  | 'gpt-5.5'
  | 'gpt-5.4'
  | 'claude-sonnet-4.7'
  | 'claude-sonnet-4.6'
  | 'claude-opus-4.7'
  | 'claude-opus-4.6'
type ConfidenceMode = 'broad' | 'balanced' | 'strict'

const FREE_INFERENCE_MODEL = 'gpt-5.4' satisfies InferenceModelPreference
const FREE_INFERENCE_MODELS: readonly InferenceModelPreference[] = ['gpt-5.4', 'claude-sonnet-4.6']
const INFERENCE_MODEL_ORDER: readonly InferenceModelPreference[] = [
  'gpt-5.5',
  'gpt-5.4',
  'claude-sonnet-4.7',
  'claude-sonnet-4.6',
  'claude-opus-4.7',
  'claude-opus-4.6',
]

type InferenceSettingsState = {
  modelPreference: InferenceModelPreference
  confidenceMode: ConfidenceMode
  depth: InferenceDepth
  confidenceThreshold: number
  rootOutcomeId: string | null
}

const defaultInferenceSettings: InferenceSettingsState = {
  modelPreference: FREE_INFERENCE_MODEL,
  confidenceMode: 'balanced',
  depth: 1,
  confidenceThreshold: 0.55,
  rootOutcomeId: null,
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

type SearchResultType = MarketSearchResult['type']

type MarketSearchResponse = {
  data: {
    results: MarketSearchResult[]
    generatedAt: string
    source: string
  }
}

type ApiEnvelope<T> = {
  data: T
  requestId?: string
}

type AuthNonceResponse = {
  nonce: string
  expiresAt: string
}

type AuthVerifyResponse = {
  accessToken: string
  expiresAt: string
  user: {
    id: string
    walletAddress: string
  }
}

type StoredAuthSession = {
  accessToken: string
  walletAddress: string
  chainId: number
  expiresAt: string
}

type CausewayAuth = {
  accessToken: string | null
  walletAddress: string | null
  chainId: number | null
  error: string | null
  isAuthenticated: boolean
  isConnected: boolean
  isSigningIn: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

type MembershipPlan = {
  sku: 'premium_monthly' | 'premium_yearly'
  label: string
  amountMicroUsd: string
  amountUsd: string
  durationDays: number
  tier: 'premium'
}

type MembershipPayment = {
  enabled: boolean
  chainId: number
  currency: 'USDC'
  plans: MembershipPlan[]
}

type MembershipStatus = {
  tier: 'free' | 'premium'
  status: 'free' | 'active' | 'expired' | 'revoked'
  startsAt: string | null
  expiresAt: string | null
  capabilities: {
    premiumSignals: boolean
    fullReasoningTrace: boolean
    arcProof: boolean
  }
  payment: MembershipPayment
  generatedAt: string
}

type MembershipCatalog = {
  payment: MembershipPayment
  generatedAt: string
}

type MembershipState = {
  membership: MembershipStatus | null
  catalog: MembershipCatalog | null
  loading: boolean
  catalogLoading: boolean
  error: string | null
  refreshMembership: (signal?: AbortSignal) => Promise<MembershipStatus | null>
  refreshCatalog: (signal?: AbortSignal) => Promise<MembershipCatalog | null>
  setMembership: (membership: MembershipStatus | null) => void
  setError: (error: string | null) => void
}

type MembershipRecord = {
  walletAddress: string
  membership: MembershipStatus
}

type ArcPaymentIntent = {
  id: string
  sku: MembershipPlan['sku']
  status: 'pending' | 'confirmed' | 'expired' | 'failed' | 'cancelled'
  walletAddress: string
  txHash: string | null
  failureReason: string | null
  expiresAt: string
  confirmedAt: string | null
  payment: {
    chainId: number
    tokenAddress: string
    receiverAddress: string
    currency: 'USDC'
    decimals: number
    amountMicroUsd: string
    amountUsd: string
  }
}

type ArcPaymentVerifyResult = {
  intent: ArcPaymentIntent
  membership: MembershipStatus
}

type StoredArcPayment = {
  intentId: string
  txHash: HexString
  sku: MembershipPlan['sku']
  amountUsd: string
  expiresAt: string
  storedAt: string
}

type SignTypedDataVariables = Parameters<ReturnType<typeof useSignTypedData>['signTypedDataAsync']>[0]
type HexAddress = `0x${string}`
type HexString = `0x${string}`
type SignTypedDataAsync = (variables: SignTypedDataVariables) => Promise<unknown>
type SignMessageAsync = ReturnType<typeof useSignMessage>['signMessageAsync']
type TypedDataWalletClient = {
  signTypedData: (variables: SignTypedDataVariables & { account?: HexAddress }) => Promise<unknown>
  signMessage?: (variables: { account?: HexAddress; message: string | { raw: HexString } }) => Promise<unknown>
  sendTransaction?: (variables: { account?: HexAddress; to: HexAddress; value: bigint; data?: HexString }) => Promise<unknown>
}
type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

const ORDER_SUBMIT_CLIENT_VERSION = 'order-submit-v4-wallet-fallback'
const ORDER_DEBUG_STORAGE_KEY = 'causeway.orderDebug'
const ARC_RPC_URL = import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.network'

type BackendMarketNetwork = {
  nodes: Array<{
    id: string
    nodeType?: 'event' | 'market'
    marketId?: string | null
    eventId?: string | null
    slug?: string | null
    eventSlug?: string | null
    eventTitle?: string | null
    title: string
    groupItemTitle?: string | null
    icon: string | null
    image?: string | null
    price: number | null
    volume: number | null
    volume24hr?: number | null
    liquidity?: number | null
    endDate?: string | null
    description?: string | null
    rules?: string | null
    active?: boolean
    closed?: boolean
    archived?: boolean
    staleDetectedAt?: string | null
    acceptingOrders?: boolean
    enableOrderBook?: boolean
    category: string | null
    categoryKey?: string | null
    officialCategory?: string | null
    tags?: string[]
    marketsCount?: number | null
    topMarkets?: { marketId: string; title: string; groupItemTitle?: string | null; price: number | null; volume: number | null }[]
    syncedAt?: string | null
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    relationType: ApiMarketEdge['relationType']
    weight: number
  }>
  total?: number
  totalEvents?: number
  totalMarkets?: number
  returned?: number
  limit?: number
  hasMore?: boolean
  category?: string
  source?: string
  topologySource?: string
  nodeType?: 'event' | 'market'
  generatedAt?: string
}

type NetworkSummary = {
  total: number
  totalEvents: number | null
  totalMarkets: number | null
  returned: number
  limit: number
  hasMore: boolean
  category: string
  topologySource: string
  nodeType: 'event' | 'market'
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')
const API_PREFIX = `${API_BASE_URL}/api/v1`
const DEPOSIT_WALLET_POLL_INTERVAL_MS = 2_500
const DEPOSIT_WALLET_POLL_ATTEMPTS = 20
const TRADING_WALLET_MIN_READY_USD = 5
const ACCESS_TOKEN_STORAGE_KEY = 'causeway.accessToken'
const ACCESS_WALLET_STORAGE_KEY = 'causeway.walletAddress'
const ACCESS_CHAIN_STORAGE_KEY = 'causeway.chainId'
const ACCESS_EXPIRES_STORAGE_KEY = 'causeway.expiresAt'
const ARC_PAYMENT_PENDING_STORAGE_KEY = 'causeway.arcPayment.pending'
const ARC_PAYMENT_VERIFY_INTERVAL_MS = 2_500
const ARC_PAYMENT_VERIFY_TIMEOUT_MS = 180_000

async function readApiData<T>(response: Response): Promise<T> {
  const rawText = await response.text()
  const payload = parseApiPayload<ApiEnvelope<T> | ApiErrorEnvelope>(rawText)
  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession()
    }
    throw new Error(formatApiError(response, payload))
  }
  if (!payload || !isRecord(payload) || !('data' in payload)) {
    throw new Error(formatUnexpectedApiResponse(response, rawText))
  }
  return payload.data
}

type ApiErrorEnvelope = {
  error?: unknown
  code?: string
  message?: string
  details?: unknown
  requestId?: string
}

function parseApiPayload<T>(rawText: string): T | null {
  if (!rawText.trim()) return null
  try {
    return JSON.parse(rawText) as T
  } catch {
    return null
  }
}

function formatApiError(response: Response, payload: ApiErrorEnvelope | null) {
  const errorPayload = payload && isRecord(payload) && 'error' in payload ? payload.error : payload
  const errorRecord = isRecord(errorPayload) ? errorPayload : null
  const code = readStringField(errorRecord, 'code') ?? readStringField(payload, 'code')
  const message =
    readStringField(errorRecord, 'message')
    ?? readStringField(payload, 'message')
    ?? (typeof errorPayload === 'string' ? errorPayload : null)
    ?? response.statusText
    ?? `HTTP ${response.status}`
  const detail = summarizeApiDetails(errorRecord?.details ?? payload?.details)
  const friendlyCapabilityMessage = formatCapabilityUnavailableMessage(message, code, detail)
  if (friendlyCapabilityMessage) return friendlyCapabilityMessage
  const suffix = code ? ` (${code})` : ''
  const detailSuffix = detail ? `: ${detail}` : ''
  return `${message}${suffix}${detailSuffix}`
}

function formatCapabilityUnavailableMessage(message: string, code: string | null, detail?: string | null) {
  if (code !== 'CAPABILITY_UNAVAILABLE') return null
  const combined = `${message} ${detail ?? ''}`
  return normalizeTradingCapabilityReason(combined)
}

function normalizeTradingCapabilityReason(reason: string | null | undefined) {
  if (!reason) return null
  if (isRealTradingDisabledReason(reason)) {
    return copy('Real order execution is not enabled in this environment. Enable real order execution and Polymarket credentials in server settings before submitting real CLOB orders.')
  }
  return reason
}

function isRealTradingDisabledReason(reason: string) {
  const normalized = reason.toLowerCase()
  return normalized.includes('enable_real_orders=false')
    || normalized.includes('real trading is disabled')
    || normalized.includes('clob real trading is disabled')
}

function formatUnexpectedApiResponse(response: Response, rawText: string) {
  const preview = rawText.trim().slice(0, 160)
  return preview
    ? `Unexpected response from backend (${response.status}): ${preview}`
    : `Unexpected empty response from backend (${response.status}).`
}

function summarizeApiDetails(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.slice(0, 3).map(summarizeApiDetails).filter(Boolean).join('; ') || null
  if (!isRecord(value)) return null
  if ('body' in value) {
    const endpoint = readStringField(value, 'endpoint')
    const status = typeof value.status === 'number' || typeof value.status === 'string' ? `status ${value.status}` : null
    const body = summarizeApiDetails(value.body)
    return [endpoint, status, body].filter(Boolean).join(' ') || null
  }
  for (const key of ['reason', 'message', 'error', 'status', 'endpoint']) {
    const text = readStringField(value, key)
    if (text) return text
  }
  const compact = JSON.stringify(value)
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact
}

function readStringField(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null
  const field = value[key]
  return typeof field === 'string' && field.trim() ? field.trim() : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function backendNetworkToApiNode(node: BackendMarketNetwork['nodes'][number], index: number): ApiMarketNode {
  const nodeType = node.nodeType ?? 'market'
  return {
    id: node.id,
    nodeType,
    marketId: node.marketId ?? (nodeType === 'market' ? node.id : null),
    slug: node.slug ?? null,
    title: node.title,
    groupItemTitle: node.groupItemTitle ?? null,
    eventId: node.eventId ?? (nodeType === 'event' ? node.id : null),
    eventSlug: node.eventSlug ?? null,
    eventTitle: node.eventTitle ?? (nodeType === 'event' ? node.title : null),
    category: node.category,
    categoryKey: node.categoryKey ?? node.category,
    officialCategory: node.officialCategory ?? node.category,
    tags: node.tags ?? (node.category ? [node.category] : []),
    icon: node.icon,
    image: node.image ?? node.icon,
    price: node.price,
    volume: node.volume,
    volume24hr: node.volume24hr ?? null,
    liquidity: node.liquidity ?? null,
    endDate: node.endDate ?? null,
    description: node.description ?? null,
    rules: node.rules ?? null,
    active: node.active ?? true,
    closed: node.closed ?? false,
    archived: node.archived ?? false,
    staleDetectedAt: node.staleDetectedAt ?? null,
    acceptingOrders: node.acceptingOrders ?? true,
    enableOrderBook: node.enableOrderBook ?? true,
    outcomes: [],
    marketsCount: node.marketsCount ?? null,
    topMarkets: node.topMarkets ?? [],
    syncedAt: node.syncedAt ?? null,
    x: 50 + (index % 5) * 8,
    y: 50 + Math.floor(index / 5) * 8,
  }
}

function backendNetworkToResponse(data: BackendMarketNetwork): MarketNetworkResponse['data'] {
  return {
    nodes: data.nodes.map(backendNetworkToApiNode),
    edges: data.edges.map((edge) => ({
      ...edge,
      reason: edge.relationType,
    })),
    source: data.source ?? 'database',
    generatedAt: data.generatedAt ?? new Date().toISOString(),
  }
}

function getAccessToken() {
  return readStoredAuthSession()?.accessToken ?? null
}

function readStoredAuthSession(): StoredAuthSession | null {
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
  const walletAddress = window.localStorage.getItem(ACCESS_WALLET_STORAGE_KEY)
  const chainId = Number(window.localStorage.getItem(ACCESS_CHAIN_STORAGE_KEY))
  const expiresAt = window.localStorage.getItem(ACCESS_EXPIRES_STORAGE_KEY)

  if (!accessToken || !walletAddress || !Number.isFinite(chainId) || !expiresAt) return null
  const session = { accessToken, walletAddress, chainId, expiresAt }
  if (isAuthSessionExpired(session)) {
    clearAuthSession()
    return null
  }
  return session
}

function storeAuthSession(session: StoredAuthSession) {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, session.accessToken)
  window.localStorage.setItem(ACCESS_WALLET_STORAGE_KEY, session.walletAddress)
  window.localStorage.setItem(ACCESS_CHAIN_STORAGE_KEY, String(session.chainId))
  window.localStorage.setItem(ACCESS_EXPIRES_STORAGE_KEY, session.expiresAt)
}

function clearAuthSession() {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(ACCESS_WALLET_STORAGE_KEY)
  window.localStorage.removeItem(ACCESS_CHAIN_STORAGE_KEY)
  window.localStorage.removeItem(ACCESS_EXPIRES_STORAGE_KEY)
}

function isAuthSessionExpired(session?: StoredAuthSession | null) {
  if (!session?.expiresAt) return true
  const expiresAt = Date.parse(session.expiresAt)
  return !Number.isFinite(expiresAt) || expiresAt <= Date.now()
}

function sameAddress(left?: string | null, right?: string | null) {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase())
}

function shortAddress(address?: string | null) {
  if (!address) return 'Wallet'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function walletInitials(address?: string | null) {
  if (!address) return 'CW'
  return address.slice(2, 4).toUpperCase()
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isWalletUserRejectedError(error: unknown, depth = 0): boolean {
  if (!error || depth > 3) return false
  const code = isRecord(error) ? error.code : null
  if (code === 4001 || code === '4001' || code === 'ACTION_REJECTED' || code === 'USER_REJECTED') return true
  const message = errorMessage(error).toLowerCase()
  if (
    message.includes('user rejected')
    || message.includes('user denied')
    || message.includes('rejected the request')
    || message.includes('request rejected')
    || message.includes('signature request was rejected')
    || message.includes('signature rejected')
  ) {
    return true
  }
  if (!isRecord(error)) return false
  return isWalletUserRejectedError(error.cause, depth + 1)
    || isWalletUserRejectedError(error.error, depth + 1)
    || isWalletUserRejectedError(error.data, depth + 1)
}

function walletSignatureRejectedMessage(action = 'signature request') {
  return `The ${action} was rejected in the wallet. No order, transfer, or approval was submitted.`
}

function invalidOrderPreviewMessage(preview: OrderPreview) {
  const invalidOrder = preview.orders.find((order) => !order.valid)
  return invalidOrder ? orderPreviewErrorText(invalidOrder) : null
}

function orderPreviewErrorText(order: OrderPreviewOrder, draft?: OrderDraftSelection | null) {
  const label = draft
    ? `${orderDraftContextLabel(draft)} / ${draft.outcomeLabel || order.outcomeLabel}`
    : order.outcomeLabel || order.marketId
  const rawError = order.error || ''
  if (rawError.includes('BELOW_MIN_ORDER_SIZE')) {
    const minimum = order.minOrderSize != null ? `${formatShares(order.minOrderSize)} shares` : copy('the market minimum')
    return copy(
      `${label} is below the minimum order size ${minimum} (current ${formatShares(order.size)} shares).`,
    )
  }
  if (rawError.includes('INVALID_TICK_SIZE')) {
    const currentPrice = order.limitPrice != null
      ? copy(` (current limit ${formatLimitPrice(order.limitPrice)})`)
      : ''
    return copy(
      `${label} limit price does not match the market tick size. Minimum tick: ${formatTickSize(order.tickSize)}${currentPrice}`,
    )
  }
  if (rawError.includes('ORDERBOOK_DEPTH_UNAVAILABLE')) {
    return copy(
      `${label} has insufficient order book depth for this amount. Reduce size or use a limit order.`,
    )
  }
  if (rawError.includes('ORDERBOOK_UNAVAILABLE')) {
    return copy(
      `${label} order book is temporarily unavailable. Refresh market data and try again.`,
    )
  }
  if (rawError.includes('MARKET_NOT_TRADABLE')) {
    if (order.orderBookStatusCode === 404 || order.orderBookError === 'not_found') {
      return copy(
        `${label} official order book is closed or delisted, so orders cannot be placed.`,
      )
    }
    return copy(
      `${label} is not tradable right now. It may be closed, paused, or not accepting orders.`,
    )
  }
  if (rawError.includes('REQUEST_VALIDATION_FAILED')) {
    if (order.orderMode === 'limit' && order.limitPrice == null) {
      return copy(`${label} limit order is missing a limit price.`)
    }
    return copy(
      `${label} has an invalid amount, size, or limit price. Please correct it and try again.`,
    )
  }
  return rawError
    ? copy(`${label} has invalid order parameters: ${rawError}`)
    : copy(
      `${label} has invalid order parameters. Please correct amount, size, limit price, or market status.`,
    )
}

function orderPreviewWarningText(warnings: string[]) {
  if (warnings.length === 0) return copy('Ready to submit')
  return warnings.map((warning) => {
    if (warning.includes('MARKET_ORDER_ESTIMATE_CAN_CHANGE')) return copy('Market order execution price may change with the book.')
    if (warning.includes('ORDERBOOK_REFRESH_UNAVAILABLE_USING_LOCAL_CACHE')) return copy('Order book refresh failed; using local cached estimate.')
    return warning
  }).join(copy(', '))
}

function formatTickSize(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return copy('market requirement')
  return `$${value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`
}

function useCausewayAuth(): CausewayAuth {
  const { address, chainId, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const { switchChainAsync } = useSwitchChain()
  const [session, setSession] = useState<StoredAuthSession | null>(() => readStoredAuthSession())
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearSession = useCallback(() => {
    clearAuthSession()
    setSession(null)
  }, [])

  useEffect(() => {
    if (!session) return
    if (!isConnected || !sameAddress(session.walletAddress, address)) {
      const timer = window.setTimeout(clearSession, 0)
      return () => window.clearTimeout(timer)
    }
  }, [address, clearSession, isConnected, session])

  useEffect(() => {
    if (!session) return
    const msUntilExpiry = Date.parse(session.expiresAt) - Date.now()
    if (!Number.isFinite(msUntilExpiry) || msUntilExpiry <= 0) {
      const timer = window.setTimeout(clearSession, 0)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(clearSession, msUntilExpiry)
    return () => window.clearTimeout(timer)
  }, [clearSession, session])

  const signIn = useCallback(async () => {
    if (!address) {
      setError('Connect a wallet before signing in.')
      return
    }

    setIsSigningIn(true)
    setError(null)

    try {
      const activeChainId = chainId === supportedChain.id
        ? chainId
        : (await switchChainAsync({ chainId: supportedChain.id })).id

      const noncePayload = await fetch(`${API_PREFIX}/auth/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, chainId: activeChainId }),
      }).then((response) => readApiData<AuthNonceResponse>(response))

      const signature = await signMessageAsync({ message: noncePayload.nonce })

      const authPayload = await fetch(`${API_PREFIX}/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          chainId: activeChainId,
          message: noncePayload.nonce,
          signature,
        }),
      }).then((response) => readApiData<AuthVerifyResponse>(response))

      const nextSession = {
        accessToken: authPayload.accessToken,
        walletAddress: authPayload.user.walletAddress,
        chainId: activeChainId,
        expiresAt: authPayload.expiresAt,
      }
      storeAuthSession(nextSession)
      setSession(nextSession)
    } catch (signInError) {
      const message = errorMessage(signInError)
      clearSession()
      setError(message)
    } finally {
      setIsSigningIn(false)
    }
  }, [address, chainId, clearSession, signMessageAsync, switchChainAsync])

  const signOut = useCallback(async () => {
    const token = session?.accessToken
    clearSession()
    try {
      if (token) {
        await fetch(`${API_PREFIX}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    } finally {
      disconnect()
    }
  }, [clearSession, disconnect, session?.accessToken])

  const isAuthenticated = Boolean(
    session?.accessToken
    && isConnected
    && sameAddress(session.walletAddress, address)
    && !isAuthSessionExpired(session),
  )

  return {
    accessToken: isAuthenticated ? session?.accessToken ?? null : null,
    walletAddress: isAuthenticated ? session?.walletAddress ?? null : null,
    chainId: isAuthenticated ? session?.chainId ?? null : null,
    error,
    isAuthenticated,
    isConnected,
    isSigningIn,
    signIn,
    signOut,
  }
}

function inferenceModel(settings: InferenceSettingsState) {
  return settings.modelPreference
}

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

async function fetchMembership(token: string, signal?: AbortSignal) {
  return fetch(`${API_PREFIX}/membership/me`, {
    signal,
    headers: authHeaders(token),
  }).then((response) => readApiData<MembershipStatus>(response))
}

async function fetchMembershipCatalog(signal?: AbortSignal) {
  return fetch(`${API_PREFIX}/membership/catalog`, {
    signal,
  }).then((response) => readApiData<MembershipCatalog>(response))
}

async function createArcPaymentIntent(token: string, sku: MembershipPlan['sku']) {
  return fetch(`${API_PREFIX}/payments/arc-usdc/intents`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ sku }),
  }).then((response) => readApiData<ArcPaymentIntent>(response))
}

async function verifyArcPaymentIntent(token: string, intentId: string, txHash: HexString) {
  return fetch(`${API_PREFIX}/payments/arc-usdc/intents/${encodeURIComponent(intentId)}/verify`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ txHash }),
  }).then((response) => readApiData<ArcPaymentVerifyResult>(response))
}

function arcExplorerTx(txHash: string) {
  return `${arcTestnet.blockExplorers.default.url}/tx/${txHash}`
}

async function verifyArcPaymentIntentWithRetry(
  token: string,
  intentId: string,
  txHash: HexString,
  onStatus?: (status: string) => void,
) {
  const deadline = Date.now() + ARC_PAYMENT_VERIFY_TIMEOUT_MS
  let attempt = 1
  while (true) {
    try {
      return await verifyArcPaymentIntent(token, intentId, txHash)
    } catch (verifyError) {
      if (!isArcPaymentPendingVerificationError(verifyError) || Date.now() + ARC_PAYMENT_VERIFY_INTERVAL_MS > deadline) {
        throw verifyError
      }
      onStatus?.(`Waiting for Arc confirmation... attempt ${attempt}`)
      attempt += 1
      await delay(ARC_PAYMENT_VERIFY_INTERVAL_MS)
    }
  }
}

function isArcPaymentPendingVerificationError(error: unknown) {
  const message = errorMessage(error)
  return message.includes('(PAYMENT_TX_NOT_FOUND)') || message.includes('(PAYMENT_CONFIRMATIONS_PENDING)')
}

function isArcPaymentPermanentError(error: unknown) {
  const message = errorMessage(error)
  return [
    '(PAYMENT_VERIFICATION_FAILED)',
    '(PAYMENT_INTENT_NOT_PAYABLE)',
    '(PAYMENT_TX_ALREADY_USED)',
    '(PAYMENT_INTENT_EXPIRED)',
  ].some((code) => message.includes(code))
}

function readStoredArcPayment(): StoredArcPayment | null {
  try {
    const raw = window.localStorage.getItem(ARC_PAYMENT_PENDING_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    const intentId = readStringField(parsed, 'intentId')
    const txHash = readStringField(parsed, 'txHash')
    const sku = readStringField(parsed, 'sku')
    const amountUsd = readStringField(parsed, 'amountUsd')
    const expiresAt = readStringField(parsed, 'expiresAt')
    const storedAt = readStringField(parsed, 'storedAt')
    if (!intentId || !txHash || !isHexString(txHash) || (sku !== 'premium_monthly' && sku !== 'premium_yearly') || !amountUsd || !expiresAt || !storedAt) {
      return null
    }
    return { intentId, txHash, sku, amountUsd, expiresAt, storedAt }
  } catch {
    return null
  }
}

function writeStoredArcPayment(payment: StoredArcPayment) {
  try {
    window.localStorage.setItem(ARC_PAYMENT_PENDING_STORAGE_KEY, JSON.stringify(payment))
  } catch {
    // The tx hash remains visible in memory; local storage only enables refresh recovery.
  }
}

function clearStoredArcPayment() {
  try {
    window.localStorage.removeItem(ARC_PAYMENT_PENDING_STORAGE_KEY)
  } catch {
    // Ignore storage errors; payment verification is server-authoritative.
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function useMembershipState(auth: CausewayAuth): MembershipState {
  const [membershipRecord, setMembershipRecord] = useState<MembershipRecord | null>(null)
  const [catalog, setCatalog] = useState<MembershipCatalog | null>(null)
  const [loading, setLoading] = useState(false)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const visibleMembership = membershipRecord && auth.walletAddress && sameAddress(membershipRecord.walletAddress, auth.walletAddress)
    ? membershipRecord.membership
    : null

  const setMembership = useCallback((nextMembership: MembershipStatus | null) => {
    const walletAddress = auth.walletAddress ?? readStoredAuthSession()?.walletAddress ?? null
    if (!nextMembership || !walletAddress) {
      setMembershipRecord(null)
      return
    }
    setMembershipRecord({ walletAddress, membership: nextMembership })
  }, [auth.walletAddress])

  const refreshCatalog = useCallback(async (signal?: AbortSignal) => {
    setCatalogLoading(true)
    try {
      const nextCatalog = await fetchMembershipCatalog(signal)
      if (!signal?.aborted) {
        setCatalog(nextCatalog)
        setError(null)
      }
      return nextCatalog
    } catch (catalogError) {
      if (!signal?.aborted) setError(errorMessage(catalogError))
      throw catalogError
    } finally {
      if (!signal?.aborted) setCatalogLoading(false)
    }
  }, [])

  const refreshMembership = useCallback(async (signal?: AbortSignal) => {
    const token = auth.accessToken ?? getAccessToken()
    if (!token) {
      setMembership(null)
      return null
    }

    setLoading(true)
    try {
      const nextMembership = await fetchMembership(token, signal)
      if (!signal?.aborted) {
        setMembership(nextMembership)
        setError(null)
      }
      return nextMembership
    } catch (membershipError) {
      if (!signal?.aborted) setError(errorMessage(membershipError))
      throw membershipError
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [auth.accessToken, setMembership])

  useEffect(() => {
    if (!auth.isAuthenticated) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void refreshMembership(controller.signal).catch(() => {
        // The shared error state is already updated in refreshMembership.
      })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [auth.isAuthenticated, refreshMembership])

  return useMemo(() => ({
    membership: visibleMembership,
    catalog,
    loading,
    catalogLoading,
    error,
    refreshMembership,
    refreshCatalog,
    setMembership,
    setError,
  }), [catalog, catalogLoading, error, loading, refreshCatalog, refreshMembership, setMembership, visibleMembership])
}

function orderDebugEnabled() {
  const viteImportMeta = import.meta as ImportMeta & { env?: { DEV?: boolean } }
  return Boolean(viteImportMeta.env?.DEV) || window.localStorage.getItem(ORDER_DEBUG_STORAGE_KEY) === '1'
}

function orderDebugLog(event: string, data: Record<string, unknown> = {}) {
  if (!orderDebugEnabled()) return
  console.warn('[CausewayOrderDebug]', event, data)
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `client_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function normalizeTypedDataScalar(type: string, value: unknown): unknown {
  if (/^u?int(?:[0-9]+)?$/.test(type) && typeof value !== 'bigint' && !(typeof value === 'string' && value.startsWith('0x'))) {
    return BigInt(String(value))
  }
  return value
}

function normalizeTypedDataValueForType(type: string, value: unknown, types: TypedDataPayload['types']): unknown {
  if (type.endsWith('[]')) {
    if (!Array.isArray(value)) return value
    return value.map((item) => normalizeTypedDataValueForType(type.slice(0, -2), item, types))
  }

  const fields = types[type]
  if (fields && value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      fields.map((field) => [field.name, normalizeTypedDataValueForType(field.type, record[field.name], types)]),
    )
  }

  return normalizeTypedDataScalar(type, value)
}

function normalizeTypedDataMessage(payload: TypedDataPayload) {
  return normalizeTypedDataValueForType(payload.primaryType, payload.message, payload.types) as Record<string, unknown>
}

function typedDataToSignVariables(payload: TypedDataPayload): SignTypedDataVariables {
  return {
    domain: payload.domain,
    types: payload.types,
    primaryType: payload.primaryType,
    message: normalizeTypedDataMessage(payload),
  } as SignTypedDataVariables
}

function toSignTypedDataVariables(payload: PreparedOrderPayload): SignTypedDataVariables {
  return typedDataToSignVariables(payload.eip712)
}

function isHexSignature(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{130}$/.test(value.trim())
}

function isHexAddress(value: string): value is HexAddress {
  return /^0x[0-9a-fA-F]{40}$/.test(value)
}

function isHexString(value: string): value is HexString {
  return /^0x[0-9a-fA-F]+$/.test(value)
}

function normalizeSignatureValue(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value) && value.length > 0 && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
    return `0x${value.map((item) => Number(item).toString(16).padStart(2, '0')).join('')}`
  }
  return ''
}

function signatureValueShape(value: unknown): string {
  if (typeof value === 'string') return `string(length=${value.trim().length})`
  if (Array.isArray(value)) return `array(length=${value.length})`
  if (value === null) return 'null'
  return typeof value
}

function injectedEthereumProvider(): EthereumProvider | null {
  const provider = (window as typeof window & { ethereum?: unknown }).ethereum
  if (!provider || typeof provider !== 'object') return null
  const request = (provider as { request?: unknown }).request
  return typeof request === 'function' ? { request: request.bind(provider) as EthereumProvider['request'] } : null
}

function serializeTypedDataForRpc(variables: SignTypedDataVariables) {
  return JSON.parse(JSON.stringify({
    domain: variables.domain,
    types: variables.types,
    primaryType: variables.primaryType,
    message: variables.message,
  }, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))) as Record<string, unknown>
}

async function signTypedDataWithFallback(input: {
  variables: SignTypedDataVariables
  walletAddress: string
  signTypedDataAsync: SignTypedDataAsync
  walletClient?: TypedDataWalletClient | null
}) {
  const attempts: string[] = []
  orderDebugLog('sign_typed_data_start', {
    primaryType: String(input.variables.primaryType),
    walletAddress: shortAddress(input.walletAddress),
    hasWalletClient: Boolean(input.walletClient?.signTypedData),
    hasInjectedProvider: Boolean(injectedEthereumProvider()),
  })
  try {
    const primarySignature = await input.signTypedDataAsync(input.variables)
    const normalizedPrimarySignature = normalizeSignatureValue(primarySignature)
    orderDebugLog('sign_typed_data_attempt', {
      method: 'wagmi',
      returned: signatureValueShape(primarySignature),
      normalizedLength: normalizedPrimarySignature.length,
      valid: isHexSignature(normalizedPrimarySignature),
    })
    if (isHexSignature(normalizedPrimarySignature)) return normalizedPrimarySignature
    attempts.push(`wagmi returned ${signatureValueShape(primarySignature)}`)
  } catch (error) {
    orderDebugLog('sign_typed_data_attempt_error', {
      method: 'wagmi',
      message: errorMessage(error),
    })
    if (isWalletUserRejectedError(error)) {
      throw new Error(walletSignatureRejectedMessage('typed-data signature request'), { cause: error })
    }
    attempts.push(`wagmi failed: ${errorMessage(error)}`)
  }

  if (input.walletClient?.signTypedData && isHexAddress(input.walletAddress)) {
    try {
      const walletClientSignature = await input.walletClient.signTypedData({
        ...input.variables,
        account: input.walletAddress,
      })
      const normalizedWalletClientSignature = normalizeSignatureValue(walletClientSignature)
      orderDebugLog('sign_typed_data_attempt', {
        method: 'walletClient',
        returned: signatureValueShape(walletClientSignature),
        normalizedLength: normalizedWalletClientSignature.length,
        valid: isHexSignature(normalizedWalletClientSignature),
      })
      if (isHexSignature(normalizedWalletClientSignature)) return normalizedWalletClientSignature
      attempts.push(`wallet client returned ${signatureValueShape(walletClientSignature)}`)
    } catch (error) {
      orderDebugLog('sign_typed_data_attempt_error', {
        method: 'walletClient',
        message: errorMessage(error),
      })
      if (isWalletUserRejectedError(error)) {
        throw new Error(walletSignatureRejectedMessage('typed-data signature request'), { cause: error })
      }
      attempts.push(`wallet client failed: ${errorMessage(error)}`)
    }
  }

  const provider = injectedEthereumProvider()
  if (provider) {
    try {
      const providerSignature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [input.walletAddress, JSON.stringify(serializeTypedDataForRpc(input.variables))],
      })
      const normalizedProviderSignature = normalizeSignatureValue(providerSignature)
      orderDebugLog('sign_typed_data_attempt', {
        method: 'injectedProvider',
        returned: signatureValueShape(providerSignature),
        normalizedLength: normalizedProviderSignature.length,
        valid: isHexSignature(normalizedProviderSignature),
      })
      if (isHexSignature(normalizedProviderSignature)) return normalizedProviderSignature
      attempts.push(`injected provider returned ${signatureValueShape(providerSignature)}`)
    } catch (error) {
      orderDebugLog('sign_typed_data_attempt_error', {
        method: 'injectedProvider',
        message: errorMessage(error),
      })
      if (isWalletUserRejectedError(error)) {
        throw new Error(walletSignatureRejectedMessage('typed-data signature request'), { cause: error })
      }
      attempts.push(`injected provider failed: ${errorMessage(error)}`)
    }
  }

  throw new Error(`The wallet did not return a valid EIP-712 signature for ${shortAddress(input.walletAddress)}. Please confirm that the active wallet supports Polygon typed-data signing and try again. Details: ${attempts.join('; ')}`)
}

async function signRawHashWithFallback(input: {
  messageHash: string
  walletAddress: string
  signMessageAsync: SignMessageAsync
  walletClient?: TypedDataWalletClient | null
}) {
  if (!isHexString(input.messageHash)) {
    throw new Error(copy('Relayer signature message is not valid hex.'))
  }
  const attempts: string[] = []
  const message = { raw: input.messageHash } as { raw: HexString }
  try {
    const primarySignature = await input.signMessageAsync({ message })
    const normalized = normalizeSignatureValue(primarySignature)
    if (isHexSignature(normalized)) return normalized
    attempts.push(`wagmi returned ${signatureValueShape(primarySignature)}`)
  } catch (error) {
    if (isWalletUserRejectedError(error)) {
      throw new Error(walletSignatureRejectedMessage('wallet signature request'), { cause: error })
    }
    attempts.push(`wagmi failed: ${errorMessage(error)}`)
  }

  if (input.walletClient?.signMessage && isHexAddress(input.walletAddress)) {
    try {
      const walletClientSignature = await input.walletClient.signMessage({
        account: input.walletAddress,
        message,
      })
      const normalized = normalizeSignatureValue(walletClientSignature)
      if (isHexSignature(normalized)) return normalized
      attempts.push(`wallet client returned ${signatureValueShape(walletClientSignature)}`)
    } catch (error) {
      if (isWalletUserRejectedError(error)) {
        throw new Error(walletSignatureRejectedMessage('wallet signature request'), { cause: error })
      }
      attempts.push(`wallet client failed: ${errorMessage(error)}`)
    }
  }

  const provider = injectedEthereumProvider()
  if (provider) {
    try {
      const providerSignature = await provider.request({
        method: 'personal_sign',
        params: [input.messageHash, input.walletAddress],
      })
      const normalized = normalizeSignatureValue(providerSignature)
      if (isHexSignature(normalized)) return normalized
      attempts.push(`injected provider returned ${signatureValueShape(providerSignature)}`)
    } catch (error) {
      if (isWalletUserRejectedError(error)) {
        throw new Error(walletSignatureRejectedMessage('wallet signature request'), { cause: error })
      }
      attempts.push(`injected provider failed: ${errorMessage(error)}`)
    }
  }

  throw new Error(`The wallet did not return a valid transfer signature. Please check the active wallet and try again. Details: ${attempts.join('; ')}`)
}

function assertSignedOrderPayloads(value: Array<{ orderId: string; signature: unknown }>): { orderId: string; signature: string }[] {
  return value.map((item, index) => {
    const orderId = item.orderId.trim()
    const signature = normalizeSignatureValue(item.signature)
    if (!orderId) {
      throw new Error(copy(`Order ${index + 1} is missing orderId, so the signature cannot be submitted.`))
    }
    if (!isHexSignature(signature)) {
      throw new Error(copy(`Order ${index + 1} has an invalid signature. Please sign again before submitting.`))
    }
    return { orderId, signature }
  })
}

function validatedSignedOrdersForSubmit(
  preview: OrderPreview,
  value: Array<{ orderId: string; signature: unknown }>,
): { orderId: string; signature: string }[] {
  if (preview.executionMode !== 'real') return []
  if (value.length !== preview.orders.length) {
    throw new Error(copy(
      `Order signature count mismatch: expected ${preview.orders.length}, received ${value.length}. Please preview and sign again.`,
    ))
  }
  return assertSignedOrderPayloads(value)
}

function orderSubmitPayload(
  preview: OrderPreview,
  signedOrders: Array<{ orderId: string; signature: unknown }>,
) {
  const normalizedSignedOrders = validatedSignedOrdersForSubmit(preview, signedOrders)
    .map((order) => ({
      orderId: String(order.orderId),
      signature: String(order.signature),
    }))

  const invalidSignedOrder = normalizedSignedOrders.find((order) => !order.orderId || !isHexSignature(order.signature))
  if (invalidSignedOrder) {
    throw new Error(copy('The order signature payload is invalid. Please preview, sign, and submit again.'))
  }

  const body = {
    intentId: String(preview.intentId),
    executionMode: preview.executionMode,
    idempotencyKey: createIdempotencyKey(),
    signedOrders: normalizedSignedOrders,
  }
  const bodyText = JSON.stringify(body)
  if (bodyText.includes('"signedOrders":[[]]') || bodyText.includes('"signedOrders":[[')) {
    throw new Error(copy('The order signature payload was serialized incorrectly. Refresh the page and sign again.'))
  }
  const signedOrdersShape = normalizedSignedOrders.map((order) => `object:${order.orderId}:${order.signature.length}`).join('|')
  orderDebugLog('order_submit_payload_built', {
    clientVersion: ORDER_SUBMIT_CLIENT_VERSION,
    intentId: preview.intentId,
    executionMode: preview.executionMode,
    expectedOrderCount: preview.orders.length,
    signedOrdersCount: normalizedSignedOrders.length,
    signedOrdersShape,
    bodyLength: bodyText.length,
    bodyHasNestedArray: bodyText.includes('"signedOrders":[['),
  })
  return {
    bodyText,
    signedOrdersShape,
  }
}

function positiveNumberOrNull(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

function tradingOption(readiness: TradingReadiness, type: Exclude<TradingAccountType, 'auto'>) {
  return readiness.accountOptions?.find((option) => option.type === type)
}

function readinessCash(readiness: TradingReadiness) {
  return tradingOption(readiness, 'deposit_wallet')?.cashAvailable ?? null
}

function readinessAllowance(readiness: TradingReadiness) {
  return tradingOption(readiness, 'deposit_wallet')?.collateralAvailable ?? null
}

function depositWalletReadyForAmount(readiness: TradingReadiness, requiredUsd: number) {
  if (readiness.tradingAccountType !== 'deposit_wallet' || !readiness.canTrade) return false
  const cashAvailable = readinessCash(readiness)
  const allowanceAvailable = readinessAllowance(readiness)
  return cashAvailable != null
    && allowanceAvailable != null
    && cashAvailable + Number.EPSILON >= requiredUsd
    && allowanceAvailable + Number.EPSILON >= requiredUsd
}

function depositWalletHasCash(readiness: TradingReadiness, requiredUsd: number) {
  if (readiness.tradingAccountType !== 'deposit_wallet') return false
  const cashAvailable = readinessCash(readiness)
  return cashAvailable != null && cashAvailable + Number.EPSILON >= requiredUsd
}

function readinessCanRunQuickSetup(readiness: TradingReadiness) {
  return readiness.tradingAccountType === 'deposit_wallet'
    && readiness.status !== 'disabled'
    && readiness.status !== 'unavailable'
    && readiness.builderConfigured
}

function blockedQuickSetupLogs(readiness: TradingReadiness) {
  const logs = ['Checking your account status...']
  if (readiness.depositWalletAddress) logs.push(`Deposit Wallet address: ${shortAddress(readiness.depositWalletAddress)}`)
  logs.push(`Trading setup is blocked: ${readiness.reason || readiness.status}`)
  if (readiness.status === 'disabled') logs.push('Trading is not enabled on this environment.')
  if (!readiness.builderConfigured) logs.push('Trading wallet management is not configured on the backend.')
  logs.push('After backend configuration is updated, restart the API and sign in again.')
  return logs
}

function depositWalletFundingUnavailableMessage(readiness: TradingReadiness, requiredUsd: number) {
  if (readiness.tradingAccountType !== 'deposit_wallet') return null
  const depositCash = readinessCash(readiness) ?? 0
  if (depositCash + Number.EPSILON >= requiredUsd) return null
  const missingUsd = Math.max(requiredUsd - depositCash, 0)
  const safeCash = tradingOption(readiness, 'gnosis_safe')?.cashAvailable
  if (safeCash == null) {
    return `Deposit Wallet requires at least ${formatUsd(requiredUsd)}. Current balance is ${formatUsd(depositCash)}, missing ${formatUsd(missingUsd)}. Polymarket Safe balance is temporarily unavailable; refresh and try again.`
  }
  if (safeCash + Number.EPSILON >= missingUsd) return null
  return `Deposit Wallet requires at least ${formatUsd(requiredUsd)}. Current balance is ${formatUsd(depositCash)}, missing ${formatUsd(missingUsd)}. Polymarket Safe has ${formatUsd(safeCash)}, so there is not enough existing Polymarket balance to transfer. Deposit through the wallet deposit flow, then refresh.`
}

function orderFundingAmountMicroUsd(amountUsd: number) {
  return Math.max(1, Math.ceil(amountUsd * 1_000_000))
}

function depositWalletBalanceMicroUsd(readiness: TradingReadiness | null | undefined) {
  const raw = readiness ? tradingOption(readiness, 'deposit_wallet')?.balance?.raw ?? readiness.balance.raw : null
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function draftTickSize(draft: Pick<ScriptOrderCandidate, 'tickSize'>) {
  return positiveNumberOrNull(draft.tickSize) ?? 0.01
}

function defaultLimitPrice(price: number | null | undefined, tickSize?: number | null) {
  return roundDraftPrice(positiveNumberOrNull(price) ?? 0.5, tickSize)
}

function estimateDraftAmountUsd(draft: Pick<ScriptOrderCandidate, 'amountUsd' | 'limitPrice' | 'price' | 'size'> & { sizingMode: OrderSizingMode }) {
  if (draft.sizingMode === 'amountUsd') return positiveNumberOrNull(draft.amountUsd)
  const size = positiveNumberOrNull(draft.size)
  const price = positiveNumberOrNull(draft.limitPrice) ?? positiveNumberOrNull(draft.price)
  return size != null && price != null ? Number((size * price).toFixed(2)) : null
}

function estimateDraftSize(draft: Pick<ScriptOrderCandidate, 'amountUsd' | 'limitPrice' | 'price' | 'size'> & { sizingMode: OrderSizingMode }) {
  if (draft.sizingMode === 'size') return positiveNumberOrNull(draft.size)
  const amountUsd = positiveNumberOrNull(draft.amountUsd)
  const price = positiveNumberOrNull(draft.limitPrice) ?? positiveNumberOrNull(draft.price)
  return amountUsd != null && price != null && price > 0 ? roundDraftSize(amountUsd / price) : null
}

function scriptMarketTradable(market: Pick<BackendScript['markets'][number], 'active' | 'closed' | 'archived' | 'staleDetectedAt' | 'acceptingOrders' | 'enableOrderBook'>) {
  return market.active !== false
    && market.closed !== true
    && market.archived !== true
    && !market.staleDetectedAt
    && market.acceptingOrders !== false
    && market.enableOrderBook !== false
}

function scriptMarketStatusLabel(market: Pick<BackendScript['markets'][number], 'active' | 'closed' | 'archived' | 'staleDetectedAt' | 'acceptingOrders' | 'enableOrderBook'>) {
  if (market.closed) return copy('Market closed')
  if (market.archived) return copy('Market archived')
  if (market.staleDetectedAt) return copy('Market data is stale')
  if (market.active === false) return copy('Market inactive')
  if (market.acceptingOrders === false) return copy('Orders paused')
  if (market.enableOrderBook === false) return copy('Order book unavailable')
  return null
}

function orderDraftContextLabel(draft: Pick<ScriptOrderCandidate, 'marketTitle' | 'eventTitle'>) {
  return draft.eventTitle ? `${draft.eventTitle} / ${draft.marketTitle}` : draft.marketTitle
}

function roundDraftPrice(value: number, tickSize?: number | null) {
  const step = positiveNumberOrNull(tickSize) ?? 0.01
  const minPrice = Math.max(0.0001, step)
  const rounded = Math.round(clamp(value, minPrice, 1) / step) * step
  return Number(clamp(rounded, minPrice, 1).toFixed(6))
}

function roundDraftAmount(value: number, minAmount = 0.01) {
  return Number(Math.max(minAmount, value).toFixed(2))
}

function roundDraftSize(value: number, minSize = 0.000001) {
  return Number(Math.max(minSize, value).toFixed(6))
}

function parseDraftNumber(value: string): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatUsd(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return copy('Pending')
  return `$${value.toFixed(value >= 100 ? 0 : 2)}`
}

function formatSignedUsd(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return copy('Pending')
  if (Math.abs(value) < Number.EPSILON) return formatUsd(0)
  return `${value > 0 ? '+' : '-'}${formatUsd(Math.abs(value))}`
}

function sumCurrency(values: Array<number | null | undefined>) {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!numbers.length) return null
  return Number(numbers.reduce((sum, value) => sum + value, 0).toFixed(2))
}

function formatShares(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return copy('Pending')
  if (value >= 100) return value.toFixed(0)
  if (value >= 1) return value.toFixed(2)
  return value.toFixed(4)
}

function buildDefaultOrderDrafts(candidates: ScriptOrderCandidate[], selectedSelectionIds: string[] = []): OrderDraftSelection[] {
  const selectedSelectionIdSet = new Set(selectedSelectionIds)
  return candidates.map((candidate) => {
    const orderMode = candidate.orderMode || 'limit'
    const amountUsd = positiveNumberOrNull(candidate.amountUsd) ?? 10
    const size = positiveNumberOrNull(candidate.size)
    const enabled = selectedSelectionIdSet.size
      ? candidate.isTradable && selectedSelectionIdSet.has(candidate.selectionId)
      : candidate.isTradable && (candidate.userAction === 'buy' || candidate.aiAction === 'buy')
    return {
      ...candidate,
      enabled,
      orderMode,
      limitPrice: orderMode === 'limit' ? defaultLimitPrice(candidate.limitPrice ?? candidate.price, candidate.tickSize) : null,
      amountUsd,
      size,
      sizingMode: size != null && candidate.amountUsd == null ? 'size' : 'amountUsd',
      orderType: 'GTC',
    }
  })
}

function orderDraftsKey(candidates: ScriptOrderCandidate[]) {
  return candidates.map((candidate) => [
    candidate.selectionId,
    candidate.userAction,
    candidate.orderMode,
    candidate.amountUsd ?? '',
    candidate.size ?? '',
    candidate.limitPrice ?? '',
  ].join(':')).join('|')
}

function activeOrderSelectionPayload(draft: OrderDraftSelection) {
  const sizingValue = draft.sizingMode === 'size' ? positiveNumberOrNull(draft.size) : positiveNumberOrNull(draft.amountUsd)
  return {
    selectionId: draft.selectionId,
    orderMode: draft.orderMode,
    ...(draft.sizingMode === 'size' ? { size: sizingValue } : { amountUsd: sizingValue }),
    ...(draft.orderMode === 'limit' ? { limitPrice: draft.limitPrice, orderType: draft.orderType } : {}),
  }
}

function scriptOrderCandidates(script: BackendScript): ScriptOrderCandidate[] {
  return script.markets.flatMap((scriptMarket) =>
    scriptMarket.outcomes.map((outcome) => ({
      selectionId: outcome.selectionId,
      marketId: scriptMarket.marketId,
      marketTitle: scriptMarket.title,
      eventTitle: scriptMarket.eventTitle ?? null,
      layer: scriptMarket.layer,
      outcomeId: outcome.outcomeId,
      outcomeLabel: outcome.label,
      tokenId: outcome.tokenId,
      aiAction: outcome.aiAction,
      userAction: outcome.userAction,
      side: outcome.side || 'BUY',
      orderMode: outcome.orderMode || 'limit',
      limitPrice: outcome.limitPrice ?? null,
      size: outcome.size ?? null,
      amountUsd: outcome.amountUsd ?? null,
      confidence: outcome.confidence,
      reason: outcome.reason,
      price: outcome.price ?? scriptMarket.bestAsk ?? scriptMarket.lastTradePrice ?? null,
      tickSize: scriptMarket.tickSize ?? null,
      minOrderSize: scriptMarket.orderMinSize ?? null,
      isTradable: scriptMarketTradable(scriptMarket),
      marketStatus: scriptMarketStatusLabel(scriptMarket),
    })),
  )
}

function scriptOrderChains(script: BackendScript, rootMarketId: string): InferenceScriptChain[] {
  return script.markets
    .filter((scriptMarket) => scriptMarket.marketId !== rootMarketId)
    .map((scriptMarket, index) => {
      const buyOutcomes = scriptMarket.outcomes.filter((outcome) => outcome.aiAction === 'buy' || outcome.userAction === 'buy')
      const direction = normalizeInferenceDirection(scriptMarket.impactDirection)
      return {
        id: scriptMarket.scriptMarketId || `script_market_${scriptMarket.marketId}_${index}`,
        title: copy(`${inferenceLayerLabel(scriptMarket.layer)}: ${trimNodeTitle(scriptMarket.title, 30)}`),
        summary: scriptMarket.reason || buyOutcomes[0]?.reason || copy(
          'AI included this market in a tradable causal path. Review the live order book before submitting.',
        ),
        confidence: scriptMarket.confidence ?? 0.5,
        expectedReturnHint: copy(
          'Executable selections are ready. Confirm amount, size, and limit price in the order draft below.',
        ),
        legs: buyOutcomes.map((outcome) => {
          return {
            selectionId: outcome.selectionId,
            marketId: scriptMarket.marketId,
            marketTitle: scriptMarket.title,
            eventTitle: scriptMarket.eventTitle ?? null,
            side: `Buy ${outcome.label}`,
            probability: unitPriceToPercent(outcome.limitPrice ?? outcome.price ?? scriptMarket.bestAsk ?? scriptMarket.lastTradePrice),
            direction,
            impact: inferenceImpactSummary(scriptMarket.impactDirection),
            confidence: outcome.confidence ?? scriptMarket.confidence ?? 0.5,
            rationale: outcome.reason || scriptMarket.reason || copy('AI recommends buying this outcome.'),
            orderHint: `Buy ${outcome.label}`,
          }
        }),
      }
    })
    .filter((chain) => chain.legs.length)
    .slice(0, 4)
}

async function patchScriptSelection(scriptId: string, draft: OrderDraftSelection, token: string) {
  const body = draft.enabled
    ? {
        userAction: 'buy',
        orderMode: draft.orderMode,
        ...(draft.orderMode === 'limit' ? { limitPrice: draft.limitPrice } : {}),
        ...(draft.sizingMode === 'size' ? { size: draft.size } : { amountUsd: draft.amountUsd }),
      }
    : {
        userAction: 'skip',
      }

  await fetch(`${API_PREFIX}/scripts/${scriptId}/outcome-selections/${draft.selectionId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  }).then((response) => readApiData<unknown>(response))
}

async function createOrderPreview(
  scriptId: string,
  executionMode: OrderExecutionMode,
  activeDrafts: OrderDraftSelection[],
  token: string,
  tradingAccountType: TradingAccountType,
) {
  return fetch(`${API_PREFIX}/orders/preview`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      scriptId,
      executionMode,
      tradingAccountType,
      selections: activeDrafts.map(activeOrderSelectionPayload),
    }),
  }).then((response) => readApiData<OrderPreview>(response))
}

async function prepareOrderSignatures(
  preview: OrderPreview,
  walletAddress: string,
  chainId: number,
  token: string,
) {
  return fetch(`${API_PREFIX}/orders/prepare-signature`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      intentId: preview.intentId,
      executionMode: preview.executionMode,
      walletAddress,
      chainId,
      tradingAccountType: preview.tradingAccountType ?? preview.requestedTradingAccountType ?? 'auto',
    }),
  }).then((response) => readApiData<PrepareSignatureResult>(response))
}

async function getOrderIntent(intentId: string, token: string) {
  return fetch(`${API_PREFIX}/orders/intents/${intentId}`, {
    headers: authHeaders(token),
  }).then((response) => readApiData<OrderIntentDetail>(response))
}

async function submitOrderIntent(
  preview: OrderPreview,
  signedOrders: Array<{ orderId: string; signature: unknown }>,
  token: string,
) {
  const submitPayload = orderSubmitPayload(preview, signedOrders)
  return fetch(`${API_PREFIX}/orders/submit`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'X-Causeway-Client-Version': ORDER_SUBMIT_CLIENT_VERSION,
      'X-Causeway-Signed-Orders-Shape': submitPayload.signedOrdersShape,
    },
    body: submitPayload.bodyText,
  }).then((response) => readApiData<OrderSubmitResult>(response))
}

async function fetchOpenOrders(token: string) {
  return fetch(`${API_PREFIX}/orders/open`, {
    headers: authHeaders(token),
  }).then((response) => readApiData<OpenOrdersResult>(response))
}

async function fetchPortfolioSummary(token: string) {
  return fetch(`${API_PREFIX}/portfolio/summary`, {
    headers: authHeaders(token),
  }).then((response) => readApiData<PortfolioSummary>(response))
}

async function fetchPortfolioPositions(token: string) {
  return fetch(`${API_PREFIX}/portfolio/positions`, {
    headers: authHeaders(token),
  }).then((response) => readApiData<PortfolioPositionsResult>(response))
}

async function syncPortfolioPositions(token: string) {
  return fetch(`${API_PREFIX}/portfolio/positions/sync`, {
    method: 'POST',
    headers: authHeaders(token),
  }).then((response) => readApiData<unknown>(response))
}

async function fetchPortfolioOrders(token: string) {
  return fetch(`${API_PREFIX}/portfolio/orders?limit=30`, {
    headers: authHeaders(token),
  }).then((response) => readApiData<PortfolioOrdersResult>(response))
}

async function fetchPortfolioTrades(token: string) {
  return fetch(`${API_PREFIX}/portfolio/trades?limit=30`, {
    headers: authHeaders(token),
  }).then((response) => readApiData<PortfolioTradesResult>(response))
}

async function cancelOpenOrder(orderId: string, token: string) {
  return fetch(`${API_PREFIX}/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
  }).then((response) => readApiData<CancelOrderResult>(response))
}

async function fetchBridgeWallet(token: string) {
  return fetch(`${API_PREFIX}/bridge/wallet`, {
    headers: authHeaders(token),
  }).then((response) => readApiData<BridgeWalletResult>(response))
}

async function fetchBridgeSupportedAssets(token: string) {
  return fetch(`${API_PREFIX}/bridge/supported-assets`, {
    headers: authHeaders(token),
  }).then((response) => readApiData<BridgeSupportedAssetsResult>(response))
}

async function createBridgeDeposit(token: string) {
  return fetch(`${API_PREFIX}/bridge/deposit`, {
    method: 'POST',
    headers: authHeaders(token),
  }).then((response) => readApiData<BridgeDepositResult>(response))
}

async function createBridgeWithdrawal(token: string, input: { toChainId: string; toTokenAddress: string; recipientAddr: string }) {
  return fetch(`${API_PREFIX}/bridge/withdraw`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  }).then((response) => readApiData<BridgeWithdrawalResult>(response))
}

async function fetchBridgeStatus(token: string, address: string) {
  return fetch(`${API_PREFIX}/bridge/status/${encodeURIComponent(address)}`, {
    headers: authHeaders(token),
  }).then((response) => readApiData<BridgeTransactionStatusResult>(response))
}

async function fetchTradingReadiness(token: string, tradingAccountType: TradingAccountType = 'auto') {
  const params = new URLSearchParams({ tradingAccountType })
  return fetch(`${API_PREFIX}/trading/readiness?${params.toString()}`, {
    headers: authHeaders(token),
  }).then((response) => readApiData<TradingReadiness>(response))
}

async function prepareClobAuth(token: string) {
  return fetch(`${API_PREFIX}/trading/clob-auth/prepare`, {
    method: 'POST',
    headers: authHeaders(token),
  }).then((response) => readApiData<ClobAuthPrepareResult>(response))
}

async function completeClobAuth(token: string, payload: ClobAuthPrepareResult, signature: string) {
  return fetch(`${API_PREFIX}/trading/clob-auth/complete`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      challengeId: payload.challengeId,
      nonce: payload.nonce,
      timestamp: payload.timestamp,
      signature,
    }),
  }).then((response) => readApiData<TradingReadiness>(response))
}

async function ensureDepositWallet(token: string) {
  return fetch(`${API_PREFIX}/trading/deposit-wallet/ensure`, {
    method: 'POST',
    headers: authHeaders(token),
  }).then((response) => readApiData<TradingReadiness>(response))
}

async function prepareDepositWalletApproval(token: string) {
  return fetch(`${API_PREFIX}/trading/deposit-wallet/approve/prepare`, {
    method: 'POST',
    headers: authHeaders(token),
  }).then((response) => readApiData<DepositWalletApprovalPrepareResult>(response))
}

async function completeDepositWalletApproval(token: string, payload: DepositWalletApprovalPrepareResult, signature: string) {
  return fetch(`${API_PREFIX}/trading/deposit-wallet/approve/complete`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      nonce: payload.nonce,
      deadline: payload.deadline,
      signature,
    }),
  }).then((response) => readApiData<DepositWalletActionResult>(response))
}

async function prepareSafeDepositWalletFunding(token: string, amountMicroUsd: number) {
  return fetch(`${API_PREFIX}/trading/deposit-wallet/fund-safe/prepare`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ amountMicroUsd }),
  }).then((response) => readApiData<DepositWalletFundingPrepareResult>(response))
}

async function completeSafeDepositWalletFunding(token: string, payload: DepositWalletFundingPrepareResult, signature: string) {
  return fetch(`${API_PREFIX}/trading/deposit-wallet/fund-safe/complete`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      amountMicroUsd: payload.amountMicroUsd,
      safeAddress: payload.safeAddress,
      depositWalletAddress: payload.depositWalletAddress,
      nonce: payload.nonce,
      messageHash: payload.messageHash,
      signature,
    }),
  }).then((response) => readApiData<DepositWalletActionResult>(response))
}

async function prepareDepositWalletTransfer(token: string, input: { amountMicroUsd: number; recipientAddress: string }) {
  return fetch(`${API_PREFIX}/trading/deposit-wallet/transfer/prepare`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  }).then((response) => readApiData<DepositWalletTransferPrepareResult>(response))
}

async function completeDepositWalletTransfer(token: string, payload: DepositWalletTransferPrepareResult, signature: string) {
  return fetch(`${API_PREFIX}/trading/deposit-wallet/transfer/complete`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      amountMicroUsd: payload.amountMicroUsd,
      recipientAddress: payload.recipientAddress,
      nonce: payload.nonce,
      deadline: payload.deadline,
      signature,
    }),
  }).then((response) => readApiData<DepositWalletActionResult>(response))
}

async function fetchRelayerTransactionStatus(token: string, transactionId: string) {
  return fetch(`${API_PREFIX}/trading/relayer-transactions/${encodeURIComponent(transactionId)}`, {
    headers: authHeaders(token),
  }).then((response) => readApiData<RelayerTransactionResult>(response))
}

async function waitForDepositWalletReadiness(token: string, initial: TradingReadiness, tradingAccountType: TradingAccountType = 'deposit_wallet') {
  let readiness = initial
  for (let attempt = 0; readiness.status === 'deposit_wallet_pending' && attempt < DEPOSIT_WALLET_POLL_ATTEMPTS; attempt += 1) {
    await sleep(DEPOSIT_WALLET_POLL_INTERVAL_MS)
    readiness = await fetchTradingReadiness(token, tradingAccountType)
  }
  return readiness
}

async function waitForRelayerTransaction(token: string, transactionId: string | null) {
  if (!transactionId) return null
  let latest: RelayerTransactionResult | null = null
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await sleep(2500)
    latest = await fetchRelayerTransactionStatus(token, transactionId)
    if (latest.state === 'STATE_CONFIRMED' || latest.state === 'STATE_MINED') return latest
    if (latest.state === 'STATE_FAILED' || latest.state === 'STATE_INVALID') {
      throw new Error(`Polymarket relayer transaction failed: ${latest.state}`)
    }
  }
  return latest
}

async function waitForFundingReadiness(token: string, requiredUsd: number, tradingAccountType: TradingAccountType) {
  let readiness = await fetchTradingReadiness(token, tradingAccountType)
  for (let attempt = 0; attempt < 12 && !depositWalletReadyForAmount(readiness, requiredUsd); attempt += 1) {
    await sleep(2500)
    readiness = await fetchTradingReadiness(token, tradingAccountType)
  }
  return readiness
}

async function waitForDepositWalletBalance(token: string, requiredUsd: number, tradingAccountType: TradingAccountType) {
  let readiness = await fetchTradingReadiness(token, tradingAccountType)
  for (let attempt = 0; attempt < 12 && !depositWalletHasCash(readiness, requiredUsd); attempt += 1) {
    await sleep(2500)
    readiness = await fetchTradingReadiness(token, tradingAccountType)
  }
  return readiness
}

async function prepareTradingWalletForRealOrders(input: {
  token: string
  requiredUsd: number
  walletAddress: string | null
  tradingAccountType?: TradingAccountType
  signTypedDataAsync: SignTypedDataAsync
  signMessageAsync: SignMessageAsync
  walletClient?: TypedDataWalletClient | null
  onActivity?: (label: string, detail: string, status?: TradingWalletActivityStatus) => string | null
  updateActivity?: (id: string, status: TradingWalletActivityStatus, detail: string) => void
  onReadiness?: (readiness: TradingReadiness) => void
}) {
  const tradingAccountType = input.tradingAccountType ?? 'auto'
  const requiredUsd = Math.max(positiveNumberOrNull(input.requiredUsd) ?? 0, TRADING_WALLET_MIN_READY_USD)
  const activityId = input.onActivity?.('Prepare trading wallet', 'Checking Deposit Wallet, funds, and permissions.', 'pending') ?? null
  const updateActivity = (status: TradingWalletActivityStatus, detail: string) => {
    if (activityId) input.updateActivity?.(activityId, status, detail)
  }
  const setReadiness = (readiness: TradingReadiness) => {
    input.onReadiness?.(readiness)
  }

  try {
    let readiness = await fetchTradingReadiness(input.token, tradingAccountType)
    setReadiness(readiness)

    if (!readiness.clobApiKeyConfigured) {
      updateActivity('pending', 'Waiting for signature to create Polymarket trading credentials.')
      const authPayload = await prepareClobAuth(input.token)
      const signature = await signTypedDataWithFallback({
        variables: typedDataToSignVariables(authPayload.eip712),
        walletAddress: authPayload.walletAddress,
        signTypedDataAsync: input.signTypedDataAsync,
        walletClient: input.walletClient,
      })
      await completeClobAuth(input.token, authPayload, signature)
      updateActivity('pending', 'Trading credentials are ready. Checking Deposit Wallet and Polymarket Safe balance.')
      readiness = await fetchTradingReadiness(input.token, tradingAccountType)
      setReadiness(readiness)
    }

    if (readiness.tradingAccountType !== 'deposit_wallet') {
      throw new Error('Trading wallet setup is not ready. Refresh the wallet status and try again.')
    }

    if (!readiness.depositWalletDeployed) {
      updateActivity('pending', 'Creating the Deposit Wallet through Polymarket.')
      readiness = await ensureDepositWallet(input.token)
      readiness = await waitForDepositWalletReadiness(input.token, readiness, tradingAccountType)
      setReadiness(readiness)
    }

    if (readiness.status === 'deposit_wallet_pending') {
      updateActivity('pending', 'Deposit Wallet confirmation is pending. Waiting for Polymarket status to refresh.')
      readiness = await waitForDepositWalletReadiness(input.token, readiness, tradingAccountType)
      setReadiness(readiness)
    }

    if (readiness.status === 'deposit_wallet_pending') {
      throw new Error(readiness.reason || 'Deposit Wallet confirmation is still pending. Please try again shortly.')
    }

    const depositCash = readinessCash(readiness) ?? 0
    if (depositCash + Number.EPSILON < requiredUsd) {
      const missingUsd = Math.max(requiredUsd - depositCash, 0)
      const fundingUnavailableMessage = depositWalletFundingUnavailableMessage(readiness, requiredUsd)
      if (fundingUnavailableMessage) throw new Error(fundingUnavailableMessage)
      updateActivity('pending', `Waiting for signature to transfer ${formatUsd(missingUsd)} from Polymarket Safe to Deposit Wallet.`)
      const fundingPayload = await prepareSafeDepositWalletFunding(input.token, orderFundingAmountMicroUsd(missingUsd))
      const fundingSignature = await signRawHashWithFallback({
        messageHash: fundingPayload.messageHash,
        walletAddress: fundingPayload.walletAddress,
        signMessageAsync: input.signMessageAsync,
        walletClient: input.walletClient,
      })
      const funding = await completeSafeDepositWalletFunding(input.token, fundingPayload, fundingSignature)
      updateActivity('pending', 'Safe transfer submitted. Waiting for Polymarket confirmation.')
      await waitForRelayerTransaction(input.token, funding.transaction.transactionId)
      readiness = await waitForDepositWalletBalance(input.token, requiredUsd, tradingAccountType)
      setReadiness(readiness)
    }

    const allowance = readinessAllowance(readiness) ?? 0
    if (allowance + Number.EPSILON < requiredUsd) {
      updateActivity('pending', 'Waiting for signature to enable one-time Deposit Wallet trading permissions.')
      const approvalPayload = await prepareDepositWalletApproval(input.token)
      if (!input.walletAddress) throw new Error('Deposit Wallet permission signing requires the connected wallet address.')
      const approvalSignature = await signTypedDataWithFallback({
        variables: typedDataToSignVariables(approvalPayload.eip712),
        walletAddress: input.walletAddress,
        signTypedDataAsync: input.signTypedDataAsync,
        walletClient: input.walletClient,
      })
      const approval = await completeDepositWalletApproval(input.token, approvalPayload, approvalSignature)
      updateActivity('pending', 'Trading permissions submitted. Waiting for Polymarket confirmation.')
      await waitForRelayerTransaction(input.token, approval.transaction.transactionId)
      readiness = await waitForFundingReadiness(input.token, requiredUsd, tradingAccountType)
      setReadiness(readiness)
    }

    if (!depositWalletReadyForAmount(readiness, requiredUsd)) {
      throw new Error(readiness.reason || `Deposit Wallet still needs enough funds and permissions for at least ${formatUsd(requiredUsd)}.`)
    }

    updateActivity('done', 'Deposit Wallet is ready for Polymarket orders.')
    return readiness
  } catch (error) {
    updateActivity('error', errorMessage(error))
    throw error
  }
}

async function setupTradingWalletBasics(input: {
  token: string
  walletAddress: string | null
  initialReadiness?: TradingReadiness | null
  signTypedDataAsync: SignTypedDataAsync
  walletClient?: TypedDataWalletClient | null
  onLog?: (line: string) => void
  onReadiness?: (readiness: TradingReadiness) => void
}) {
  const log = (line: string) => input.onLog?.(line)
  const setReadiness = (readiness: TradingReadiness) => input.onReadiness?.(readiness)

  if (!input.initialReadiness) log('Checking your account status...')
  let readiness = input.initialReadiness ?? await fetchTradingReadiness(input.token, 'deposit_wallet')
  setReadiness(readiness)
  if (readiness.depositWalletAddress) log(`Deposit Wallet address: ${shortAddress(readiness.depositWalletAddress)}`)

  if (readiness.status === 'disabled' || readiness.status === 'unavailable') {
    throw new Error(readiness.reason || 'Polymarket trading setup is unavailable.')
  }

  if (!readiness.depositWalletDeployed) {
    log('Deposit Wallet is not deployed yet.')
    log('Creating your Deposit Wallet through Polymarket...')
    log('This setup does not require gas from your connected wallet.')
    readiness = await ensureDepositWallet(input.token)
    readiness = await waitForDepositWalletReadiness(input.token, readiness, 'deposit_wallet')
    setReadiness(readiness)
    if (!readiness.depositWalletDeployed) {
      throw new Error(readiness.reason || 'Deposit Wallet deployment is still pending.')
    }
    log('Deposit Wallet is ready.')
    if (readiness.depositWalletAddress) log(`Wallet address: ${shortAddress(readiness.depositWalletAddress)}`)
  }

  const allowance = readinessAllowance(readiness) ?? 0
  if (allowance + Number.EPSILON < TRADING_WALLET_MIN_READY_USD) {
    log('Enabling Deposit Wallet trading permissions...')
    log('Requesting one-time trading approvals through Polymarket.')
    if (!input.walletAddress) throw new Error('Missing connected wallet address for approval signing.')
    const approvalPayload = await prepareDepositWalletApproval(input.token)
    const approvalSignature = await signTypedDataWithFallback({
      variables: typedDataToSignVariables(approvalPayload.eip712),
      walletAddress: input.walletAddress,
      signTypedDataAsync: input.signTypedDataAsync,
      walletClient: input.walletClient,
    })
    const approval = await completeDepositWalletApproval(input.token, approvalPayload, approvalSignature)
    await waitForRelayerTransaction(input.token, approval.transaction.transactionId)
    log('Trading permissions are enabled.')
    readiness = await fetchTradingReadiness(input.token, 'deposit_wallet')
    setReadiness(readiness)
  }

  if (!readiness.clobApiKeyConfigured) {
    log('Creating Polymarket trading credentials...')
    const authPayload = await prepareClobAuth(input.token)
    const signature = await signTypedDataWithFallback({
      variables: typedDataToSignVariables(authPayload.eip712),
      walletAddress: authPayload.walletAddress,
      signTypedDataAsync: input.signTypedDataAsync,
      walletClient: input.walletClient,
    })
    await completeClobAuth(input.token, authPayload, signature)
    log('Trading credentials are ready.')
    readiness = await fetchTradingReadiness(input.token, 'deposit_wallet')
    setReadiness(readiness)
  }

  log('Trading setup is complete.')
  return readiness
}

async function sleep(ms: number) {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function sleepWithAbort(ms: number, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

async function runBackendInference(
  market: Market,
  settings: InferenceSettingsState,
  signal: AbortSignal,
  onStatus?: (status: BackendInferenceStatus) => void,
): Promise<InferenceResult> {
  const token = getAccessToken()
  if (!token) {
    throw new Error(copy('Sign in with your wallet before starting AI inference.'))
  }
  const inferenceMarket = await loadMarketForInference(market, signal)
  const rootOutcome =
    inferenceMarket.outcomes?.find((outcome) => outcome.outcomeId === settings.rootOutcomeId)
    ?? marketInferenceOutcome(inferenceMarket)
  const rootOutcomeId = rootOutcome?.outcomeId
  if (!rootOutcomeId) {
    throw new Error(copy('This market is missing outcomeId data. Wait for market details to finish loading before starting inference.'))
  }

  const createRun = await fetch(`${API_PREFIX}/inference-runs`, {
    method: 'POST',
    signal,
    headers: authHeaders(token),
    body: JSON.stringify({
      rootMarketId: inferenceMarket.id,
      rootOutcomeId,
      depth: settings.depth,
      maxMarketsPerLayer: inferenceMaxMarketsPerLayer(settings.depth),
      confidenceThreshold: settings.confidenceThreshold,
      model: inferenceModel(settings),
      cacheEnabled: true,
    }),
  }).then((response) => readApiData<BackendInferenceCreateResponse>(response))

  let status: BackendInferenceStatus = {
    id: createRun.runId,
    status: createRun.status,
    stage: createRun.status === 'queued' ? 'queued' : 'candidate_retrieval',
    progress: 0,
    cacheHit: createRun.cacheHit,
    scriptId: createRun.scriptId,
    errorMessage: null,
  }
  onStatus?.(status)

  for (let attempt = 0; attempt < 90; attempt += 1) {
    status = await fetch(`${API_PREFIX}/inference-runs/${createRun.runId}`, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => readApiData<BackendInferenceStatus>(response))
    onStatus?.(status)

    if (status.status === 'completed' && status.scriptId) break
    if (status.status === 'failed' || status.status === 'cancelled') {
      throw new Error(status.errorMessage || `Inference run ${status.status}`)
    }
    await sleepWithAbort(1000, signal)
  }

  if (!status.scriptId) {
    throw new Error(copy('AI inference was created, but the script is not ready yet. Refresh again shortly.'))
  }

  const script = await fetch(`${API_PREFIX}/scripts/${status.scriptId}`, {
    signal,
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => readApiData<BackendScript>(response))

  return scriptToInferenceResult(script, status, inferenceMarket, settings)
}

function inferenceMaxMarketsPerLayer(depth: InferenceDepth) {
  return depth >= 3 ? 3 : 4
}

async function fetchInferenceCapability(signal: AbortSignal): Promise<BackendInferenceCapability> {
  return fetch(`${API_PREFIX}/inference-runs/capability`, { signal })
    .then((response) => readApiData<BackendInferenceCapability>(response))
}

async function fetchUserScripts(
  token: string,
  signal: AbortSignal,
  cursor?: string | null,
  statusFilter: ScriptStatusFilter = 'all',
  query?: string | null,
): Promise<BackendScriptListResponse> {
  const params = new URLSearchParams({ limit: '20' })
  if (cursor) params.set('cursor', cursor)
  if (statusFilter !== 'all') params.set('status', statusFilter)
  const normalizedQuery = query?.trim()
  if (normalizedQuery) params.set('q', normalizedQuery)
  return fetch(`${API_PREFIX}/scripts?${params.toString()}`, {
    signal,
    headers: authHeaders(token),
  }).then((response) => readApiData<BackendScriptListResponse>(response))
}

async function fetchSavedScript(token: string, scriptId: string, signal: AbortSignal): Promise<BackendScript> {
  return fetch(`${API_PREFIX}/scripts/${encodeURIComponent(scriptId)}`, {
    signal,
    headers: authHeaders(token),
  }).then((response) => readApiData<BackendScript>(response))
}

function arcTxUrl(txHash?: string | null) {
  return txHash ? `${arcChain.blockExplorers.default.url}/tx/${txHash}` : null
}

async function verifyArcProofTransaction(anchor: ArcProofAnchor, calldata: string) {
  const client = createPublicClient({
    chain: arcChain,
    transport: http(ARC_RPC_URL),
  })
  const transaction = await client.getTransaction({ hash: anchor.txHash as HexString })
  return transaction.input?.toLowerCase() === calldata.toLowerCase()
}

async function fetchArcProof(token: string, scriptId: string, signal?: AbortSignal): Promise<ArcProofResult> {
  return fetch(`${API_PREFIX}/arc-proofs/scripts/${encodeURIComponent(scriptId)}`, {
    signal,
    headers: authHeaders(token),
  }).then((response) => readApiData<ArcProofResult>(response))
}

async function completeArcProof(token: string, scriptId: string, input: {
  txHash: string
  chainId: number
  fromAddress: string
  traceHash: string
  calldata: string
}): Promise<ArcProofResult> {
  return fetch(`${API_PREFIX}/arc-proofs/scripts/${encodeURIComponent(scriptId)}/complete`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  }).then((response) => readApiData<ArcProofResult>(response))
}

async function loadMarketForInference(market: Market, signal: AbortSignal): Promise<Market> {
  if (marketInferenceOutcome(market)) return market

  const params = eventDetailParamsForMarket(market)
  const detail = await fetch(`${API_PREFIX}/events/detail?${params.toString()}`, { signal })
    .then((response) => readApiData<EventDetailResponse['data']>(response))
  const selectedMarket = detail.selectedMarket ? apiNodeToMarket(detail.selectedMarket, 0) : null
  if (selectedMarket && marketInferenceOutcome(selectedMarket)) return selectedMarket

  const relatedMarkets = detail.markets.map(apiNodeToMarket)
  const relatedMarket = relatedMarkets.find((item) => item.id === (market.marketId ?? market.id) && marketInferenceOutcome(item))
  return relatedMarket ?? relatedMarkets.find(marketInferenceOutcome) ?? market
}

async function fetchMarketPriceHistory(tokenIds: string[], signal: AbortSignal) {
  if (!tokenIds.length) return {}
  const params = new URLSearchParams({ tokenIds: tokenIds.join(','), interval: 'all', fidelity: '1440' })
  const data = await fetch(`${API_PREFIX}/markets/history?${params.toString()}`, { signal })
    .then((response) => readApiData<PriceHistoryResponse['data']>(response))
  return data.history || {}
}

function eventDetailParamsForMarket(market: Market) {
  const params = new URLSearchParams()
  if (market.nodeType === 'event' && (market.eventId || market.id)) {
    params.set('eventId', market.eventId || market.id)
    return params
  }
  if (market.marketId) {
    params.set('marketId', market.marketId)
    return params
  }
  if (market.eventId && !market.outcomes?.length) {
    params.set('eventId', market.eventId)
    return params
  }
  params.set('marketId', market.id)
  return params
}

function scriptCompletedRun(script: BackendScript): BackendInferenceStatus {
  const inferenceRun = script.inferenceRun
  if (inferenceRun) {
    return {
      id: inferenceRun.id,
      status: inferenceRun.status,
      stage: inferenceRun.stage,
      progress: inferenceRun.progress,
      cacheHit: inferenceRun.cacheHit,
      scriptId: script.id,
      errorMessage: inferenceRun.errorMessage,
      model: inferenceRun.model,
      createdAt: inferenceRun.createdAt,
      completedAt: inferenceRun.completedAt,
    }
  }

  return {
    id: script.id,
    status: 'completed',
    stage: null,
    progress: 100,
    cacheHit: false,
    scriptId: script.id,
    errorMessage: null,
    createdAt: script.createdAt,
    completedAt: script.updatedAt,
  }
}

function scriptListItemMarket(item: BackendScriptListItem, index = 0): Market {
  const price = unitPriceToPercent(item.rootPrice) ?? 0
  return {
    id: item.rootMarketId,
    title: item.title,
    eventId: item.rootEventId,
    eventSlug: item.rootEventSlug,
    eventTitle: item.rootEventTitle,
    category: 'Polymarket',
    icon: 'globe',
    iconUrl: item.icon || item.image,
    price,
    change: 0,
    volume: formatCompactMoney(item.rootVolume),
    volumeValue: item.rootVolume,
    liquidity: item.rootLiquidity,
    traders: item.rootVolume24hr == null ? copy('24h no data') : `24h ${formatCompactMoney(item.rootVolume24hr)}`,
    outcomes: item.rootOutcomeLabel
      ? [{ outcomeId: item.rootOutcomeId, label: item.rootOutcomeLabel, price: item.rootPrice, tokenId: null }]
      : [],
    x: 50,
    y: 50,
    tone: index % 5 === 0 ? 'purple' : index % 3 === 0 ? 'orange' : index % 2 === 0 ? 'green' : 'blue',
  }
}

function scriptRootMarket(script: BackendScript, fallback?: BackendScriptListItem): Market {
  const rootMarketId = script.root?.marketId ?? fallback?.rootMarketId ?? script.markets[0]?.marketId ?? script.id
  const rootOutcomeId = script.root?.outcomeId ?? fallback?.rootOutcomeId ?? ''
  const rootScriptMarket =
    script.markets.find((item) => item.marketId === rootMarketId)
    ?? script.markets.find((item) => item.layer === 0)
    ?? script.markets[0]
  const rootOutcome =
    rootScriptMarket?.outcomes.find((outcome) => outcome.outcomeId === rootOutcomeId)
    ?? rootScriptMarket?.outcomes.find((outcome) => outcome.userAction === 'buy')
    ?? rootScriptMarket?.outcomes[0]
  const price = rootOutcome?.price ?? rootOutcome?.limitPrice ?? rootScriptMarket?.bestAsk ?? rootScriptMarket?.lastTradePrice ?? fallback?.rootPrice ?? null
  const volume = rootScriptMarket?.volume ?? fallback?.rootVolume ?? null
  const volume24hr = rootScriptMarket?.volume24hr ?? fallback?.rootVolume24hr ?? null
  const liquidity = rootScriptMarket?.liquidity ?? fallback?.rootLiquidity ?? null

  return {
    id: rootMarketId,
    title: rootScriptMarket?.title ?? fallback?.title ?? script.title,
    eventId: rootScriptMarket?.eventId ?? fallback?.rootEventId ?? null,
    eventSlug: rootScriptMarket?.eventSlug ?? fallback?.rootEventSlug ?? null,
    eventTitle: rootScriptMarket?.eventTitle ?? fallback?.rootEventTitle ?? null,
    category: 'Polymarket',
    icon: 'globe',
    iconUrl: rootScriptMarket?.icon || rootScriptMarket?.image || fallback?.icon || fallback?.image || null,
    price: unitPriceToPercent(price) ?? 0,
    change: 0,
    volume: formatCompactMoney(volume),
    volumeValue: volume,
    liquidity,
    traders: volume24hr == null ? copy('24h no data') : `24h ${formatCompactMoney(volume24hr)}`,
    bestAsk: rootScriptMarket?.bestAsk ?? null,
    lastTradePrice: rootScriptMarket?.lastTradePrice ?? null,
    orderMinSize: rootScriptMarket?.orderMinSize ?? null,
    tickSize: rootScriptMarket?.tickSize ?? null,
    outcomes: rootScriptMarket?.outcomes.map((outcome) => ({
      outcomeId: outcome.outcomeId,
      label: outcome.label,
      price: outcome.price ?? outcome.limitPrice ?? null,
      tokenId: outcome.tokenId,
    })) ?? (fallback?.rootOutcomeLabel ? [{ outcomeId: fallback.rootOutcomeId, label: fallback.rootOutcomeLabel, price: fallback.rootPrice, tokenId: null }] : []),
    x: 50,
    y: 50,
    tone: 'purple',
  }
}

function scriptStatusLabel(status: string) {
  if (status === 'active') return copy('Submitted')
  if (status === 'archived') return copy('Archived')
  if (status === 'draft') return copy('Draft')
  return status
}

function scriptStatusClass(status: string) {
  if (status === 'active') return 'done'
  if (status === 'archived') return 'archived'
  return 'running'
}

function scriptToInferenceResult(script: BackendScript, run: BackendInferenceStatus, market: Market, settings: InferenceSettingsState): InferenceResult {
  const nodeByNodeId = new Map(script.graph.nodes.map((node) => [node.nodeId, node]))
  const titleByNodeId = new Map(script.graph.nodes.map((node) => [node.nodeId, node.title]))
  const orderCandidates = scriptOrderCandidates(script)
  const relatedMarkets = script.markets
    .filter((item) => item.marketId !== market.id)
    .map<InferenceRelatedMarket>((item) => ({
      id: item.marketId,
      title: item.title,
      eventTitle: item.eventTitle ?? null,
      category: 'Polymarket',
      price: scriptMarketPricePercent(item),
      volume: scriptMarketVolumeLabel(item),
      icon: item.icon,
      image: item.image,
      confidence: item.confidence ?? 0,
      relation: inferenceLayerLabel(item.layer),
      direction: normalizeInferenceDirection(item.impactDirection),
      impact: inferenceImpactSummary(item.impactDirection),
      reason: item.reason || item.outcomes[0]?.reason,
    }))

  return {
    runId: run.id,
    scriptId: script.id,
    status: 'completed',
    aiAvailable: true,
    model: run.model ?? script.inferenceRun?.model ?? inferenceModel(settings),
    rootMarket: {
      id: market.id,
      title: market.title,
      price: market.price,
      volume: market.volumeValue,
      liquidity: market.liquidity,
      endDate: market.endDate,
    },
    summary: script.summary,
    thesis: script.summary,
    confidence: relatedMarkets[0]?.confidence ?? 0.6,
    causalLinks: script.graph.edges.map((edge) => ({
      source: titleByNodeId.get(edge.sourceNodeId) || edge.sourceNodeId,
      target: titleByNodeId.get(edge.targetNodeId) || edge.targetNodeId,
      direction: edge.relation,
      confidence: edge.confidence,
      impact: inferenceImpactSummary(edge.relation),
      rationale: edge.reason,
      sourceMarketId: nodeByNodeId.get(edge.sourceNodeId)?.marketId ?? null,
      targetMarketId: nodeByNodeId.get(edge.targetNodeId)?.marketId ?? null,
    })),
    scriptChains: scriptOrderChains(script, market.id),
    scenarios: [],
    riskFactors: [],
    evidence: [],
    relatedMarkets,
    orderCandidates,
    logs: [
      copy('Backend inference run created.'),
      copy(`Run status: ${run.status}, progress: ${run.progress}%.`),
      copy('Generated causal script loaded.'),
    ],
    generatedAt: run.completedAt || script.updatedAt,
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

const rootMarket: Market = {
  id: 'empty-market-selection',
  title: copy('Select a Polymarket market'),
  category: 'Polymarket',
  icon: 'globe',
  price: 0,
  change: 0,
  volume: copy('No data'),
  traders: copy('No data'),
  x: 48,
  y: 46,
  tone: 'purple',
}

const categoryTones: Record<string, Market['tone']> = {
  politics: 'blue',
  macro: 'green',
  crypto: 'orange',
  tech: 'cyan',
  sports: 'purple',
  entertainment: 'purple',
  other: 'purple',
}

const primaryMarketCategoryKeys = ['hot', 'new'] as const
const primaryMarketCategoryKeySet = new Set<string>(primaryMarketCategoryKeys)

function orderVisibleMarketCategories(categories: ApiMarketCategory[]) {
  const byKey = new Map(categories.map((category) => [category.key, category]))
  const primary = primaryMarketCategoryKeys
    .map((key) => byKey.get(key))
    .filter((category): category is ApiMarketCategory => Boolean(category))
  const secondary = categories.filter((category) => category.key !== 'all' && !primaryMarketCategoryKeySet.has(category.key))
  return [...primary, ...secondary]
}

function normalizeInferenceDirection(value: string | null | undefined) {
  const normalized = (value || '').toLowerCase()
  if (['positive', 'support', 'supports', 'cause', 'causes'].includes(normalized)) return 'positive'
  if (['negative', 'oppose', 'opposes', 'contradict', 'contradicts'].includes(normalized)) return 'negative'
  if (['conditional', 'hedge', 'hedges', 'correlate', 'correlates'].includes(normalized)) return 'conditional'
  return 'unknown'
}

function directionLabel(value: string | null | undefined) {
  const normalized = (value || '').toLowerCase()
  if (['supports', 'support'].includes(normalized)) return copy('Supports')
  if (['causes', 'cause'].includes(normalized)) return copy('Causal impact')
  if (['opposes', 'oppose', 'contradicts', 'contradict'].includes(normalized)) return copy('Opposes')
  if (['hedges', 'hedge'].includes(normalized)) return copy('Hedge')
  if (['correlates', 'correlate'].includes(normalized)) return copy('Correlated')
  if (['unclear', 'unknown'].includes(normalized)) return copy('Unclear impact')
  if (normalized === 'positive') return copy('Positive')
  if (normalized === 'negative') return copy('Negative')
  if (normalized === 'conditional') return copy('Conditional')
  return copy('Unclear impact')
}

function inferenceLayerLabel(layer: number | null | undefined) {
  if (layer == null || !Number.isFinite(layer)) return copy('Related market')
  if (layer <= 0) return copy('Root market')
  if (layer === 1) return copy('Layer 1 link')
  if (layer === 2) return copy('Layer 2 link')
  if (layer === 3) return copy('Layer 3 link')
  return copy(`Layer ${layer} link`)
}

function inferenceImpactSummary(direction: string | null | undefined) {
  const normalized = (direction || '').toLowerCase()
  if (['supports', 'support', 'positive', 'causes', 'cause'].includes(normalized)) return copy('Raises the target outcome probability')
  if (['opposes', 'oppose', 'negative', 'contradicts', 'contradict'].includes(normalized)) return copy('Lowers the target outcome probability')
  if (['hedges', 'hedge'].includes(normalized)) return copy('Hedges root-market risk')
  if (['correlates', 'correlate', 'conditional'].includes(normalized)) return copy('Correlation requires condition review')
  return copy('Impact direction is unclear')
}

function defaultOrderHintForDirection(direction: string | null | undefined) {
  return normalizeInferenceDirection(direction) === 'negative' ? 'Buy No' : 'Buy Yes'
}

function scriptMarketUnitPrice(scriptMarket: BackendScript['markets'][number]) {
  const buyOutcome = scriptMarket.outcomes.find((outcome) => outcome.aiAction === 'buy' || outcome.userAction === 'buy')
  return buyOutcome?.price ?? buyOutcome?.limitPrice ?? scriptMarket.bestAsk ?? scriptMarket.lastTradePrice ?? scriptMarket.outcomes[0]?.price ?? null
}

function scriptMarketPricePercent(scriptMarket: BackendScript['markets'][number]) {
  return unitPriceToPercent(scriptMarketUnitPrice(scriptMarket))
}

function scriptMarketVolumeLabel(scriptMarket: BackendScript['markets'][number]) {
  const volume = scriptMarket.volume24hr ?? scriptMarket.volume
  return volume == null || Number.isNaN(volume) ? copy('No volume') : formatCompactMoney(volume)
}

function marketSubtitle(market: Market) {
  return [market.category, market.eventTitle, market.officialCategory || market.tags?.[0]]
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ') || copy('Polymarket market')
}

function marketRuleCopy(market: Market) {
  return market.rules?.trim() || market.description?.trim() || copy('Polymarket has not provided detailed rules for this market.')
}

function marketDescriptionCopy(market: Market) {
  return market.description?.trim() || market.rules?.trim() || copy('This market comes from Polymarket. No additional description is currently available.')
}

function marketChangeText(market: Market) {
  if (!market.change) return '0%'
  return `${market.change > 0 ? '+' : ''}${market.change}%`
}

function formatLimitPrice(price: number | null | undefined) {
  if (price == null || Number.isNaN(price)) return 'N/A'
  const normalized = clamp(price, 0, 1)
  return normalized.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

function eventToMarket(event: EventDetail['event'], fallback: Market): Market {
  if (!event) return fallback
  const category = event.category || fallback.category
  const categoryKey = event.categoryKey || fallback.categoryKey || category
  return {
    ...fallback,
    id: event.id || fallback.eventId || fallback.id,
    nodeType: 'event',
    marketId: fallback.marketId ?? null,
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
    marketsCount: event.marketsCount ?? fallback.marketsCount,
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
const FLOW_NODE_HEIGHT = 108
const FLOW_FOCUS_WIDTH = 260
const FLOW_FOCUS_HEIGHT = 138
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
  const category = node.category || copy('Other')
  const categoryKey = node.categoryKey || category
  const price = node.price == null ? 0 : Math.round(node.price <= 1 ? node.price * 100 : node.price)
  return {
    id: node.id,
    nodeType: node.nodeType ?? 'market',
    marketId: node.marketId ?? (node.nodeType === 'event' ? null : node.id),
    slug: node.slug,
    title: node.title,
    groupItemTitle: node.groupItemTitle,
    category,
    categoryKey,
    officialCategory: node.officialCategory,
    tags: node.tags || [],
    icon: categoryKey === 'crypto'
      ? 'bitcoin'
      : categoryKey === 'tech'
        ? 'cpu'
        : categoryKey === 'macro'
          ? 'bank'
          : 'landmark',
    iconUrl: node.icon || node.image,
    eventId: node.eventId,
    eventSlug: node.eventSlug,
    eventTitle: node.eventTitle,
    endDate: node.endDate,
    description: node.description,
    rules: node.rules,
    active: node.active ?? true,
    closed: node.closed ?? false,
    archived: node.archived ?? false,
    staleDetectedAt: node.staleDetectedAt ?? null,
    acceptingOrders: node.acceptingOrders ?? true,
    enableOrderBook: node.enableOrderBook ?? true,
    syncedAt: node.syncedAt,
    outcomes: node.outcomes || [],
    bestBid: node.bestBid,
    bestAsk: node.bestAsk,
    lastTradePrice: node.lastTradePrice,
    orderMinSize: node.orderMinSize,
    tickSize: node.tickSize,
    marketsCount: node.marketsCount ?? null,
    topMarkets: node.topMarkets || [],
    price,
    change: 0,
    volume: formatCompactMoney(node.volume),
    volumeValue: node.volume,
    liquidity: node.liquidity,
    traders: node.volume24hr ? formatCompactMoney(node.volume24hr) : copy('24h no data'),
    x: node.x ?? 50,
    y: node.y ?? 50,
    tone: categoryTones[categoryKey] || categoryTones[category] || (index % 5 === 0 ? 'purple' : index % 3 === 0 ? 'orange' : index % 2 === 0 ? 'green' : 'blue'),
  }
}

type AppProps = {
  showIntro?: boolean
}

function App({ showIntro = false }: AppProps) {
  const auth = useCausewayAuth()
  const membershipState = useMembershipState(auth)
  const autoSignInAttemptedRef = useRef(false)
  const [view, setView] = useState<View>('network')
  const [selectedMarket, setSelectedMarket] = useState<Market>(rootMarket)
  const [inferenceResult, setInferenceResult] = useState<InferenceResult | null>(null)
  const [inferenceSettings, setInferenceSettings] = useState<InferenceSettingsState>(defaultInferenceSettings)
  const [introVisible, setIntroVisible] = useState(showIntro)
  const [tradingWalletActivityItems, setTradingWalletActivityItems] = useState<TradingWalletActivityItem[]>([])
  const [searchFocusRequest, setSearchFocusRequest] = useState(0)
  const activeNav = view === 'scripts' ? 'scripts' : view === 'account' ? 'account' : 'network'

  const addTradingWalletActivity = useCallback((label: string, detail: string, status: TradingWalletActivityStatus = 'pending') => {
    const id = createIdempotencyKey()
    setTradingWalletActivityItems((items) => [
      { id, label, detail, status, createdAt: new Date().toISOString() },
      ...items.slice(0, 19),
    ])
    return id
  }, [])

  const updateTradingWalletActivity = useCallback((id: string, status: TradingWalletActivityStatus, detail: string) => {
    setTradingWalletActivityItems((items) => items.map((item) => (item.id === id ? { ...item, status, detail } : item)))
  }, [])

  const tradingWalletActivity = useMemo<TradingWalletActivityContextValue>(() => ({
    activityItems: tradingWalletActivityItems,
    addActivity: addTradingWalletActivity,
    updateActivity: updateTradingWalletActivity,
  }), [addTradingWalletActivity, tradingWalletActivityItems, updateTradingWalletActivity])

  useEffect(() => {
    if (!showIntro) {
      return undefined
    }
    const timer = window.setTimeout(() => setIntroVisible(false), 2600)
    return () => window.clearTimeout(timer)
  }, [showIntro])

  useEffect(() => {
    if (!auth.isConnected || auth.isAuthenticated) {
      autoSignInAttemptedRef.current = false
      return
    }
    if (auth.isSigningIn || autoSignInAttemptedRef.current) return
    autoSignInAttemptedRef.current = true
    void auth.signIn().catch(() => {
      // The auth hook exposes the error state; avoid repeating wallet popups after rejection.
    })
  }, [auth])

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
  const openInferenceSettings = useCallback((market?: Market, outcomeId?: string | null) => {
    if (market) setSelectedMarket(market)
    setInferenceSettings((current) => ({ ...current, rootOutcomeId: outcomeId ?? null }))
    setView('infer')
  }, [])
  const openSavedScript = useCallback((market: Market, result: InferenceResult) => {
    setSelectedMarket(market)
    setInferenceResult(result)
    setView('script')
  }, [])
  const openNetworkSearch = useCallback(() => {
    setView('network')
    setSearchFocusRequest((request) => request + 1)
  }, [])

  return (
    <TradingWalletActivityContext.Provider value={tradingWalletActivity}>
      <div className={introVisible ? 'app-shell app-intro-active' : 'app-shell'}>
        {introVisible ? <IntroLoader /> : null}
        <Header activeNav={activeNav} auth={auth} membershipState={membershipState} onNavigate={setView} onSearch={openNetworkSearch} />
        <main className={view === 'network' ? 'app-main network-main' : 'app-main'}>
          {view === 'network' && <MarketNetwork onConfirmMarket={openMarketDetail} searchFocusRequest={searchFocusRequest} />}
          {view === 'detail' && <MarketDetail market={selectedMarket} onBack={() => setView('network')} onInfer={openInferenceSettings} />}
          {view === 'infer' && <InferenceSettings auth={auth} initialSettings={inferenceSettings} market={selectedMarket} membershipState={membershipState} onBack={() => setView('detail')} onStart={startInference} />}
          {view === 'account' && <AccountPage auth={auth} />}
          {view === 'progress' && (
            <InferenceProgress
              market={selectedMarket}
              onBack={() => setView('infer')}
              onDone={() => setView('script')}
              onResult={setInferenceResult}
              auth={auth}
              result={inferenceResult}
              settings={inferenceSettings}
            />
          )}
          {view === 'script' && <CausalScript auth={auth} market={selectedMarket} onBack={() => setView('progress')} onScripts={() => setView('scripts')} result={inferenceResult} />}
          {view === 'scripts' && <MyScripts auth={auth} onNew={() => setView('infer')} onOpen={openSavedScript} settings={inferenceSettings} />}
        </main>
      </div>
    </TradingWalletActivityContext.Provider>
  )
}

function IntroLoader() {
  return (
    <div className="causeway-intro" aria-hidden="true">
      <div className="causeway-intro-stage">
        <div className="causeway-intro-mark">
          <span className="causeway-intro-dot" />
          <span className="causeway-intro-line causeway-intro-line-mid" />
          <span className="causeway-intro-line causeway-intro-line-top" />
          <span className="causeway-intro-line causeway-intro-line-bottom" />
        </div>
        <div className="causeway-intro-logo">
          <CausewayLogo />
          <span>Causeway</span>
        </div>
      </div>
      <p>{'origin -> path -> market graph'}</p>
      <span className="causeway-intro-scan" />
    </div>
  )
}

function Header({
  activeNav,
  auth,
  membershipState,
  onNavigate,
  onSearch,
}: {
  activeNav: string
  auth: CausewayAuth
  membershipState: MembershipState
  onNavigate: (view: View) => void
  onSearch: () => void
}) {
  const navItems = [
    { id: 'network', label: copy('Market Network'), view: 'network' as View },
    { id: 'account', label: copy('Account'), view: 'account' as View },
    { id: 'scripts', label: copy('My Scripts'), view: 'scripts' as View },
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
        <button className="arc-audit-button" type="button" onClick={() => onNavigate('scripts')}>
          <ShieldCheck size={16} /> Arc Proof
        </button>
        <MembershipControl auth={auth} membershipState={membershipState} />
        <BridgeWalletControl auth={auth} />
        <button className="icon-button" aria-label={copy('Search')} type="button" onClick={onSearch}>
          <Search size={20} />
        </button>
        <button className="icon-button has-dot" aria-label={copy('Notifications')} type="button">
          <Bell size={20} />
        </button>
        <AccountControls auth={auth} />
      </div>
    </header>
  )
}

function MembershipControl({ auth, membershipState }: { auth: CausewayAuth; membershipState: MembershipState }) {
  const { chainId } = useAccount()
  const { openConnectModal } = useConnectModal()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [paymentTxHash, setPaymentTxHash] = useState<string | null>(null)
  const [pendingPayment, setPendingPayment] = useState<StoredArcPayment | null>(() => readStoredArcPayment())
  const [error, setError] = useState<string | null>(null)
  const membership = membershipState.membership
  const membershipCatalog = membershipState.catalog
  const catalogLoading = membershipState.catalogLoading
  const refreshMembershipCatalog = membershipState.refreshCatalog
  const refreshMembership = membershipState.refreshMembership
  const displayError = error ?? membershipState.error

  const handleAuthenticate = useCallback(async () => {
    setError(null)
    if (!auth.isConnected) {
      openConnectModal?.()
      return
    }
    try {
      await auth.signIn()
      await refreshMembership()
    } catch (authError) {
      setError(errorMessage(authError))
    }
  }, [auth, openConnectModal, refreshMembership])

  const handleOpen = useCallback(() => {
    setOpen(true)
    setError(null)
    setPendingPayment(readStoredArcPayment())
    void refreshMembershipCatalog().catch((fetchError) => setError(errorMessage(fetchError)))
    if (auth.isAuthenticated) {
      void refreshMembership().catch((fetchError) => setError(errorMessage(fetchError)))
    }
  }, [auth.isAuthenticated, refreshMembership, refreshMembershipCatalog])

  const completePaymentVerification = useCallback(async (token: string, storedPayment: StoredArcPayment) => {
    setPaymentTxHash(storedPayment.txHash)
    setPaymentStatus('Payment submitted on Arc. Waiting for confirmation...')
    const verified = await verifyArcPaymentIntentWithRetry(token, storedPayment.intentId, storedPayment.txHash, setPaymentStatus)
    clearStoredArcPayment()
    setPendingPayment(null)
    membershipState.setMembership(verified.membership)
    membershipState.setError(null)
    setPaymentStatus(`Payment confirmed. Premium is active${verified.intent.txHash ? `: ${shortAddress(verified.intent.txHash)}` : '.'}`)
    return verified
  }, [membershipState])

  const handlePay = useCallback(async (sku: MembershipPlan['sku']) => {
    setError(null)
    setPaymentStatus(null)
    setPaymentTxHash(null)
    setLoading(true)
    const shouldReturnToPolygon = chainId === supportedChain.id
    try {
      if (!auth.isConnected) {
        openConnectModal?.()
        return
      }
      if (!auth.isAuthenticated) {
        await auth.signIn()
      }
      const storedSession = readStoredAuthSession()
      const token = auth.accessToken ?? storedSession?.accessToken ?? null
      const payerAddress = auth.walletAddress ?? storedSession?.walletAddress ?? null
      if (!token) throw new Error('Sign in before starting an Arc USDC payment.')
      if (!payerAddress || !isHexAddress(payerAddress)) throw new Error('Connected wallet address is unavailable.')
      const intent = await createArcPaymentIntent(token, sku)
      setPaymentStatus(`Created payment intent. Switching wallet to Arc Testnet...`)
      if (chainId !== arcTestnet.id) {
        await switchChainAsync({ chainId: arcTestnet.id })
      }
      setPaymentStatus(`Confirm ${intent.payment.amountUsd} USDC in your wallet.`)
      const txHash = await writeContractAsync({
        chainId: arcTestnet.id,
        address: intent.payment.tokenAddress as HexAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [intent.payment.receiverAddress as HexAddress, BigInt(intent.payment.amountMicroUsd)],
        account: payerAddress as HexAddress,
      })
      setPaymentTxHash(txHash)
      const storedPayment: StoredArcPayment = {
        intentId: intent.id,
        txHash,
        sku,
        amountUsd: intent.payment.amountUsd,
        expiresAt: intent.expiresAt,
        storedAt: new Date().toISOString(),
      }
      writeStoredArcPayment(storedPayment)
      setPendingPayment(storedPayment)
      await completePaymentVerification(token, storedPayment)
    } catch (paymentError) {
      if (isArcPaymentPermanentError(paymentError)) {
        clearStoredArcPayment()
        setPendingPayment(null)
      }
      setError(errorMessage(paymentError))
    } finally {
      setLoading(false)
      if (shouldReturnToPolygon) {
        switchChainAsync({ chainId: supportedChain.id }).catch(() => undefined)
      }
    }
  }, [auth, chainId, completePaymentVerification, openConnectModal, switchChainAsync, writeContractAsync])

  const handleResumePayment = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      if (!auth.isConnected) {
        openConnectModal?.()
        return
      }
      if (!auth.isAuthenticated) {
        await auth.signIn()
      }
      const token = auth.accessToken ?? readStoredAuthSession()?.accessToken ?? null
      const storedPayment = readStoredArcPayment()
      if (!token) throw new Error('Sign in before resuming Arc payment verification.')
      if (!storedPayment) throw new Error('No pending Arc payment is available to verify.')
      setPendingPayment(storedPayment)
      await completePaymentVerification(token, storedPayment)
    } catch (resumeError) {
      if (isArcPaymentPermanentError(resumeError)) {
        clearStoredArcPayment()
        setPendingPayment(null)
      }
      setError(errorMessage(resumeError))
    } finally {
      setLoading(false)
    }
  }, [auth, completePaymentVerification, openConnectModal])

  const visibleMembership = auth.isAuthenticated ? membership : null
  const isPremium = visibleMembership?.tier === 'premium'
  const paymentInfo = visibleMembership?.payment ?? membershipCatalog?.payment ?? null
  const plans = paymentInfo?.plans ?? []
  const paymentsDisabled = paymentInfo?.enabled === false
  const planActionLabel = auth.isAuthenticated ? 'Pay with Arc USDC' : 'Sign in to pay'
  const paymentNetworkLabel = `Arc Testnet · Chain ${paymentInfo?.chainId ?? arcTestnet.id}`
  return (
    <div className="membership-control">
      <button className={isPremium ? 'membership-pill premium' : 'membership-pill'} type="button" onClick={handleOpen}>
        <Star size={15} />
        {isPremium ? 'Premium' : 'Free'}
      </button>
      {open ? (
        <BodyPortal>
          <div className="wallet-modal-backdrop membership-modal-backdrop" role="presentation" onMouseDown={() => !loading && setOpen(false)}>
            <div className="wallet-modal membership-modal" role="dialog" aria-modal="true" aria-label="Membership" onMouseDown={(event) => event.stopPropagation()}>
              <div className="wallet-modal-head">
                <div>
                  <span><Star size={18} /> Membership</span>
                  <small>Arc USDC payments unlock premium Causeway features without changing trading flow.</small>
                </div>
                <button aria-label="Close membership dialog" className="modal-close-button" type="button" disabled={loading} onClick={() => setOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className="membership-testnet-banner">
                <span>TESTNET</span>
                <b>{paymentNetworkLabel}</b>
                <small>Membership is currently unlocked with testnet USDC only. Do not send mainnet USDC or Polygon USDC to this payment flow.</small>
              </div>
              <div className="membership-summary">
                <div>
                  <span>Current plan</span>
                  <b>{isPremium ? 'Premium' : 'Free'}</b>
                </div>
                <div>
                  <span>Valid until</span>
                  <b>{visibleMembership?.expiresAt ? formatDateTime(visibleMembership.expiresAt) : 'No paid plan'}</b>
                </div>
              </div>
              <div className="membership-benefit-grid">
                <div className="membership-benefit-card">
                  <div className="membership-benefit-title">
                    <span>Free</span>
                    <b>Included</b>
                  </div>
                  <ul>
                    <li><CheckCircle2 size={15} /> GPT-5.4 inference</li>
                    <li><CheckCircle2 size={15} /> Claude Sonnet 4.6 inference</li>
                    <li><CheckCircle2 size={15} /> 1-layer causal market exploration</li>
                    <li><CheckCircle2 size={15} /> Market network, scripts, and trading flow</li>
                  </ul>
                </div>
                <div className="membership-benefit-card premium">
                  <div className="membership-benefit-title">
                    <span>Premium</span>
                    <b>Arc USDC</b>
                  </div>
                  <ul>
                    <li><CheckCircle2 size={15} /> GPT-5.5 inference</li>
                    <li><CheckCircle2 size={15} /> Claude Sonnet/Opus 4.7 and 4.6 inference</li>
                    <li><CheckCircle2 size={15} /> 2-3 layer causal reasoning paths</li>
                    <li><CheckCircle2 size={15} /> Premium AI settings without changing trading custody</li>
                  </ul>
                </div>
              </div>
              {!auth.isAuthenticated ? (
                <button className="primary-button full-width" type="button" onClick={() => void handleAuthenticate()}>
                  {auth.isConnected ? 'Sign in to upgrade' : 'Connect wallet to upgrade'}
                </button>
              ) : null}
              {paymentsDisabled ? (
                <div className="status-note warning wallet-status-note">Arc Testnet USDC payments are not enabled on this backend.</div>
              ) : null}
              {displayError ? <div className="status-note error wallet-status-note">{displayError}</div> : null}
              {paymentStatus ? <div className="status-note wallet-status-note">{paymentStatus}</div> : null}
              {pendingPayment ? (
                <button className="outline-button full-width" disabled={loading} type="button" onClick={() => void handleResumePayment()}>
                  Resume verification for {pendingPayment.amountUsd} USDC
                </button>
              ) : null}
              <div className="membership-plan-head">
                <span>Premium plans</span>
                {paymentInfo ? <small>Paid in testnet {paymentInfo.currency} on {paymentNetworkLabel}</small> : <small>Loading plan availability</small>}
              </div>
              <div className="membership-plan-list">
                {plans.map((plan) => (
                  <button
                    className="membership-plan"
                    disabled={loading || paymentsDisabled}
                    key={plan.sku}
                    type="button"
                    onClick={() => void (auth.isAuthenticated ? handlePay(plan.sku) : handleAuthenticate())}
                  >
                    <span>
                      <b>{plan.label}</b>
                      <small>{plan.durationDays} days - {planActionLabel}</small>
                    </span>
                    <strong>{plan.amountUsd} USDC</strong>
                  </button>
                ))}
              </div>
              {plans.length === 0 ? (
                <div className="membership-empty-note">
                  {catalogLoading ? 'Loading Arc USDC plans...' : 'Premium plans are temporarily unavailable. Free inference remains available.'}
                </div>
              ) : null}
              <div className="soft-note">
                This payment unlocks membership content only. It does not place a Polymarket order and does not authorize Causeway to trade for you.
              </div>
              {paymentTxHash ? (
                <a className="link-button" href={arcExplorerTx(paymentTxHash)} rel="noreferrer" target="_blank">
                  View Arc transaction <ExternalLink size={14} />
                </a>
              ) : null}
            </div>
          </div>
        </BodyPortal>
      ) : null}
    </div>
  )
}

function AccountControls({ auth }: { auth: CausewayAuth }) {
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement | null>(null)

  const copyWalletAddress = useCallback(async (address?: string | null) => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof globalThis.Node && accountMenuRef.current?.contains(event.target)) return
      setMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        if (!mounted) {
          return <button className="cash-pill" type="button" disabled><WalletCards size={16} /> Wallet</button>
        }

        if (!account) {
          return (
            <button className="cash-pill wallet-ready" type="button" onClick={openConnectModal}>
              <WalletCards size={16} />
              Connect wallet
            </button>
          )
        }

        if (!chain || chain.unsupported || chain.id !== supportedChain.id) {
          return (
            <button className="cash-pill wallet-warning" type="button" onClick={openChainModal}>
              <WalletCards size={16} />
              Switch to Polygon
            </button>
          )
        }

        const address = account.address
        const displayAddress = shortAddress(address)

        return (
          <div className={menuOpen ? 'account-menu open' : 'account-menu'} ref={accountMenuRef}>
            <button
              className={auth.isAuthenticated ? 'avatar wallet-avatar-authed' : 'avatar'}
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((current) => !current)}
              disabled={auth.isSigningIn}
            >
              {walletInitials(address)}
            </button>
            <div className="account-popover" role="menu">
              <div className="account-popover-head">
                <span>{displayAddress}</span>
                <small>{chain.name}</small>
              </div>
              {auth.error ? <p className="account-error">{auth.error}</p> : null}
              {!auth.isAuthenticated ? (
                <button className="account-action primary" type="button" onClick={auth.signIn} disabled={auth.isSigningIn}>
                  <ShieldCheck size={16} />
                  {auth.isSigningIn ? 'Waiting for signature' : 'Sign message'}
                </button>
              ) : null}
              <button className="account-action" type="button" onClick={() => copyWalletAddress(address)}>
                <Copy size={16} />
                {copied ? 'Copied' : 'Copy address'}
              </button>
              <button className="account-action" type="button" onClick={() => {
                setMenuOpen(false)
                openAccountModal()
              }}>
                <WalletCards size={16} />
                Wallet details
              </button>
              <button className="account-action danger" type="button" onClick={() => {
                setMenuOpen(false)
                void auth.signOut()
              }}>
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}

function BridgeWalletControl({ auth }: { auth: CausewayAuth }) {
  const { signTypedDataAsync } = useSignTypedData()
  const { data: walletClient } = useWalletClient({ chainId: supportedChain.id })
  const { activityItems, addActivity, updateActivity } = useTradingWalletActivity()
  const [readiness, setReadiness] = useState<TradingReadiness | null>(null)
  const [bridgeWallet, setBridgeWallet] = useState<BridgeWalletResult | null>(null)
  const [supportedAssets, setSupportedAssets] = useState<BridgeSupportedAsset[]>([])
  const [bridgeDeposit, setBridgeDeposit] = useState<BridgeDepositResult | null>(null)
  const [bridgeStatus, setBridgeStatus] = useState<BridgeTransactionStatusResult | null>(null)
  const [walletOpen, setWalletOpen] = useState(false)
  const [walletTab, setWalletTab] = useState<'deposit' | 'withdraw' | 'trade'>('deposit')
  const [ordersOpen, setOrdersOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [openOrders, setOpenOrders] = useState<OpenOrdersResult | null>(null)
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false)
  const [openOrdersError, setOpenOrdersError] = useState<string | null>(null)
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null)
  const [isLoadingBridge, setIsLoadingBridge] = useState(false)
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const [withdrawRecipient, setWithdrawRecipient] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAssetKey, setWithdrawAssetKey] = useState('')
  const [depositChainId, setDepositChainId] = useState('')
  const [depositAssetKey, setDepositAssetKey] = useState('')
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [statusAddress, setStatusAddress] = useState('')
  const [quickSetupOpen, setQuickSetupOpen] = useState(false)
  const [quickSetupRunning, setQuickSetupRunning] = useState(false)
  const [quickSetupStarted, setQuickSetupStarted] = useState(false)
  const [quickSetupLogs, setQuickSetupLogs] = useState<string[]>([])

  const ensureTradingToken = useCallback(async () => {
    if (!auth.isConnected) throw new Error(copy('Connect your wallet first.'))
    if (!auth.isAuthenticated) await auth.signIn()
    const session = readStoredAuthSession()
    const token = session?.accessToken ?? auth.accessToken
    if (!token) throw new Error(copy('Wallet authentication is not complete. Sign in with your wallet first.'))
    return token
  }, [auth])

  const refreshWallet = useCallback(async (token?: string | null) => {
    if (!token) {
      setReadiness(null)
      setBridgeWallet(null)
      return
    }
    try {
      const [wallet, nextReadiness] = await Promise.all([
        fetchBridgeWallet(token),
        fetchTradingReadiness(token, 'deposit_wallet').catch(() => null),
      ])
      setBridgeWallet(wallet)
      if (nextReadiness) setReadiness(nextReadiness)
    } catch (error) {
      setBridgeError(errorMessage(error))
    }
  }, [])

  const refreshOpenOrders = useCallback(async (token?: string | null) => {
    if (!token) {
      setOpenOrders(null)
      setOpenOrdersError(null)
      return
    }
    setOpenOrdersLoading(true)
    setOpenOrdersError(null)
    try {
      setOpenOrders(await fetchOpenOrders(token))
    } catch (error) {
      setOpenOrdersError(errorMessage(error))
    } finally {
      setOpenOrdersLoading(false)
    }
  }, [])

  const depositChainAssets = supportedAssets.filter((asset) => asset.chainId === depositChainId)
  const selectedDepositAsset = supportedAssets.find((item) => assetOptionKey(item) === depositAssetKey)
    ?? depositChainAssets[0]
    ?? supportedAssets[0]
  const selectedDepositAssetKey = selectedDepositAsset ? assetOptionKey(selectedDepositAsset) : ''

  const refreshDepositAddress = useCallback(async (token?: string | null, showLoading = false) => {
    if (!token) {
      setBridgeDeposit(null)
      return
    }
    if (showLoading) setIsLoadingBridge(true)
    setBridgeError(null)
    try {
      const result = await createBridgeDeposit(token)
      setBridgeDeposit(result)
      setBridgeWallet(result.wallet)
      const asset = supportedAssets.find((item) => assetOptionKey(item) === selectedDepositAssetKey)
      const firstAddress = bridgeAddressForAsset(result.deposit.address, asset) ?? firstBridgeAddress(result.deposit.address)
      if (firstAddress) setStatusAddress(firstAddress)
    } catch (error) {
      setBridgeError(errorMessage(error))
    } finally {
      if (showLoading) setIsLoadingBridge(false)
    }
  }, [selectedDepositAssetKey, supportedAssets])

  useEffect(() => {
    const token = auth.accessToken
    const initialTimer = window.setTimeout(() => {
      void refreshWallet(token)
    }, 0)
    if (!token) return () => window.clearTimeout(initialTimer)
    const timer = window.setInterval(() => void refreshWallet(token), 60_000)
    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(timer)
    }
  }, [auth.accessToken, refreshWallet])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuickSetupStarted(false)
      setQuickSetupRunning(false)
      setQuickSetupLogs([])
    }, 0)
    return () => window.clearTimeout(timer)
  }, [auth.walletAddress])

  useEffect(() => {
    if (!auth.accessToken) return
    void fetchBridgeSupportedAssets(auth.accessToken)
      .then((result) => {
        const assets = result.supportedAssets ?? []
        setSupportedAssets(assets)
        const firstAsset = preferredBridgeDepositAsset(assets) ?? assets[0]
        if (firstAsset) {
          setWithdrawAssetKey((current) => current || assetOptionKey(firstAsset))
          setDepositChainId((current) => current || firstAsset.chainId)
          setDepositAssetKey((current) => current || assetOptionKey(firstAsset))
        }
      })
      .catch((error) => setBridgeError(errorMessage(error)))
  }, [auth.accessToken])

  const handleCopy = useCallback(async (value?: string | null) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedAddress(value)
    window.setTimeout(() => setCopiedAddress(null), 1200)
  }, [])

  const handleOpenWallet = useCallback((tab: 'deposit' | 'withdraw' | 'trade' = 'deposit') => {
    setWalletTab(tab)
    setWalletOpen(true)
    void (async () => {
      try {
        const token = auth.accessToken ?? readStoredAuthSession()?.accessToken ?? await ensureTradingToken()
        await refreshWallet(token)
        if (tab === 'deposit') await refreshDepositAddress(token)
      } catch (error) {
        setBridgeError(errorMessage(error))
      }
    })()
  }, [auth.accessToken, ensureTradingToken, refreshDepositAddress, refreshWallet])

  const handleCreateDeposit = useCallback(async () => {
    const token = await ensureTradingToken()
    await refreshDepositAddress(token, true)
  }, [ensureTradingToken, refreshDepositAddress])

  const withdrawAvailable = readiness ? readinessCash(readiness) : null

  const handleSubmitWithdrawTransfer = useCallback(async () => {
    const amountUsd = parseDraftNumber(withdrawAmount)
    const walletAddress = readStoredAuthSession()?.walletAddress ?? auth.walletAddress
    const asset = supportedAssets.find((item) => assetOptionKey(item) === withdrawAssetKey)
    if (!amountUsd) {
      setBridgeError(copy('Enter a valid withdrawal amount.'))
      return
    }
    if (!asset) {
      setBridgeError(copy('Select the receiving chain and token.'))
      return
    }
    if (!withdrawRecipient.trim()) {
      setBridgeError(copy('Enter a recipient address.'))
      return
    }
    if (withdrawAvailable != null && amountUsd > withdrawAvailable + Number.EPSILON) {
      setBridgeError(`Deposit Wallet only has ${formatUsd(withdrawAvailable)} available for withdrawal.`)
      return
    }
    if (!walletAddress) {
      setBridgeError(copy('Connected wallet address is missing. Sign in again.'))
      return
    }
    setIsLoadingBridge(true)
    setBridgeError(null)
    try {
      const token = await ensureTradingToken()
      const withdrawal = await createBridgeWithdrawal(token, {
        toChainId: asset.chainId,
        toTokenAddress: asset.token.address,
        recipientAddr: withdrawRecipient.trim(),
      })
      const bridgeTransferAddress = evmBridgeAddressForDepositWalletTransfer(withdrawal.withdrawal.address)
      if (!bridgeTransferAddress) {
        throw new Error('Polymarket Bridge did not return a Polygon transfer address for this withdrawal.')
      }
      setBridgeWallet(withdrawal.wallet)
      setStatusAddress(bridgeTransferAddress)
      const payload = await prepareDepositWalletTransfer(token, {
        amountMicroUsd: orderFundingAmountMicroUsd(amountUsd),
        recipientAddress: bridgeTransferAddress,
      })
      const signature = await signTypedDataWithFallback({
        variables: typedDataToSignVariables(payload.eip712),
        walletAddress,
        signTypedDataAsync,
        walletClient: walletClient as TypedDataWalletClient | null | undefined,
      })
      const result = await completeDepositWalletTransfer(token, payload, signature)
      await waitForRelayerTransaction(token, result.transaction.transactionId)
      setReadiness(result.readiness)
      setWithdrawAmount('')
      void refreshWallet(token)
      void fetchBridgeStatus(token, bridgeTransferAddress).then((status) => setBridgeStatus(status)).catch(() => null)
    } catch (error) {
      setBridgeError(errorMessage(error))
    } finally {
      setIsLoadingBridge(false)
    }
  }, [auth.walletAddress, ensureTradingToken, refreshWallet, signTypedDataAsync, supportedAssets, walletClient, withdrawAmount, withdrawAssetKey, withdrawAvailable, withdrawRecipient])

  const handleReturnDepositWalletToSafe = useCallback(async () => {
    const walletAddress = readStoredAuthSession()?.walletAddress ?? auth.walletAddress
    const safeAddress = readiness ? tradingOption(readiness, 'gnosis_safe')?.funderAddress : null
    const amountMicroUsd = depositWalletBalanceMicroUsd(readiness)
    if (!safeAddress) {
      setBridgeError('Polymarket Safe address is not available yet. Refresh wallet status and try again.')
      return
    }
    if (!amountMicroUsd) {
      setBridgeError('Deposit Wallet has no pUSD available to return.')
      return
    }
    if (!walletAddress) {
      setBridgeError('Connected wallet address is missing. Sign in again.')
      return
    }
    setIsLoadingBridge(true)
    setBridgeError(null)
    try {
      const token = await ensureTradingToken()
      setStatusAddress(safeAddress)
      setWithdrawRecipient(safeAddress)
      setWithdrawAmount((amountMicroUsd / 1_000_000).toFixed(6).replace(/0+$/, '').replace(/\.$/, ''))
      const payload = await prepareDepositWalletTransfer(token, {
        amountMicroUsd,
        recipientAddress: safeAddress,
      })
      const signature = await signTypedDataWithFallback({
        variables: typedDataToSignVariables(payload.eip712),
        walletAddress,
        signTypedDataAsync,
        walletClient: walletClient as TypedDataWalletClient | null | undefined,
      })
      const result = await completeDepositWalletTransfer(token, payload, signature)
      await waitForRelayerTransaction(token, result.transaction.transactionId)
      setReadiness(result.readiness)
      setWithdrawAmount('')
      void refreshWallet(token)
    } catch (error) {
      setBridgeError(errorMessage(error))
    } finally {
      setIsLoadingBridge(false)
    }
  }, [auth.walletAddress, ensureTradingToken, readiness, refreshWallet, signTypedDataAsync, walletClient])

  const handleCheckStatus = useCallback(async (address?: string | null) => {
    const target = address ?? statusAddress
    if (!target) return
    setIsLoadingBridge(true)
    setBridgeError(null)
    try {
      const token = await ensureTradingToken()
      setBridgeStatus(await fetchBridgeStatus(token, target))
      setStatusAddress(target)
    } catch (error) {
      setBridgeError(errorMessage(error))
    } finally {
      setIsLoadingBridge(false)
    }
  }, [ensureTradingToken, statusAddress])

  const handleQuickSetup = useCallback(async (initialReadiness?: TradingReadiness | null) => {
    if (quickSetupRunning) return
    let completed = false
    setQuickSetupOpen(true)
    setQuickSetupRunning(true)
    setQuickSetupStarted(true)
    setQuickSetupLogs([])
    setBridgeError(null)
    try {
      const token = await ensureTradingToken()
      const next = await setupTradingWalletBasics({
        token,
        walletAddress: readStoredAuthSession()?.walletAddress ?? auth.walletAddress,
        initialReadiness,
        signTypedDataAsync,
        walletClient: walletClient as TypedDataWalletClient | null | undefined,
        onLog: (line) => setQuickSetupLogs((current) => [...current, line]),
        onReadiness: setReadiness,
      })
      setReadiness(next)
      completed = true
      setQuickSetupRunning(false)
      setWalletOpen(false)
      setQuickSetupOpen(false)
      void Promise.allSettled([
        refreshWallet(token),
        refreshDepositAddress(token),
      ])
    } catch (error) {
      const message = errorMessage(error)
      setBridgeError(message)
      setQuickSetupLogs((current) => [...current, `Error: ${message}`])
    } finally {
      if (!completed) {
        setQuickSetupRunning(false)
      }
    }
  }, [auth.walletAddress, ensureTradingToken, quickSetupRunning, refreshDepositAddress, refreshWallet, signTypedDataAsync, walletClient])

  const handleStartTradingSetup = useCallback(() => {
    if (quickSetupRunning) return
    if (readiness && !readinessCanRunQuickSetup(readiness)) {
      setQuickSetupOpen(true)
      setQuickSetupStarted(true)
      setQuickSetupLogs(blockedQuickSetupLogs(readiness))
      return
    }
    void handleQuickSetup(readiness)
  }, [handleQuickSetup, quickSetupRunning, readiness])

  const handleCancelOpenOrder = useCallback(async (order: OpenOrderItem) => {
    const cancelId = order.orderId ?? order.externalOrderId
    if (!cancelId || cancelingOrderId) return
    if (!confirmOpenOrderCancellation(order)) return
    setCancelingOrderId(cancelId)
    setOpenOrdersError(null)
    const activityId = addActivity('Cancel order', `Submitting cancellation for ${shortAddress(order.externalOrderId)}.`, 'pending')
    try {
      const token = await ensureTradingToken()
      await cancelOpenOrder(cancelId, token)
      updateActivity(activityId, 'done', `Cancelled ${shortAddress(order.externalOrderId)}.`)
      void refreshOpenOrders(token)
      window.dispatchEvent(new Event('causeway:orders-changed'))
    } catch (error) {
      const message = errorMessage(error)
      setOpenOrdersError(message)
      updateActivity(activityId, 'error', message)
    } finally {
      setCancelingOrderId(null)
    }
  }, [addActivity, cancelingOrderId, ensureTradingToken, refreshOpenOrders, updateActivity])

  const safeOption = readiness
    ? tradingOption(readiness, 'gnosis_safe') ?? tradingOption(readiness, 'proxy')
    : null
  const depositWalletBalance = withdrawAvailable
  const safeBalance = safeOption?.cashAvailable ?? null
  const displayedBalance = depositWalletBalance != null && depositWalletBalance > 0
    ? depositWalletBalance
    : safeBalance ?? depositWalletBalance ?? null
  const displayedBalanceLabel = displayedBalance === safeBalance && safeOption
    ? safeOption.label.replace(/^Polymarket\s+/i, '').replace(/\swallet$/i, '')
    : null
  const walletLabel = bridgeWallet?.walletKind === 'safe'
    ? 'Safe'
    : bridgeWallet?.walletKind === 'proxy'
      ? 'Proxy'
      : bridgeWallet?.walletKind === 'deposit_wallet'
        ? 'Deposit Wallet'
        : 'Wallet'
  const walletAddressLabel = bridgeWallet?.walletKind === 'deposit_wallet' ? 'Deposit Wallet' : 'Safe / Proxy'
  const statusText = !auth.isAuthenticated
    ? 'Sign in'
    : bridgeWallet
      ? displayedBalanceLabel ?? walletLabel
      : 'Loading'
  const recentPending = activityItems.filter((item) => item.status === 'pending').length
  const selectedDepositAddress = bridgeAddressForAsset(bridgeDeposit?.deposit.address, selectedDepositAsset)
  const bridgeChains = uniqueBridgeChains(supportedAssets)
  const quickSetupAllowanceReady = readiness ? (readinessAllowance(readiness) ?? 0) + Number.EPSILON >= TRADING_WALLET_MIN_READY_USD : false

  return (
    <div className="trading-wallet-shell">
      <button className="trading-wallet-pill ready" type="button" onClick={() => handleOpenWallet('deposit')}>
        <WalletCards size={16} />
        <span>Wallet</span>
        <b>{formatUsd(displayedBalance)}</b>
        <small>{statusText}</small>
      </button>
      <button className="deposit-button" type="button" onClick={() => handleOpenWallet('deposit')}>
        <Plus size={16} />
        Deposit
      </button>
      <button className="activity-pill" type="button" onClick={() => handleOpenWallet('withdraw')}>
        <ArrowRight size={16} />
        Withdraw
      </button>
      <button className="activity-pill" type="button" onClick={() => setActivityOpen(true)}>
        <Activity size={16} />
        {recentPending ? `${recentPending} Pending` : activityItems.length ? 'Activity' : 'Activity'}
      </button>

      {walletOpen ? (
        <BodyPortal>
          <div className="wallet-modal-backdrop" role="presentation" onMouseDown={() => setWalletOpen(false)}>
            <div className="wallet-modal bridge-wallet-modal" role="dialog" aria-modal="true" aria-label="Wallet funds" onMouseDown={(event) => event.stopPropagation()}>
              <div className="wallet-modal-head">
                <div>
                  <span><WalletCards size={18} /> {copy('Wallet Funds')}</span>
                  <small>{copy('Manage deposit, withdrawal, and trading wallet setup for Polymarket orders.')}</small>
                </div>
                <button className="modal-close-button" type="button" onClick={() => setWalletOpen(false)}>×</button>
              </div>

              <div className="wallet-balance-grid">
                <div><span>{walletAddressLabel}</span><b>{shortAddress(bridgeWallet?.polymarketWalletAddress ?? null)}</b></div>
                <div><span>Owner</span><b>{shortAddress(bridgeWallet?.ownerAddress ?? auth.walletAddress ?? null)}</b></div>
                <div><span>Deposit Wallet pUSD</span><b>{formatUsd(depositWalletBalance)}</b></div>
              </div>
              {bridgeWallet?.warning ? <div className="status-note warning wallet-status-note">{bridgeWallet.warning}</div> : null}
              {bridgeError ? <div className="status-note error wallet-status-note">{bridgeError}</div> : null}

              <div className="bridge-wallet-tabs">
                <button className={walletTab === 'deposit' ? 'active' : ''} type="button" onClick={() => setWalletTab('deposit')}>{copy('Deposit')}</button>
                <button className={walletTab === 'withdraw' ? 'active' : ''} type="button" onClick={() => setWalletTab('withdraw')}>{copy('Withdraw')}</button>
                <button className={walletTab === 'trade' ? 'active' : ''} type="button" onClick={() => setWalletTab('trade')}>{copy('Trading Setup')}</button>
              </div>

              {walletTab === 'deposit' ? (
                <div className="deposit-path-card recommended">
                  <div className="deposit-path-head">
                    <span><ArrowRight size={16} /> Bridge Any Token to USDC.e</span>
                    <small>Deposit from any supported chain. Assets auto-convert to USDC.e on Polygon.</small>
                  </div>
                  <div className="bridge-select-grid">
                    <label>
                      <span>Select Chain</span>
                      <select
                        className="bridge-input"
                        value={depositChainId}
                        onChange={(event) => {
                          const nextChainId = event.target.value
                          const firstOnChain = supportedAssets.find((asset) => asset.chainId === nextChainId)
                          setDepositChainId(nextChainId)
                          if (firstOnChain) setDepositAssetKey(assetOptionKey(firstOnChain))
                        }}
                      >
                        {bridgeChains.map((chain) => (
                          <option key={chain.chainId} value={chain.chainId}>{chain.chainName}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Select Token</span>
                      <select className="bridge-input" value={selectedDepositAsset ? assetOptionKey(selectedDepositAsset) : depositAssetKey} onChange={(event) => setDepositAssetKey(event.target.value)}>
                        {depositChainAssets.map((asset) => (
                          <option key={assetOptionKey(asset)} value={assetOptionKey(asset)}>{asset.token.symbol}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {selectedDepositAsset?.minCheckoutUsd ? (
                    <div className="bridge-min-note">
                      <Info size={16} />
                      Minimum deposit: ${selectedDepositAsset.minCheckoutUsd} USD worth of {selectedDepositAsset.token.symbol}
                    </div>
                  ) : null}
                  <button className="primary-button" disabled={isLoadingBridge || !auth.isConnected} type="button" onClick={() => void handleCreateDeposit()}>
                    {isLoadingBridge ? copy('Loading...') : bridgeDeposit ? copy('Refresh Deposit Address') : copy('Load Official Deposit Address')}
                  </button>
                  <div className="bridge-single-address">
                    <span>Your Deposit Address</span>
                    <b>{selectedDepositAddress ?? copy('No address generated yet.')}</b>
                    <button className="outline-button" disabled={!selectedDepositAddress} type="button" onClick={() => void handleCopy(selectedDepositAddress)}>
                      <Copy size={15} />
                      {copiedAddress === selectedDepositAddress ? copy('Copied') : 'Copy Address'}
                    </button>
                    <button className="outline-button" disabled={!selectedDepositAddress} type="button" onClick={() => void handleCheckStatus(selectedDepositAddress)}>
                      <Activity size={15} />
                      Check Status
                    </button>
                  </div>
                  <div className="bridge-facts">
                    <small><Activity size={14} /> Processing time: Usually &lt; 5 minutes</small>
                    <small><ArrowRight size={14} /> Auto-converts to USDC.e on Polygon</small>
                  </div>
                  {bridgeDeposit?.deposit.note ? <small className="wallet-inline-warning">{bridgeDeposit.deposit.note}</small> : null}
                </div>
              ) : null}

              {walletTab === 'withdraw' ? (
                <div className="deposit-path-card">
                  <div className="deposit-path-head">
                    <span><ArrowRight size={16} /> Bridge withdraw pUSD</span>
                    <small>Creates an official Polymarket Bridge withdrawal address in the background, then transfers pUSD from the Deposit Wallet to that address.</small>
                  </div>
                  <div className="withdraw-available-panel">
                    <span>Deposit Wallet available</span>
                    <b>{formatUsd(withdrawAvailable)} <small>pUSD</small></b>
                  </div>
                  <div className="bridge-select-grid">
                    <label>
                      <span>Receive token</span>
                      <select className="bridge-input" value={withdrawAssetKey} onChange={(event) => setWithdrawAssetKey(event.target.value)}>
                        {supportedAssets.map((asset) => (
                          <option key={assetOptionKey(asset)} value={assetOptionKey(asset)}>
                            {asset.token.symbol}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Receive chain</span>
                      <select className="bridge-input" value={withdrawAssetKey} onChange={(event) => setWithdrawAssetKey(event.target.value)}>
                        {supportedAssets.map((asset) => (
                          <option key={assetOptionKey(asset)} value={assetOptionKey(asset)}>
                            {asset.chainName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="bridge-field">
                    <span>{copy('Transfer Amount (USD)')}</span>
                    <div className="bridge-input-action">
                      <input className="bridge-input" inputMode="decimal" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder="0.00" />
                      <button disabled={withdrawAvailable == null} type="button" onClick={() => setWithdrawAmount(withdrawAvailable != null ? withdrawAvailable.toFixed(2) : '')}>Max</button>
                    </div>
                  </label>
                  <label className="bridge-field">
                    <span>{copy('Recipient Address')}</span>
                    <div className="bridge-input-action">
                      <input className="bridge-input" value={withdrawRecipient} onChange={(event) => setWithdrawRecipient(event.target.value)} placeholder="0x..." />
                      <button type="button" onClick={() => setWithdrawRecipient(auth.walletAddress ?? '')}>{copy('Use Connected Wallet')}</button>
                    </div>
                  </label>
                  <button className="outline-button" disabled={isLoadingBridge || !auth.isConnected || depositWalletBalanceMicroUsd(readiness) == null} type="button" onClick={() => void handleReturnDepositWalletToSafe()}>
                    Return Deposit Wallet to Polymarket Safe
                  </button>
                  <button className="primary-button" disabled={isLoadingBridge || !auth.isConnected || withdrawAvailable == null} type="button" onClick={() => void handleSubmitWithdrawTransfer()}>
                    {isLoadingBridge ? copy('Submitting...') : copy('Submit Transfer')}
                  </button>
                </div>
              ) : null}

              {walletTab === 'trade' ? (
                <div className="deposit-path-card">
                  <div className="deposit-path-head">
                    <span><ShieldCheck size={16} /> Trading setup</span>
                    <small>This is not a deposit or withdrawal. It prepares the Deposit Wallet, trading credentials, and trading permissions.</small>
                  </div>
                  <div className="wallet-balance-grid">
                    <div><span>Deposit Wallet</span><b>{formatUsd(readiness ? readinessCash(readiness) : null)}</b></div>
                    <div><span>Status</span><b>{readiness?.status ?? 'Not checked'}</b></div>
                    <div><span>Minimum ready</span><b>{formatUsd(TRADING_WALLET_MIN_READY_USD)}</b></div>
                  </div>
                  {readiness?.reason ? <div className="status-note warning wallet-status-note">{normalizeTradingCapabilityReason(readiness.reason) ?? readiness.reason}</div> : null}
                  <button className="primary-button" disabled={quickSetupRunning || !auth.isConnected} type="button" onClick={handleStartTradingSetup}>
                    {quickSetupRunning ? 'Processing...' : 'Check and prepare trading wallet'}
                  </button>
                </div>
              ) : null}

              {bridgeStatus ? (
                <div className="deposit-path-card">
                  <div className="deposit-path-head">
                    <span><Activity size={16} /> {copy('Bridge Status')}</span>
                    <small>{statusAddress ? shortAddress(statusAddress) : copy('Recent query')}</small>
                  </div>
                  <div className="bridge-status-list">
                    {bridgeStatus.transactions.length ? bridgeStatus.transactions.map((transaction, index) => (
                      <div key={`${transaction.txHash ?? transaction.createdTimeMs ?? index}`}>
                        <b>{transaction.status ?? 'UNKNOWN'}</b>
                        <small>{transaction.fromAmountBaseUnit ?? '-'} · {transaction.fromChainId ?? '?'} → {transaction.toChainId ?? '?'}</small>
                      </div>
                    )) : <small>{copy('No transactions yet.')}</small>}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </BodyPortal>
      ) : null}

      {quickSetupOpen ? (
        <BodyPortal>
          <div className="wallet-modal-backdrop" role="presentation" onMouseDown={() => !quickSetupRunning && setQuickSetupOpen(false)}>
            <div className="wallet-modal quick-setup-modal" role="dialog" aria-modal="true" aria-label="Quick setup" onMouseDown={(event) => event.stopPropagation()}>
              <div className="wallet-modal-head">
                <div>
                  <span><Bot size={18} /> Trading Setup</span>
                  <small>Create the Deposit Wallet, enable trading permissions, and create Polymarket trading credentials.</small>
                </div>
                <button className="modal-close-button" type="button" disabled={quickSetupRunning} onClick={() => setQuickSetupOpen(false)}>×</button>
              </div>
              <div className="quick-setup-steps">
                <span className={readiness?.depositWalletDeployed ? 'done' : quickSetupRunning ? 'active' : ''}>Deploy Wallet</span>
                <span className={quickSetupAllowanceReady ? 'done' : quickSetupRunning && readiness?.depositWalletDeployed ? 'active' : ''}>Enable Trading</span>
                <span className={readiness?.clobApiKeyConfigured ? 'done' : quickSetupRunning ? 'active' : ''}>Credentials</span>
              </div>
              <div className="deposit-path-card recommended">
                <div className="deposit-path-head">
                  <span><Bot size={16} /> Prepare Your Trading Wallet</span>
                  <small>New wallets need this once before placing Polymarket orders. You stay in control of every required wallet signature.</small>
                </div>
                <div className="quick-setup-console">
                  {(quickSetupLogs.length ? quickSetupLogs : ['Ready to check your account status.']).map((line, index) => (
                    <span key={`${line}-${index}`}>{line}</span>
                  ))}
                </div>
              </div>
              {quickSetupRunning || !readiness?.canTrade ? (
                <button className="primary-button" disabled={quickSetupRunning || !auth.isConnected} type="button" onClick={() => void handleQuickSetup()}>
                  {quickSetupRunning ? 'Processing...' : quickSetupStarted ? 'Retry Setup' : 'Start Setup'}
                </button>
              ) : null}
            </div>
          </div>
        </BodyPortal>
      ) : null}

      {ordersOpen ? (
        <BodyPortal>
          <div className="wallet-modal-backdrop" role="presentation" onMouseDown={() => setOrdersOpen(false)}>
            <div className="wallet-modal open-orders-modal" role="dialog" aria-modal="true" aria-label="Open orders" onMouseDown={(event) => event.stopPropagation()}>
              <div className="wallet-modal-head">
                <div>
                  <span><ListOrdered size={18} /> Open Orders</span>
                  <small>Orders are queried from the active Polymarket Deposit Wallet / proxy, not just the owner wallet page.</small>
                </div>
                <button className="modal-close-button" type="button" onClick={() => setOrdersOpen(false)}>×</button>
              </div>
              <div className="open-orders-wallet-summary">
                <div>
                  <span>Trading wallet</span>
                  <b>{shortAddress(openOrders?.tradingWalletAddress ?? bridgeWallet?.polymarketWalletAddress ?? null)}</b>
                </div>
                <div>
                  <span>Owner</span>
                  <b>{shortAddress(openOrders?.ownerWalletAddress ?? auth.walletAddress ?? null)}</b>
                </div>
                <div>
                  <span>Order feed</span>
                  <b>{accountOrdersSourceLabel(openOrders)}</b>
                </div>
              </div>
              <div className="open-orders-toolbar">
                <span>{openOrders?.items.length ?? 0} open orders</span>
                <button className="outline-button" disabled={openOrdersLoading} type="button" onClick={() => void refreshOpenOrders(auth.accessToken ?? readStoredAuthSession()?.accessToken)}>
                  <RotateCw size={15} />
                  {openOrdersLoading ? 'Refreshing' : 'Refresh'}
                </button>
              </div>
              {openOrdersError ? <div className="status-note error wallet-status-note">{openOrdersError}</div> : null}
              {openOrders?.refreshedAt ? <small className="open-orders-refreshed">Updated {formatDateTime(openOrders.refreshedAt)}</small> : null}
              <div className="open-orders-list">
                {openOrdersLoading && !openOrders ? (
                  <div className="soft-note">Loading open orders...</div>
                ) : openOrders?.items.length ? openOrders.items.map((order) => {
                  const cancelId = order.orderId ?? order.externalOrderId
                  const isCanceling = cancelingOrderId === cancelId
                  return (
                    <div className="open-order-row" key={order.externalOrderId}>
                      <div className="open-order-main">
                        <b>{order.eventTitle || order.marketTitle || 'Polymarket order'}</b>
                        {order.eventTitle && order.marketTitle ? <span>{order.marketTitle}</span> : null}
                        <small>
                          {order.side.toUpperCase()} {order.outcomeLabel || 'Outcome'} | Limit {formatLimitPrice(order.price)} | {formatShares(order.remainingSize)} / {formatShares(order.originalSize)} shares
                        </small>
                        <em>{shortAddress(order.externalOrderId)} | {order.rawStatus || order.status}</em>
                      </div>
                      <div className="open-order-side">
                        <b>{formatUsd(order.amountUsd)}</b>
                        <small>{order.createdAt ? formatDateTime(order.createdAt) : 'No timestamp'}</small>
                        <button
                          className="order-cancel-button"
                          disabled={!order.canCancel || isCanceling}
                          type="button"
                          onClick={() => void handleCancelOpenOrder(order)}
                        >
                          {isCanceling ? 'Canceling' : order.canCancel ? 'Cancel order' : 'Not cancelable'}
                        </button>
                      </div>
                    </div>
                  )
                }) : (
                  <div className="soft-note">No live limit orders found for this wallet.</div>
                )}
              </div>
              <div className="open-orders-section-title">
                <span>Recent order status</span>
                <small>{openOrders?.recentOrders?.length ?? 0} recent records</small>
              </div>
              <div className="open-orders-list compact">
                {openOrdersLoading && !openOrders ? null : openOrders?.recentOrders?.length ? openOrders.recentOrders.slice(0, 8).map((order) => (
                  <div className="open-order-row history" key={order.orderId}>
                    <div className="open-order-main">
                      <b>{order.eventTitle || order.marketTitle || 'Polymarket order'}</b>
                      {order.eventTitle && order.marketTitle ? <span>{order.marketTitle}</span> : null}
                      <small>
                        {order.side.toUpperCase()} {order.outcomeLabel || 'Outcome'} | {order.orderType ?? 'ORDER'} {formatLimitPrice(order.price)} | {formatShares(order.size)} shares
                      </small>
                      <em>{order.externalOrderId ? shortAddress(order.externalOrderId) : 'No CLOB id'} | {order.status}{order.errorMessage ? ` | ${order.errorMessage}` : ''}</em>
                    </div>
                    <div className="open-order-side">
                      <b>{formatUsd(order.amountUsd)}</b>
                      <small>{formatDateTime(order.updatedAt)}</small>
                    </div>
                  </div>
                )) : (
                  <div className="soft-note">No submitted order history for this trading wallet yet.</div>
                )}
              </div>
              <div className="open-orders-section-title">
                <span>Recent fills</span>
                <small>{openOrders?.trades?.length ?? 0} CLOB trades</small>
              </div>
              <div className="open-orders-list compact">
                {openOrdersLoading && !openOrders ? null : openOrders?.trades?.length ? openOrders.trades.slice(0, 8).map((trade) => (
                  <div className="open-order-row trade" key={trade.tradeId}>
                    <div className="open-order-main">
                      <b>{trade.eventTitle || trade.marketTitle || 'Polymarket fill'}</b>
                      {trade.eventTitle && trade.marketTitle ? <span>{trade.marketTitle}</span> : null}
                      <small>
                        {trade.side.toUpperCase()} {trade.outcomeLabel || 'Outcome'} | Fill {formatLimitPrice(trade.price)} | {formatShares(trade.size)} shares
                      </small>
                      <em>{shortAddress(trade.tradeId)} | {trade.status}{trade.transactionHash ? ` | ${shortAddress(trade.transactionHash)}` : ''}</em>
                    </div>
                    <div className="open-order-side">
                      <b>{formatUsd(trade.amountUsd)}</b>
                      <small>{trade.matchedAt ? formatDateTime(trade.matchedAt) : 'No match time'}</small>
                    </div>
                  </div>
                )) : (
                  <div className="soft-note">No fills returned for this trading wallet yet.</div>
                )}
              </div>
            </div>
          </div>
        </BodyPortal>
      ) : null}

      {activityOpen ? (
        <BodyPortal>
          <div className="wallet-modal-backdrop" role="presentation" onMouseDown={() => setActivityOpen(false)}>
            <div className="wallet-modal activity-modal" role="dialog" aria-modal="true" aria-label="Activity" onMouseDown={(event) => event.stopPropagation()}>
              <div className="wallet-modal-head">
                <div>
                  <span><Activity size={18} /> Activity</span>
                  <small>{copy('Wallet setup, Bridge, and order activity in this browser session.')}</small>
                </div>
                <button className="modal-close-button" type="button" onClick={() => setActivityOpen(false)}>×</button>
              </div>
              <div className="wallet-activity-list">
                {activityItems.length ? activityItems.map((item) => (
                  <div className={`wallet-activity-row ${item.status}`} key={item.id}>
                    <span>{item.status === 'done' ? <CheckCircle2 size={16} /> : item.status === 'error' ? <Info size={16} /> : <RotateCw size={16} />}</span>
                    <div>
                      <b>{item.label}</b>
                      <small>{item.detail}</small>
                      <em>{formatDateTime(item.createdAt)}</em>
                    </div>
                  </div>
                )) : <div className="soft-note">No activity in this session.</div>}
              </div>
            </div>
          </div>
        </BodyPortal>
      ) : null}
    </div>
  )
}

function AccountPage({ auth }: { auth: CausewayAuth }) {
  const { addActivity, updateActivity } = useTradingWalletActivity()
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [positions, setPositions] = useState<PortfolioPositionsResult | null>(null)
  const [openOrders, setOpenOrders] = useState<OpenOrdersResult | null>(null)
  const [orders, setOrders] = useState<PortfolioOrdersResult | null>(null)
  const [trades, setTrades] = useState<PortfolioTradesResult | null>(null)
  const [activeTab, setActiveTab] = useState<'positions' | 'open' | 'history'>('positions')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [syncingPositions, setSyncingPositions] = useState(false)
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const token = auth.accessToken ?? readStoredAuthSession()?.accessToken ?? null

  const loadAccount = useCallback(async (nextToken = token) => {
    if (!nextToken) {
      setSummary(null)
      setPositions(null)
      setOpenOrders(null)
      setOrders(null)
      setTrades(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [nextSummary, nextPositions, nextOpenOrders, nextOrders, nextTrades] = await Promise.allSettled([
        fetchPortfolioSummary(nextToken),
        fetchPortfolioPositions(nextToken),
        fetchOpenOrders(nextToken),
        fetchPortfolioOrders(nextToken),
        fetchPortfolioTrades(nextToken),
      ])
      const failures: string[] = []
      if (nextSummary.status === 'fulfilled') setSummary(nextSummary.value)
      else {
        setSummary(null)
        failures.push(accountLoadErrorMessage(copy('Portfolio summary'), nextSummary.reason))
      }
      if (nextPositions.status === 'fulfilled') setPositions(nextPositions.value)
      else {
        setPositions(null)
        failures.push(accountLoadErrorMessage(copy('Positions'), nextPositions.reason))
      }
      if (nextOpenOrders.status === 'fulfilled') setOpenOrders(nextOpenOrders.value)
      else {
        setOpenOrders(null)
        failures.push(accountLoadErrorMessage(copy('Open orders'), nextOpenOrders.reason))
      }
      if (nextOrders.status === 'fulfilled') setOrders(nextOrders.value)
      else {
        setOrders(null)
        failures.push(accountLoadErrorMessage(copy('Order history'), nextOrders.reason))
      }
      if (nextTrades.status === 'fulfilled') setTrades(nextTrades.value)
      else {
        setTrades(null)
        failures.push(accountLoadErrorMessage(copy('Fill history'), nextTrades.reason))
      }
      setError(failures.length ? failures.join(' ') : null)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAccount()
    }, 0)
    if (!token) return () => window.clearTimeout(timer)
    const interval = window.setInterval(() => void loadAccount(token), 45_000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
    }
  }, [loadAccount, token])

  const handleSignIn = useCallback(async () => {
    setError(null)
    try {
      if (!auth.isAuthenticated) await auth.signIn()
      const nextToken = readStoredAuthSession()?.accessToken ?? auth.accessToken
      await loadAccount(nextToken)
    } catch (signInError) {
      setError(errorMessage(signInError))
    }
  }, [auth, loadAccount])

  const handleSyncPositions = useCallback(async () => {
    const nextToken = readStoredAuthSession()?.accessToken ?? auth.accessToken
    if (!nextToken) {
      await handleSignIn()
      return
    }
    setSyncingPositions(true)
    setError(null)
    try {
      await syncPortfolioPositions(nextToken)
      await loadAccount(nextToken)
    } catch (syncError) {
      setError(errorMessage(syncError))
    } finally {
      setSyncingPositions(false)
    }
  }, [auth.accessToken, handleSignIn, loadAccount])

  const handleCancelAccountOrder = useCallback(async (order: OpenOrderItem) => {
    const cancelId = order.orderId ?? order.externalOrderId
    if (!cancelId || cancelingOrderId) return
    if (!confirmOpenOrderCancellation(order)) return
    setCancelingOrderId(cancelId)
    setError(null)
    const activityId = addActivity('Cancel order', `Submitting cancellation for ${shortAddress(order.externalOrderId)}.`, 'pending')
    try {
      const nextToken = readStoredAuthSession()?.accessToken ?? auth.accessToken
      if (!nextToken) throw new Error(copy('Wallet authentication is not complete. Sign in with your wallet first.'))
      await cancelOpenOrder(cancelId, nextToken)
      updateActivity(activityId, 'done', `Cancelled ${shortAddress(order.externalOrderId)}.`)
      await loadAccount(nextToken)
      window.dispatchEvent(new Event('causeway:orders-changed'))
    } catch (cancelError) {
      const message = errorMessage(cancelError)
      setError(message)
      updateActivity(activityId, 'error', message)
    } finally {
      setCancelingOrderId(null)
    }
  }, [addActivity, auth.accessToken, cancelingOrderId, loadAccount, updateActivity])

  const positionsValue = summary?.openPositionsValue ?? (positions?.capability === 'available' ? 0 : null)
  const liveOpenOrdersValue = openOrders
    ? (openOrders.items.length ? sumCurrency(openOrders.items.map((order) => order.amountUsd)) : 0)
    : null
  const openOrdersValue = liveOpenOrdersValue ?? summary?.openOrdersValue ?? null
  const cashAvailable = summary?.cashAvailable ?? null
  const portfolioValue = summary?.portfolioValue ?? null
  const pnl = summary?.pnl ?? (positions?.capability === 'available' ? 0 : null)
  const positionDisplayState = accountPositionDisplayState(positions, loading)
  const positionsValueLabel = positionsValue == null ? accountPositionValueFallback(positionDisplayState) : formatUsd(positionsValue)
  const pnlLabel = pnl == null ? accountPositionPnlFallback(positionDisplayState) : `${formatSignedUsd(pnl)} ${copy('PnL')}`
  const openOrdersValueLabel = openOrdersValue == null ? accountOpenOrdersValueFallback(openOrders, loading) : formatUsd(openOrdersValue)
  const openOrderCount = openOrders?.items.length ?? 0
  const positionCount = positions?.items.length ?? 0
  const normalizedQuery = query.trim().toLowerCase()
  const historyRows = orders?.items.flatMap((intent) => intent.orders.map((order) => ({ intent, order }))) ?? []
  const historyCount = historyRows.length
  const filteredPositions = (positions?.items ?? []).filter((position) => accountSearchMatches(normalizedQuery, [
    position.title,
    position.outcomeLabel,
    position.tokenId,
  ]))
  const filteredOpenOrders = (openOrders?.items ?? []).filter((order) => accountSearchMatches(normalizedQuery, [
    order.eventTitle,
    order.marketTitle,
    order.outcomeLabel,
    order.externalOrderId,
    order.rawStatus,
  ]))
  const filteredHistoryRows = historyRows.filter(({ intent, order }) => accountSearchMatches(normalizedQuery, [
    order.market?.question,
    order.market?.title,
    order.outcome?.label,
    order.externalOrderId,
    order.status,
    intent.status,
  ]))
  const accountCapability = summary?.capability ?? positions?.capability ?? openOrders?.capability ?? orders?.capability ?? 'degraded'
  const accountNotices = accountNoticeMessages([summary?.error, positions?.error, openOrders?.error, orders?.error, trades?.error])
  const accountExportCount = activeTab === 'positions'
    ? filteredPositions.length
    : activeTab === 'open'
      ? filteredOpenOrders.length
      : filteredHistoryRows.length

  const handleExportAccount = () => {
    if (activeTab === 'positions') {
      downloadAccountCsv('causeway-positions.csv', [
        ['Market', 'Outcome', 'Token', 'Size', 'Average price', 'Current price', 'Value', 'PnL'],
        ...filteredPositions.map((position) => [
          position.title,
          position.outcomeLabel,
          position.tokenId,
          formatShares(position.size),
          formatUnitPercent(position.avgPrice),
          formatUnitPercent(position.currentPrice),
          formatUsd(position.currentValue),
          formatUsd(position.pnl),
        ]),
      ])
      return
    }
    if (activeTab === 'open') {
      downloadAccountCsv('causeway-open-orders.csv', [
        ['Market', 'Order', 'Limit', 'Remaining', 'Amount', 'Status', 'Created'],
        ...filteredOpenOrders.map((order) => [
          order.eventTitle || order.marketTitle || 'Polymarket order',
          `${order.side.toUpperCase()} ${order.outcomeLabel || 'Outcome'}`,
          formatLimitPrice(order.price),
          formatShares(order.remainingSize),
          formatUsd(order.amountUsd),
          order.rawStatus || order.status,
          formatDateTime(order.createdAt),
        ]),
      ])
      return
    }
    downloadAccountCsv('causeway-history.csv', [
      ['Market', 'Order', 'Amount', 'Status', 'Updated'],
      ...filteredHistoryRows.map(({ intent, order }) => [
        order.market?.question || order.market?.title || 'Polymarket order',
        `${order.side.toUpperCase()} ${order.outcome?.label || 'Outcome'} ${order.orderMode}`,
        formatUsd(order.amountUsd),
        `${order.status}${order.errorMessage ? ` - ${order.errorMessage}` : ''}`,
        formatDateTime(intent.updatedAt),
      ]),
    ])
  }

  if (!auth.isAuthenticated && !token) {
    return (
      <section className="page account-page">
        <Card className="account-empty-card">
          <WalletCards size={28} />
          <div>
            <b>{copy('Wallet sign-in required')}</b>
            <span>{copy('Portfolio data is private and loaded from your authenticated Polymarket trading account.')}</span>
          </div>
          <button className="primary-button" type="button" onClick={() => void handleSignIn()}>
            {auth.isConnected ? copy('Sign in') : copy('Connect wallet')}
          </button>
          {error ? <div className="status-note error">{error}</div> : null}
        </Card>
      </section>
    )
  }

  return (
    <section className="page account-page">
      <div className="account-page-actions account-page-actions-end">
        <button className="outline-button" disabled={loading} type="button" onClick={() => void loadAccount()}>
          <RotateCw size={16} /> {loading ? copy('Refreshing') : copy('Refresh')}
        </button>
        <button className="primary-button" disabled={syncingPositions} type="button" onClick={() => void handleSyncPositions()}>
          <Activity size={16} /> {syncingPositions ? copy('Syncing') : copy('Sync positions')}
        </button>
      </div>

      <div className="account-dashboard">
        <Card className="account-balance-card">
          <div className="account-card-title">
            <span>{copy('Positions value')}</span>
            <small>{accountStatusLabel(accountCapability)}</small>
          </div>
          <strong>{positionsValueLabel}</strong>
          <em className={pnl == null ? '' : pnl >= 0 ? 'green-text' : 'red-text'}>{pnlLabel}</em>
          <div className="account-metric-grid">
            <div>
              <span>{copy('Trading cash')}</span>
              <b>{formatUsd(cashAvailable)}</b>
            </div>
            <div>
              <span>{copy('Live open orders')}</span>
              <b>{openOrdersValueLabel}</b>
            </div>
            <div>
              <span>{copy('Visible total')}</span>
              <b>{formatUsd(portfolioValue)}</b>
            </div>
          </div>
        </Card>
        <Card className="account-balance-card account-side-card">
          <div className="account-card-title"><span>{copy('Trading wallet')}</span><small>{accountOrdersSourceLabel(openOrders)}</small></div>
          <div className="account-wallet-lines">
            <div>
              <span>{copy('Live orders')}</span>
              <b>{openOrderCount}</b>
            </div>
            <div>
              <span>{copy('Data coverage')}</span>
              <b>{accountCoverageLabel(summary, positions, openOrders)}</b>
            </div>
            <div>
              <span>{copy('Updated')}</span>
              <b>{formatRelativeTime(summary?.refreshedAt ?? openOrders?.refreshedAt)}</b>
            </div>
          </div>
        </Card>
      </div>

      {error ? <div className="status-note error">{error}</div> : null}
      {accountNotices.map((notice) => (
        <div className="status-note warning" key={notice}>{notice}</div>
      ))}

      <div className="account-ledger">
        <div className="account-ledger-head">
          <div className="account-tabs">
            <button className={activeTab === 'positions' ? 'active' : ''} type="button" onClick={() => setActiveTab('positions')}>
              {copy('Positions')} <span>{positionCount}</span>
            </button>
            <button className={activeTab === 'open' ? 'active' : ''} type="button" onClick={() => setActiveTab('open')}>
              {copy('Open Orders')} <span>{openOrderCount}</span>
            </button>
            <button className={activeTab === 'history' ? 'active' : ''} type="button" onClick={() => setActiveTab('history')}>
              {copy('History')} <span>{historyCount}</span>
            </button>
          </div>
          <div className="account-toolbar">
            <label className="account-search">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy('Search markets')} />
            </label>
            <button className="account-tool-button" disabled={loading} type="button" onClick={() => void loadAccount()}>
              <RotateCw size={16} /> {loading ? copy('Refreshing') : copy('Latest')}
            </button>
            <button className="account-tool-button" disabled={!accountExportCount} type="button" onClick={handleExportAccount}>
              <Download size={16} /> {copy('Export')}
            </button>
          </div>
        </div>

        {activeTab === 'positions' ? (
          <div className="account-list-card">
            <div className="account-list-header">
              <span>{copy('Trade')}</span>
              <span>{copy('Market')}</span>
              <span>{copy('Outcome')}</span>
              <span>{copy('Value')}</span>
              <span>{copy('PnL')}</span>
            </div>
            {filteredPositions.length ? filteredPositions.map((position) => (
              <div className="account-list-row" key={`${position.marketId}:${position.outcomeId}`}>
                <div className="account-trade-action">
                  <span className="account-action-avatar"><Plus size={13} /></span>
                  <b>{copy('Buy')}</b>
                </div>
                <div className="account-row-market">
                  <AccountMarketAvatar image={position.marketImage} title={position.title} />
                  <div>
                    <b>{position.title}</b>
                    <span>{shortAddress(position.tokenId)}</span>
                  </div>
                </div>
                <div className="account-row-meta">
                  <span className="account-outcome-chip">{position.outcomeLabel}</span>
                  <small>{formatShares(position.size)} {copy('shares')} @ {formatUnitPercent(position.avgPrice)}</small>
                </div>
                <strong>{formatUsd(position.currentValue)}</strong>
                <em className={(position.pnl ?? 0) >= 0 ? 'green-text' : 'red-text'}>{formatUsd(position.pnl)}</em>
              </div>
            )) : <div className="account-empty-row">{accountPositionsEmptyMessage(positions, loading)}</div>}
          </div>
        ) : null}

        {activeTab === 'open' ? (
          <div className="account-list-card">
            <div className="account-list-header">
              <span>{copy('Trade')}</span>
              <span>{copy('Open order')}</span>
              <span>{copy('Limit')}</span>
              <span>{copy('Amount')}</span>
              <span>{copy('Action')}</span>
            </div>
            {filteredOpenOrders.length ? filteredOpenOrders.map((order) => {
              const cancelId = order.orderId ?? order.externalOrderId
              return (
                <div className="account-list-row" key={order.externalOrderId}>
                  <div className="account-trade-action">
                    <span className="account-action-avatar"><Plus size={13} /></span>
                    <b>{accountSideLabel(order.side)}</b>
                  </div>
                  <div className="account-row-market">
                    <AccountMarketAvatar image={order.marketImage} title={order.eventTitle || order.marketTitle} />
                    <div>
                      <b>{order.eventTitle || order.marketTitle || copy('Polymarket order')}</b>
                      <span>{order.eventTitle && order.marketTitle ? order.marketTitle : shortAddress(order.externalOrderId)}</span>
                    </div>
                  </div>
                  <div className="account-row-meta">
                    <span className={`account-side-chip ${normalizeAccountSide(order.side)}`}>{normalizeAccountSide(order.side).toUpperCase()} {order.outcomeLabel || copy('Outcome')}</span>
                    <small>{formatLimitPrice(order.price)} - {formatShares(order.remainingSize)} {copy('remaining')}</small>
                  </div>
                  <strong>{formatUsd(order.amountUsd)}</strong>
                  <button className="account-row-action" disabled={!order.canCancel || cancelingOrderId === cancelId} type="button" onClick={() => void handleCancelAccountOrder(order)}>
                    {cancelingOrderId === cancelId ? copy('Canceling') : order.canCancel ? copy('Cancel order') : (order.rawStatus || order.status)}
                  </button>
                </div>
              )
            }) : <div className="account-empty-row">{loading ? copy('Loading open orders...') : copy('No live limit orders found for this wallet.')}</div>}
          </div>
        ) : null}

        {activeTab === 'history' ? (
          <div className="account-list-card">
            <div className="account-list-header">
              <span>{copy('Trade')}</span>
              <span>{copy('Trade record')}</span>
              <span>{copy('Order')}</span>
              <span>{copy('Value')}</span>
              <span>{copy('Time')}</span>
            </div>
            {filteredHistoryRows.length ? filteredHistoryRows.map(({ intent, order }) => (
              <div className="account-list-row" key={`${intent.intentId}:${order.id}`}>
                <div className="account-trade-action">
                  <span className="account-action-avatar"><Plus size={13} /></span>
                  <b>{accountSideLabel(order.side)}</b>
                </div>
                <div className="account-row-market">
                  <AccountMarketAvatar image={order.marketImage} title={order.market?.question || order.market?.title} />
                  <div>
                    <b>{order.market?.question || order.market?.title || copy('Polymarket order')}</b>
                    <span>{order.externalOrderId ? shortAddress(order.externalOrderId) : shortAddress(order.id)}</span>
                  </div>
                </div>
                <div className="account-row-meta">
                  <span className={`account-side-chip ${normalizeAccountSide(order.side)}`}>{normalizeAccountSide(order.side).toUpperCase()} {order.outcome?.label || copy('Outcome')}</span>
                  <small>{order.orderMode}{order.limitPrice != null ? ` - ${formatLimitPrice(order.limitPrice)}` : ''}</small>
                </div>
                <div className="account-row-value">
                  <strong>{formatUsd(order.amountUsd)}</strong>
                  <small className={order.status === 'failed' ? 'red-text' : ''}>{order.status}{order.errorMessage ? ` - ${order.errorMessage}` : ''}</small>
                </div>
                <span>{formatRelativeTime(intent.updatedAt)}</span>
              </div>
            )) : <div className="account-empty-row">{loading ? copy('Loading order history...') : copy('No submitted order history yet.')}</div>}
            {trades?.items.length ? (
              <div className="account-trade-note">{trades.items.length} {copy('fill record(s) available from the portfolio trade endpoint.')}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function accountSearchMatches(query: string, values: Array<string | null | undefined>) {
  if (!query) return true
  return values.some((value) => value?.toLowerCase().includes(query))
}

function accountStatusLabel(capability: 'available' | 'degraded' | 'unavailable' | string | null | undefined) {
  if (capability === 'available') return copy('Live')
  if (capability === 'unavailable') return copy('Needs attention')
  return copy('Partial data')
}

function accountOrdersSourceLabel(openOrders: OpenOrdersResult | null) {
  if (!openOrders) return copy('Loading')
  if (openOrders.capability === 'available') return copy('Live CLOB')
  if (openOrders.capability === 'unavailable') return copy('Orders unavailable')
  return copy('Partial orders')
}

function confirmOpenOrderCancellation(order: OpenOrderItem) {
  const market = order.eventTitle || order.marketTitle || copy('this live Polymarket order')
  const side = accountSideLabel(order.side)
  const outcome = order.outcomeLabel || copy('Outcome')
  return window.confirm(`${copy('Cancel this open order?')}\n\n${side} ${outcome}\n${market}\n${formatUsd(order.amountUsd)}`)
}

function accountOpenOrdersValueFallback(openOrders: OpenOrdersResult | null, loading: boolean) {
  if (!openOrders) return loading ? copy('Loading') : copy('Unavailable')
  if (openOrders.capability === 'unavailable') return copy('Unavailable')
  return copy('Not available')
}

function accountPositionDisplayState(positions: PortfolioPositionsResult | null, loading: boolean) {
  if (!positions) return loading ? 'loading' : 'unavailable'
  if (positions.dataSource === 'pending_sync') return 'sync_required'
  if (positions.capability === 'unavailable') return 'unavailable'
  if (positions.capability === 'degraded') return 'partial'
  return 'available'
}

function accountPositionValueFallback(state: ReturnType<typeof accountPositionDisplayState>) {
  if (state === 'loading') return copy('Loading')
  if (state === 'sync_required') return copy('Sync required')
  if (state === 'unavailable') return copy('Unavailable')
  return copy('Not available')
}

function accountPositionPnlFallback(state: ReturnType<typeof accountPositionDisplayState>) {
  if (state === 'loading') return copy('Loading PnL')
  if (state === 'sync_required') return copy('Sync positions for PnL')
  return copy('PnL unavailable')
}

function accountPositionsEmptyMessage(positions: PortfolioPositionsResult | null, loading: boolean) {
  if (loading && !positions) return copy('Loading positions...')
  if (positions?.dataSource === 'pending_sync') return copy('Sync positions to load current holdings.')
  if (positions?.capability === 'available') return copy('No open positions.')
  if (positions?.capability === 'unavailable') return copy('Positions are temporarily unavailable.')
  return copy('No positions available yet.')
}

function accountCoverageLabel(summary: PortfolioSummary | null, positions: PortfolioPositionsResult | null, openOrders: OpenOrdersResult | null) {
  const positionCoverage = positions?.items.length
    ? copy('Synced positions')
    : positions?.capability === 'available' || summary?.dataSource === 'polymarket_data_api'
      ? copy('No open positions')
      : copy('Positions pending')
  const orderCoverage = openOrders?.capability === 'available'
    ? copy('Live orders')
    : openOrders
      ? copy('Orders pending')
      : copy('Orders loading')
  return `${positionCoverage} + ${orderCoverage}`
}

function accountNoticeMessages(messages: Array<string | null | undefined>) {
  const seen = new Set<string>()
  return messages.flatMap((message) => {
    const notice = accountNoticeMessage(message)
    if (!notice || seen.has(notice)) return []
    seen.add(notice)
    return [notice]
  })
}

function accountNoticeMessage(message: string | null | undefined) {
  if (!message) return null
  const normalized = message.toLowerCase()
  if (normalized.includes('trading wallet balance')) {
    return copy('Trading cash is temporarily unavailable. Refresh the account or prepare the trading wallet to load the latest balance.')
  }
  if (normalized.includes('positions have not been synced')) {
    return copy('Positions have not been synced yet. Use Sync positions to load current holdings.')
  }
  if (normalized.includes('position sync failed')) {
    return copy('Position sync failed. Retry Sync positions before relying on account totals.')
  }
  if (normalized.includes('some positions are not linked') || normalized.includes('causeway market metadata')) {
    return copy('Some synced positions are missing Causeway market metadata, so they are excluded from the position list.')
  }
  if (normalized.includes('position values are temporarily unavailable')) {
    return copy('Some synced position values are temporarily unavailable. Refresh positions before relying on totals.')
  }
  if (normalized.includes('external position sync is not fully automated')) {
    return copy('Positions are shown from the latest sync. Use Sync positions to refresh current holdings.')
  }
  if (normalized.includes('trade history is based on monitored causeway orders')) {
    return copy('History includes Causeway-monitored orders; direct Polymarket activity may be absent.')
  }
  return message
}

function accountLoadErrorMessage(label: string, error: unknown) {
  return `${label} ${copy('could not be loaded')}: ${errorMessage(error)}`
}

function normalizeAccountSide(side: string | null | undefined): 'buy' | 'sell' {
  return side?.toLowerCase() === 'sell' ? 'sell' : 'buy'
}

function accountSideLabel(side: string | null | undefined) {
  return normalizeAccountSide(side) === 'sell' ? copy('Sell') : copy('Buy')
}

function accountInitials(value: string | null | undefined) {
  const words = (value || 'PM').replace(/[^a-zA-Z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join('') || 'PM'
}

function AccountMarketAvatar({ image, title }: { image?: string | null; title?: string | null }) {
  const [failed, setFailed] = useState(false)
  if (image && !failed) {
    return (
      <span className="account-market-avatar image">
        <img alt="" src={image} onError={() => setFailed(true)} />
      </span>
    )
  }
  return <span className="account-market-avatar">{accountInitials(title)}</span>
}

function downloadAccountCsv(filename: string, rows: string[][]) {
  if (rows.length <= 1) return
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function csvCell(value: string) {
  const normalized = value.replace(/\r?\n/g, ' ')
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized
}

function assetOptionKey(asset: BridgeSupportedAsset) {
  return `${asset.chainId}:${asset.token.address}`
}

function firstBridgeAddress(addresses?: BridgeAddressSet) {
  return addresses?.evm ?? addresses?.svm ?? addresses?.btc ?? null
}

function evmBridgeAddressForDepositWalletTransfer(addresses?: BridgeAddressSet) {
  return addresses?.evm ?? null
}

function bridgeAddressForAsset(addresses: BridgeAddressSet | undefined, asset: BridgeSupportedAsset | undefined) {
  if (!addresses || !asset) return null
  const chainName = asset.chainName.toLowerCase()
  if (chainName.includes('bitcoin')) return addresses.btc ?? null
  if (chainName.includes('solana') || asset.chainId === '1151111081099710') return addresses.svm ?? null
  return addresses.evm ?? firstBridgeAddress(addresses)
}

function preferredBridgeDepositAsset(assets: BridgeSupportedAsset[]) {
  return assets.find((asset) => asset.chainName.toLowerCase().includes('polygon') && asset.token.symbol.toUpperCase() === 'USDC')
    ?? assets.find((asset) => asset.chainName.toLowerCase().includes('polygon'))
    ?? assets.find((asset) => asset.token.symbol.toUpperCase() === 'USDC')
    ?? null
}

function uniqueBridgeChains(assets: BridgeSupportedAsset[]) {
  const seen = new Set<string>()
  const chains: Array<{ chainId: string; chainName: string }> = []
  for (const asset of assets) {
    if (seen.has(asset.chainId)) continue
    seen.add(asset.chainId)
    chains.push({ chainId: asset.chainId, chainName: asset.chainName })
  }
  return chains
}

type ParsedMarketSearchInput = {
  query: string
  marketSlug: string | null
  eventSlug: string | null
}

function parseMarketSearchInput(value: string): ParsedMarketSearchInput {
  const trimmed = value.trim()
  if (!trimmed) return { query: '', marketSlug: null, eventSlug: null }
  const parsedUrl = parsePolymarketSearchUrl(trimmed)
  if (parsedUrl) return parsedUrl
  return { query: trimmed, marketSlug: null, eventSlug: null }
}

function parsePolymarketSearchUrl(value: string): ParsedMarketSearchInput | null {
  const urlText = /^https?:\/\//i.test(value)
    ? value
    : /^(?:www\.)?polymarket\.com\//i.test(value)
      ? `https://${value}`
      : null
  if (!urlText) return null
  try {
    const url = new URL(urlText)
    if (!/(^|\.)polymarket\.com$/i.test(url.hostname)) return null
    const segments = url.pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment.trim()))
      .filter(Boolean)
    const route = segments[0]?.toLowerCase()
    const slug = ((route === 'event' || route === 'market') ? segments[1] : segments.at(-1)) ?? ''
    if (!slug) return { query: '', marketSlug: null, eventSlug: null }
    return {
      query: slug,
      marketSlug: route === 'market' ? slug : null,
      eventSlug: route === 'event' ? slug : null,
    }
  } catch {
    return null
  }
}

function MarketNetwork({ onConfirmMarket, searchFocusRequest }: { onConfirmMarket: (market: Market) => void; searchFocusRequest: number }) {
  const searchAreaRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [activeCategory, setActiveCategory] = useState('hot')
  const [categories, setCategories] = useState<ApiMarketCategory[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSearch, setSelectedSearch] = useState<MarketSearchResult | null>(null)
  const [searchResults, setSearchResults] = useState<MarketSearchResult[]>([])
  const [activeSearchType, setActiveSearchType] = useState<SearchResultType>('market')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [networkMarkets, setNetworkMarkets] = useState<Market[]>([])
  const [networkEdges, setNetworkEdges] = useState<ApiMarketEdge[]>([])
  const [networkSummary, setNetworkSummary] = useState<NetworkSummary>({
    total: 0,
    totalEvents: null,
    totalMarkets: 0,
    returned: 0,
    limit: 25,
    hasMore: false,
    category: 'hot',
    topologySource: 'local',
    nodeType: 'event',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const visibleCategories = useMemo(() => orderVisibleMarketCategories(categories), [categories])
  const activeCategoryLabel = useMemo(
    () => categories.find((category) => category.key === activeCategory)?.label || activeCategory,
    [activeCategory, categories],
  )
  const searchTarget = useMemo(() => parseMarketSearchInput(searchQuery), [searchQuery])

  useEffect(() => {
    if (!searchFocusRequest) return undefined
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
      if (searchResults.length || searchTarget.query.length >= 2) setSearchOpen(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [searchFocusRequest, searchResults.length, searchTarget.query.length])

  useEffect(() => {
    const controller = new AbortController()
    fetch(`${API_PREFIX}/markets/categories`, { signal: controller.signal })
      .then((response) => {
        return readApiData<MarketCategoriesResponse['data']>(response)
      })
      .then((data) => {
        if (data.categories.length) setCategories(data.categories)
      })
      .catch(() => {
        if (!controller.signal.aborted) setCategories([])
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
    const trimmedQuery = searchTarget.query
    if (selectedSearch && searchQuery.trim() === selectedSearch.title) {
      return
    }
    if (trimmedQuery.length < 2) {
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setSearchLoading(true)
      const params = new URLSearchParams({ q: trimmedQuery, limit: '8' })
      fetch(`${API_PREFIX}/markets/search?${params.toString()}`, { signal: controller.signal })
        .then((response) => {
          return readApiData<MarketSearchResponse['data']>(response)
        })
        .then((data) => {
          setSearchResults(data.results)
          setSearchError(null)
          setSearchOpen(true)
          if (!data.results.some((result) => result.type === activeSearchType)) {
            setActiveSearchType(data.results.find((result) => result.type)?.type ?? 'market')
          }
        })
        .catch((fetchError: Error) => {
          if (fetchError.name !== 'AbortError') {
            setSearchResults([])
            setSearchError(copy('Search is temporarily unavailable. The market network will still use your typed filter.'))
            setSearchOpen(true)
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
  }, [activeSearchType, searchQuery, searchTarget.query, selectedSearch])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 12000)
    const params = new URLSearchParams({ limit: '25', nodeType: 'event' })
    const trimmedQuery = searchTarget.query
    if (selectedSearch?.type === 'market' && selectedSearch.marketId) {
      params.set('marketId', selectedSearch.marketId)
    } else if (selectedSearch?.type === 'market' && selectedSearch.slug) {
      params.set('marketSlug', selectedSearch.slug)
    } else if (selectedSearch?.type === 'event' && (selectedSearch.eventId || selectedSearch.eventSlug)) {
      if (selectedSearch.eventId) params.set('eventId', selectedSearch.eventId)
      if (selectedSearch.eventSlug) params.set('eventSlug', selectedSearch.eventSlug)
    } else if (selectedSearch?.type === 'topic' && (selectedSearch.categoryKey || selectedSearch.topic)) {
      params.set('category', selectedSearch.categoryKey || selectedSearch.topic || '')
    } else if (searchTarget.marketSlug) {
      params.set('marketSlug', searchTarget.marketSlug)
    } else if (searchTarget.eventSlug) {
      params.set('eventSlug', searchTarget.eventSlug)
    } else {
      if (activeCategory !== 'all') params.set('category', activeCategory)
      if (trimmedQuery) params.set('q', trimmedQuery)
    }
    fetch(`${API_PREFIX}/markets/network?${params.toString()}`, { signal: controller.signal })
      .then((response) => {
        return readApiData<BackendMarketNetwork>(response)
      })
      .then((data) => {
        if (cancelled) return
        const payload = backendNetworkToResponse(data)
        const nodes = payload.nodes.map(apiNodeToMarket)
        setNetworkMarkets(nodes)
        setNetworkEdges(nodes.length ? payload.edges : [])
        setNetworkSummary({
          total: data.total ?? nodes.length,
          totalEvents: data.totalEvents ?? null,
          totalMarkets: data.totalMarkets ?? data.total ?? null,
          returned: data.returned ?? nodes.length,
          limit: data.limit ?? 25,
          hasMore: data.hasMore ?? false,
          category: data.category ?? activeCategory,
          topologySource: data.topologySource ?? data.source ?? 'database',
          nodeType: data.nodeType ?? 'event',
        })
        setError(null)
      })
      .catch((fetchError: Error) => {
        if (cancelled) return
        if (fetchError.name === 'AbortError' && !timedOut) return
        setError(timedOut ? copy('Market network timed out. Please try again later.') : fetchError.message)
        setNetworkMarkets([])
        setNetworkEdges([])
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [activeCategory, searchTarget.eventSlug, searchTarget.marketSlug, searchTarget.query, selectedSearch])

  const chooseSearchResult = useCallback((result: MarketSearchResult) => {
    setSelectedSearch(result)
    setSearchQuery(result.title)
    setSearchOpen(false)
    setActiveSearchType(result.type)
    setLoading(true)
  }, [])

  const clearSearch = useCallback(() => {
    setSelectedSearch(null)
    setSearchQuery('')
    setSearchResults([])
    setActiveSearchType('market')
    setSearchOpen(false)
    setSearchError(null)
    setLoading(true)
  }, [])

  return (
    <section className="page page-network">
      <div className="search-row">
        <div className="search-area" ref={searchAreaRef}>
          <div className="searchbox">
            <Search size={18} />
            <input
              aria-label={copy('Search markets, events, or topics')}
              onChange={(event) => {
                const nextValue = event.target.value
                setSelectedSearch(null)
                setLoading(true)
                setSearchQuery(nextValue)
                if (nextValue.trim().length < 2) {
                  setSearchResults([])
                  setSearchOpen(false)
                  setSearchLoading(false)
                  setSearchError(null)
                }
              }}
              onFocus={() => {
                if (searchResults.length || searchTarget.query.length >= 2) setSearchOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && searchResults[0]) chooseSearchResult(searchResults[0])
                if (event.key === 'Escape') setSearchOpen(false)
              }}
              placeholder={copy('Search markets, events, topics, or paste a Polymarket link...')}
              ref={searchInputRef}
              type="text"
              value={searchQuery}
            />
            {searchQuery ? (
              <button className="search-clear" type="button" aria-label={copy('Clear search')} onClick={clearSearch}>
                ×
              </button>
            ) : null}
          </div>
          {searchOpen && (searchLoading || searchError || searchResults.length || searchTarget.query.length >= 2) ? (
            <SearchPopover
              activeType={activeSearchType}
              error={searchError}
              loading={searchLoading}
              onTypeChange={setActiveSearchType}
              onSelect={chooseSearchResult}
              query={searchTarget.query || searchQuery}
              results={searchResults}
            />
          ) : null}
        </div>
      </div>
      <CategoryChips
        active={activeCategory}
        categories={visibleCategories}
        onChange={(category) => {
          setLoading(true)
          setActiveCategory(category)
        }}
      />
      <div className="network-summary">
        <strong>{activeCategoryLabel}</strong>
        {networkSummary.nodeType === 'event' ? (
          <>
            <span>{formatCompactCount(networkSummary.returned)} / {formatCompactCount(networkSummary.totalEvents ?? networkSummary.returned)} events</span>
            <span>{formatCompactCount(networkSummary.totalMarkets ?? networkSummary.total)} source markets</span>
          </>
        ) : (
          <span>{formatCompactCount(networkSummary.returned)} / {formatCompactCount(networkSummary.total)} markets</span>
        )}
        {networkSummary.hasMore ? <span>limit {formatCompactCount(networkSummary.limit)}</span> : null}
        <span className="arc-summary-pill"><ShieldCheck size={14} /> Arc audit enabled</span>
      </div>
      <div className="network-stage">
        <NetworkMap edges={networkEdges} loading={loading} markets={networkMarkets} onConfirmMarket={onConfirmMarket} />
        {error ? <div className="network-error">{copy(`Backend data is temporarily unavailable: ${error}`)}</div> : null}
      </div>
    </section>
  )
}

type SelectedInferenceOutcome = {
  rootMarketId: string
  market: Market
  outcomeId: string
  label: string
}

function MarketDetail({
  market,
  onBack,
  onInfer,
}: {
  market: Market
  onBack: () => void
  onInfer: (market?: Market, outcomeId?: string | null) => void
}) {
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null)
  const [eventDetailRefreshing, setEventDetailRefreshing] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState<SelectedInferenceOutcome | null>(null)
  const detailParams = useMemo(() => {
    const params = new URLSearchParams()
    if (market.nodeType === 'event' && (market.eventId || market.id)) {
      params.set('eventId', market.eventId || market.id)
    } else if (market.marketId) {
      params.set('marketId', market.marketId)
    } else if (market.eventId && !market.outcomes?.length) {
      params.set('eventId', market.eventId)
    } else {
      params.set('marketId', market.id)
    }
    return params.toString()
  }, [market.eventId, market.id, market.marketId, market.nodeType, market.outcomes?.length])

  const loadEventDetail = useCallback(async (signal?: AbortSignal, showRefreshing = false, forceRefresh = false) => {
    if (showRefreshing) setEventDetailRefreshing(true)
    try {
      const params = new URLSearchParams(detailParams)
      if (forceRefresh) params.set('refresh', 'true')
      const data = await fetch(`${API_PREFIX}/events/detail?${params.toString()}`, { signal })
      .then((response) => {
        return readApiData<EventDetailResponse['data']>(response)
      })
      setEventDetail(data)
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') setEventDetail(null)
    } finally {
      if (showRefreshing && !signal?.aborted) setEventDetailRefreshing(false)
    }
  }, [detailParams])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void loadEventDetail(controller.signal)
    }, 0)
    const interval = window.setInterval(() => {
      void loadEventDetail(controller.signal)
    }, 15_000)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(interval)
      controller.abort()
    }
  }, [loadEventDetail])

  const handleRefreshEventDetail = useCallback(() => {
    const controller = new AbortController()
    void loadEventDetail(controller.signal, true, true)
    return () => controller.abort()
  }, [loadEventDetail])

  const eventMarkets = useMemo(
    () => eventDetail?.markets.map(apiNodeToMarket) || [],
    [eventDetail],
  )
  const selectedEventMarket = useMemo(() => {
    if (eventDetail?.selectedMarket) return apiNodeToMarket(eventDetail.selectedMarket, 0)
    return eventMarkets.find((item) => item.id === (market.marketId ?? market.id)) || market
  }, [eventDetail, eventMarkets, market])
  const eventSummaryMarket = eventMarkets.length > 1 ? eventToMarket(eventDetail?.event || null, market) : selectedEventMarket
  const displayMarket = eventMarkets.length > 1 ? eventSummaryMarket : selectedEventMarket
  const detailMarkets = eventMarkets.length > 1 ? eventMarkets : [selectedEventMarket]
  const ruleCopy = marketRuleCopy(displayMarket)
  const descriptionCopy = marketDescriptionCopy(displayMarket)
  const primaryMarket = [...detailMarkets].sort((a, b) => b.price - a.price || (b.volumeValue || 0) - (a.volumeValue || 0))[0] || market
  const fallbackInferenceMarket = marketInferenceOutcome(displayMarket) ? displayMarket : primaryMarket
  const activeSelectedOutcome = selectedOutcome?.rootMarketId === market.id ? selectedOutcome : null
  const inferenceMarket = activeSelectedOutcome?.market ?? fallbackInferenceMarket
  const inferenceReady = Boolean(activeSelectedOutcome?.outcomeId) && marketIsTradable(inferenceMarket)
  const handleSelectOutcome = useCallback((selectedMarket: Market, action: OrderbookOutcomeAction) => {
    if (!action.outcomeId) return
    if (!marketIsTradable(selectedMarket)) return
    setSelectedOutcome({
      rootMarketId: market.id,
      market: selectedMarket,
      outcomeId: action.outcomeId,
      label: action.label,
    })
  }, [market.id])
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
                {eventMarkets.length > 1 ? <span>{displayMarket.eventTitle || eventSummaryMarket.title}</span> : displayMarket.eventTitle ? <span>{displayMarket.eventTitle}</span> : null}
                {eventMarkets.length > 1 ? <span>{copy(`${detailMarkets.length} market${detailMarkets.length === 1 ? '' : 's'}`)}</span> : null}
              </div>
              <h1>{displayMarket.title}</h1>
            </div>
            <div className="market-head-actions">
              <button className="outline-button" type="button" disabled={eventDetailRefreshing} onClick={handleRefreshEventDetail}>
                <RotateCw size={17} /> {eventDetailRefreshing ? copy('Refreshing') : copy('Refresh prices')}
              </button>
              <button className="outline-button square" type="button" aria-label={copy('Save market')}>
                <Star size={18} />
              </button>
              <button className="outline-button" type="button">
                <Share2 size={17} /> {copy('Share')}
              </button>
            </div>
          </div>

          <Card className="market-live-card">
            <div className="market-live-strip">
              <div>
                <span>{eventMarkets.length > 1 ? copy('Leading Market') : copy('Current Probability')}</span>
                <strong>{primaryMarket.price}%</strong>
                <em className={primaryMarket.change >= 0 ? 'green-text' : 'red-text'}>{eventMarkets.length > 1 ? marketDisplayLabel(primaryMarket) : marketChangeText(primaryMarket)}</em>
              </div>
              <div>
                <span>{copy('Volume')}</span>
                <strong>{displayMarket.volume}</strong>
              </div>
              <div>
                <span>{copy('Liquidity')}</span>
                <strong>{formatCompactMoney(displayMarket.liquidity)}</strong>
              </div>
              <div>
                <span>{copy('End Date')}</span>
                <strong>{formatDate(displayMarket.endDate)}</strong>
              </div>
            </div>
            <MarketPriceChart eventMarkets={detailMarkets} focusMarket={selectedEventMarket} loadPriceHistory={fetchMarketPriceHistory} market={displayMarket} />
            <MarketOrderBook
              eventMarkets={detailMarkets}
              hasMoreMarkets={Boolean(eventDetail?.event?.hasMoreMarkets)}
              loading={!eventDetail}
              market={displayMarket}
              onSelectOutcome={handleSelectOutcome}
              selectedOutcomeId={activeSelectedOutcome?.outcomeId ?? null}
              totalMarkets={eventDetail?.event?.marketsCount ?? detailMarkets.length}
            />
            <div className="market-data-freshness">
              <span>{copy('Market list auto-refreshes every 15s from Causeway backend cache.')}</span>
              <b>{copy(`Synced ${formatDateTime(displayMarket.syncedAt)}`)}</b>
            </div>
          </Card>
        </div>

        <aside className="market-detail-side">
          <Card className="market-side-card">
            <SectionHeader title={copy('Rules')} />
            <div className="market-rule-copy">
              <p>{descriptionCopy}</p>
              {ruleCopy !== descriptionCopy ? <p>{ruleCopy}</p> : null}
            </div>
          </Card>
          <Card className="market-side-card">
            <SectionHeader title={copy('Market Info')} />
            <InfoTable
              rows={[
                [copy('Market ID'), market.id],
                [copy('Event'), displayMarket.eventTitle || copy('Not provided')],
                [copy('End Date'), formatDate(displayMarket.endDate)],
                [copy('Category'), displayMarket.category],
                [copy('Source'), 'Polymarket'],
                [copy('Contract Type'), detailMarkets.length > 1 ? copy('Event with multiple markets') : copy('Binary market')],
                [copy('Trading Status'), detailMarkets.some(marketIsTradable) ? copy('Tradable') : marketTradingStatusLabel(displayMarket)],
                [copy('Minimum Order'), market.orderMinSize ? `${market.orderMinSize}` : copy('Not provided')],
                [copy('Minimum Tick'), market.tickSize ? `${market.tickSize}` : copy('Not provided')],
                [copy('Synced At'), formatDate(displayMarket.syncedAt)],
              ]}
            />
          </Card>
        </aside>
      </div>
      <button className="primary-action" type="button" onClick={() => onInfer(inferenceMarket, activeSelectedOutcome?.outcomeId ?? null)} disabled={!inferenceReady}>
        <BrainCircuit size={20} /> {activeSelectedOutcome
          ? copy(`Use ${activeSelectedOutcome.label} as inference root`)
          : copy('Select an outcome to start inference')}
      </button>
    </section>
  )
}

function modelPreferenceLabel(model: InferenceModelPreference) {
  return {
    'gpt-5.5': 'GPT-5.5',
    'gpt-5.4': 'GPT-5.4',
    'claude-sonnet-4.7': 'Claude Sonnet 4.7',
    'claude-sonnet-4.6': 'Claude Sonnet 4.6',
    'claude-opus-4.7': 'Claude Opus 4.7',
    'claude-opus-4.6': 'Claude Opus 4.6',
  }[model]
}

function modelPreferenceHint(model: InferenceModelPreference) {
  if (inferenceModelRequiresPremium(model)) return 'Premium model for higher quality reasoning.'
  return 'Free default model for standard inference.'
}

function modelPreferenceFromProviderModel(model: string): InferenceModelPreference | null {
  if ((INFERENCE_MODEL_ORDER as readonly string[]).includes(model)) return model as InferenceModelPreference
  return null
}

function inferenceModelOptions(capability: BackendInferenceCapability | null): InferenceModelPreference[] {
  const options: InferenceModelPreference[] = []
  for (const model of capability?.models ?? []) {
    const preference = modelPreferenceFromProviderModel(model)
    if (preference && !options.includes(preference)) options.push(preference)
  }
  if (!options.length) options.unshift(FREE_INFERENCE_MODEL)
  return options.sort((left, right) => modelSortWeight(left) - modelSortWeight(right))
}

function defaultInferenceModelOption(capability: BackendInferenceCapability | null): InferenceModelPreference {
  const options = inferenceModelOptions(capability)
  const defaultModel = capability?.defaultModel ? modelPreferenceFromProviderModel(capability.defaultModel) : null
  if (defaultModel && options.includes(defaultModel)) return defaultModel
  return options[0] ?? FREE_INFERENCE_MODEL
}

function modelSortWeight(model: InferenceModelPreference) {
  return INFERENCE_MODEL_ORDER.indexOf(model)
}

function inferenceModelRequiresPremium(model: InferenceModelPreference) {
  return !FREE_INFERENCE_MODELS.includes(model)
}

function displayInferenceModel(model?: string | null) {
  const preference = model ? modelPreferenceFromProviderModel(model) : null
  return preference ? modelPreferenceLabel(preference) : model || modelPreferenceLabel(FREE_INFERENCE_MODEL)
}

function confidenceModeLabel(mode: ConfidenceMode) {
  return {
    broad: copy('Broad coverage'),
    balanced: copy('Balanced (Recommended)'),
    strict: copy('High confidence'),
  }[mode]
}

function confidenceThresholdForMode(mode: ConfidenceMode) {
  return mode === 'broad' ? 0.35 : mode === 'strict' ? 0.7 : 0.55
}

function confidenceModeFromThreshold(threshold: number): ConfidenceMode {
  if (threshold < 0.5) return 'broad'
  if (threshold >= 0.65) return 'strict'
  return 'balanced'
}

function confidenceThresholdPercent(threshold: number) {
  const min = 0.1
  const max = 0.85
  return ((clamp(threshold, min, max) - min) / (max - min)) * 100
}

function estimateInference(settings: InferenceSettingsState) {
  const maxMarketsPerLayer = inferenceMaxMarketsPerLayer(settings.depth)
  const maxOutputMarkets = settings.depth * maxMarketsPerLayer
  const candidateBudget = clamp(Math.max(maxOutputMarkets * 5, maxMarketsPerLayer * 4, 30), 30, 120)
  const minutes = inferenceModelRequiresPremium(settings.modelPreference)
    ? settings.depth === 3 ? '3-6 min' : '2-4 min'
    : settings.depth === 3 ? '2-5 min' : '1-3 min'
  return {
    candidateBudget,
    maxMarketsPerLayer,
    maxOutputMarkets,
    minutes,
  }
}

function expectedInferenceItems(settings: InferenceSettingsState) {
  const estimate = estimateInference(settings)
  return [
    copy(`Up to ${estimate.candidateBudget} candidate markets prepared for the prompt`),
    copy(`Causal graph capped at ${settings.depth} layer${settings.depth > 1 ? 's' : ''}`),
    copy(`AI output must meet minimum confidence ${settings.confidenceThreshold.toFixed(2)}`),
    copy(`Up to ${estimate.maxOutputMarkets} related markets can be kept in the generated script`),
  ]
}

function InferenceSettings({
  auth,
  initialSettings,
  market,
  membershipState,
  onBack,
  onStart,
}: {
  auth: CausewayAuth
  initialSettings: InferenceSettingsState
  market: Market
  membershipState: MembershipState
  onBack: () => void
  onStart: (settings: InferenceSettingsState) => void
}) {
  const { openConnectModal } = useConnectModal()
  const [settings, setSettings] = useState<InferenceSettingsState>(initialSettings)
  const [capability, setCapability] = useState<BackendInferenceCapability | null>(null)
  const [capabilityError, setCapabilityError] = useState<string | null>(null)
  const updateSettings = useCallback((patch: Partial<InferenceSettingsState>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    fetchInferenceCapability(controller.signal)
      .then((nextCapability) => {
        setCapability(nextCapability)
        setCapabilityError(null)
        setSettings((current) => {
          const options = inferenceModelOptions(nextCapability)
          return options.includes(current.modelPreference) ? current : { ...current, modelPreference: defaultInferenceModelOption(nextCapability) }
        })
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setCapabilityError(errorMessage(error))
      })
    return () => controller.abort()
  }, [])
  const selectConfidenceMode = useCallback((mode: ConfidenceMode) => {
    updateSettings({
      confidenceMode: mode,
      confidenceThreshold: confidenceThresholdForMode(mode),
    })
  }, [updateSettings])
  const estimate = estimateInference(settings)
  const outcomeReady = Boolean(marketInferenceOutcome(market))
  const isPremium = auth.isAuthenticated && membershipState.membership?.tier === 'premium'
  const modelOptions = inferenceModelOptions(capability)
  const capabilityLoading = !capability && !capabilityError
  const selectedModelSupported = modelOptions.includes(settings.modelPreference)
  const capabilityUnavailable = Boolean(capabilityError)
    || capability?.status === 'unavailable'
    || (capability?.status === 'available' && !selectedModelSupported)
  const advancedModelLocked = inferenceModelRequiresPremium(settings.modelPreference) && !isPremium
  const advancedDepthLocked = settings.depth > 1 && !isPremium
  const advancedSettingsLocked = advancedModelLocked || advancedDepthLocked
  const startDisabled = auth.isSigningIn || !outcomeReady || advancedSettingsLocked || capabilityLoading || capabilityUnavailable
  const handleStartInference = useCallback(() => {
    if (!outcomeReady || capabilityLoading || capabilityUnavailable) return
    if (advancedSettingsLocked) return
    if (!auth.isConnected) {
      openConnectModal?.()
      return
    }
    if (!auth.isAuthenticated) {
      void auth.signIn()
      return
    }
    onStart(settings)
  }, [advancedSettingsLocked, auth, capabilityLoading, capabilityUnavailable, onStart, openConnectModal, outcomeReady, settings])
  const capabilityHint = capabilityError
    ? copy(`Model capability check failed: ${capabilityError}`)
    : capability?.status === 'available'
      ? copy(`Available · Default ${capability.defaultModel ? displayInferenceModel(capability.defaultModel) : 'Not configured'}`)
      : capabilityLoading
        ? copy('Checking model availability')
        : capability?.reason ?? modelPreferenceHint(settings.modelPreference)
  const selectedOutcome = market.outcomes?.find((outcome) => outcome.outcomeId === settings.rootOutcomeId) ?? market.outcomes?.find((outcome) => outcome.outcomeId)
  const selectedOutcomePercent = outcomePriceToPercent(selectedOutcome?.price) ?? market.price
  const startButtonLabel = capabilityLoading
    ? copy('Checking AI Availability')
    : capabilityUnavailable
      ? copy('AI Inference Unavailable')
      : !outcomeReady
        ? copy('Outcome Not Ready')
        : advancedSettingsLocked
          ? copy('Premium Required')
          : !auth.isConnected
            ? copy('Connect Wallet to Start')
            : !auth.isAuthenticated
              ? copy('Sign In to Start')
              : copy('Start AI Inference')
  return (
    <section className="page">
      <BackButton onClick={onBack} />
      <div className="settings-page-head">
        <div>
          <span>{copy('AI run setup')}</span>
          <h1>{copy('AI Inference Settings')}</h1>
          <p>{copy('Configure the request fields that are sent to the backend inference run.')}</p>
        </div>
        <div className="settings-head-actions">
          <span><BrainCircuit size={16} />{modelPreferenceLabel(settings.modelPreference)}</span>
          <span><ListOrdered size={16} />{copy(`${settings.depth} layer${settings.depth > 1 ? 's' : ''}`)}</span>
          <span><ShieldCheck size={16} />{copy(`Threshold ${settings.confidenceThreshold.toFixed(2)}`)}</span>
        </div>
      </div>
      <div className="content-grid settings-grid">
        <Card className="span-8 settings-panel">
          <SectionHeader title={copy('Root Market')} />
          <div className="root-market-card">
            <MarketIcon market={market} size="medium" />
            <div>
              <h3>{market.title}</h3>
              <p>{marketSubtitle(market)}</p>
              {selectedOutcome ? <span className="root-outcome-pill">{copy(`Inference direction: ${selectedOutcome.label}`)}</span> : null}
            </div>
            <strong>{selectedOutcomePercent}%</strong>
            {market.change ? <span className={market.change >= 0 ? 'green-text' : 'red-text'}>{marketChangeText(market)}</span> : null}
            <div className="mini-stat">
              <b>{market.volume}</b>
              <span>{copy('Volume')}</span>
            </div>
            <div className="mini-stat">
              <b>{formatCompactMoney(market.liquidity)}</b>
              <span>{copy('Liquidity')}</span>
            </div>
          </div>
          <Divider />
          <SectionHeader title={copy('Backend Request')} note={copy('Only active inference parameters are shown here.')} />
          <div className="settings-summary-grid">
            <div>
              <span>{copy('Root outcome')}</span>
              <b>{selectedOutcome?.label ?? copy('Not selected')}</b>
            </div>
            <div>
              <span>{copy('Candidate budget')}</span>
              <b>{copy(`Up to ${estimate.candidateBudget}`)}</b>
            </div>
            <div>
              <span>{copy('Output cap')}</span>
              <b>{copy(`Up to ${estimate.maxOutputMarkets}`)}</b>
            </div>
            <div>
              <span>{copy('Cache')}</span>
              <b>{copy('Enabled')}</b>
            </div>
          </div>
          <Divider />
          <div className="settings-control-grid">
            <label className="field">
              <span>{copy('AI Model')}</span>
              <select value={settings.modelPreference} onChange={(event) => updateSettings({ modelPreference: event.target.value as InferenceModelPreference })}>
                {modelOptions.map((model) => (
                  <option disabled={inferenceModelRequiresPremium(model) && !isPremium} key={model} value={model}>
                    {modelPreferenceLabel(model)}{inferenceModelRequiresPremium(model) ? ' - Premium' : ' - Free'}
                  </option>
                ))}
              </select>
              <small>{modelPreferenceHint(settings.modelPreference)} · {capabilityHint}</small>
            </label>
            <div className="field depth-field">
              <span>{copy('Inference Depth')}</span>
              <div className="segmented">
                {[1, 2, 3].map((depth) => (
                  <button
                    className={settings.depth === depth ? 'active' : ''}
                    disabled={depth > 1 && !isPremium}
                    key={depth}
                    type="button"
                    onClick={() => updateSettings({ depth: depth as InferenceDepth })}
                  >
                    {depth} layer{depth > 1 ? ' · Premium' : ' · Free'}
                  </button>
                ))}
              </div>
              <small>{copy(`Max ${estimate.maxMarketsPerLayer} related markets per layer`)}</small>
            </div>
          </div>
          <div className="range-block">
            <div className="range-label">
              <span>{copy('Confidence Threshold')}</span>
              <b>{settings.confidenceThreshold.toFixed(2)} · {confidenceModeLabel(settings.confidenceMode)}</b>
            </div>
            <div className="confidence-presets">
              {(['broad', 'balanced', 'strict'] as const).map((mode) => (
                <button
                  className={settings.confidenceMode === mode ? 'active' : ''}
                  key={mode}
                  type="button"
                  onClick={() => selectConfidenceMode(mode)}
                >
                  {confidenceModeLabel(mode)}
                </button>
              ))}
            </div>
            <input
              aria-label={copy('Confidence threshold')}
              className="confidence-slider"
              max="0.85"
              min="0.1"
              onChange={(event) => {
                const confidenceThreshold = Number(event.target.value)
                updateSettings({
                  confidenceMode: confidenceModeFromThreshold(confidenceThreshold),
                  confidenceThreshold,
                })
              }}
              step="0.05"
              type="range"
              value={settings.confidenceThreshold}
            />
            <div className="range-track">
              <span style={{ width: `${confidenceThresholdPercent(settings.confidenceThreshold)}%` }} />
            </div>
            <div className="range-scale">
              <span>0.10</span>
              <span>0.55</span>
              <span>0.85</span>
            </div>
          </div>
          <div className="estimate-strip">
            <span>
              <Bot size={18} /> <b>{copy('Runtime')}</b> {estimate.minutes}
            </span>
            <span>
              <Cpu size={18} /> <b>{copy('Candidates')}</b> {copy(`Up to ${estimate.candidateBudget}`)}
            </span>
            <span>
              <ListOrdered size={18} /> <b>{copy('Output')}</b> {copy(`Up to ${estimate.maxOutputMarkets}`)}
            </span>
            <span>
              <ShieldCheck size={18} /> <b>{copy('Minimum confidence')}</b> {settings.confidenceThreshold.toFixed(2)}
            </span>
          </div>
          {!auth.isAuthenticated ? (
            <div className="soft-note auth-note">
              <ShieldCheck size={18} />
              {copy('AI inference requires wallet sign-in. The backend protects your scripts, orders, and portfolio data with a bearer token.')}
            </div>
          ) : null}
          {!outcomeReady ? (
            <div className="soft-note auth-note">
              <Info size={18} />
              {copy('Market outcome data is still loading. Return to details and wait until inference is available.')}
            </div>
          ) : null}
          {capabilityLoading || capabilityUnavailable ? (
            <div className="soft-note auth-note">
              <Info size={18} />
              {capabilityLoading ? copy('AI model availability is being checked.') : capabilityHint}
            </div>
          ) : null}
          {advancedSettingsLocked ? (
            <div className="soft-note auth-note">
              <Star size={18} />
              {copy('Premium membership is required for advanced GPT/Claude models or inference deeper than 1 layer.')}
            </div>
          ) : null}
          {auth.isAuthenticated && membershipState.error ? (
            <div className="soft-note auth-note">
              <Info size={18} />
              Membership status is unavailable: {membershipState.error}
            </div>
          ) : null}
          <button
            className="primary-action inside"
            type="button"
            onClick={handleStartInference}
            disabled={startDisabled}
          >
            <Play size={18} /> {startButtonLabel}
          </button>
        </Card>
        <div className="side-stack">
          <Card>
            <SectionHeader title={copy('Settings Preview')} note={copy('Summary of the inference run you are about to start.')} />
            <PreviewList market={market} settings={settings} />
          </Card>
          <Card>
            <SectionHeader title={copy('Expected Analysis')} />
            <Checklist
              items={expectedInferenceItems(settings)}
            />
          </Card>
          <Card className="tip-card">
            <SectionHeader title={copy('Backend Contract')} />
            <ul>
              <li>{copy('Candidate retrieval uses same-event markets, tag overlap, text overlap, prices, and order-book context.')}</li>
              <li>{copy('Equivalent runs use backend caching when the prompt input and model match.')}</li>
              <li>{copy('Only model and depth are premium-gated by the inference API.')}</li>
            </ul>
          </Card>
        </div>
      </div>
    </section>
  )
}

function inferenceProgressSteps() {
  return [
    { stage: 'queued', label: copy('Run queued') },
    { stage: 'candidate_retrieval', label: copy('Candidate retrieval') },
    { stage: 'ai_reasoning', label: copy('AI reasoning') },
    { stage: 'outcome_mapping', label: copy('Outcome mapping') },
    { stage: 'script_generation', label: copy('Script generation') },
  ] as const
}

function inferenceProgressStepIndex(stage: string | null | undefined) {
  const steps = inferenceProgressSteps()
  const index = steps.findIndex((step) => step.stage === stage)
  return index >= 0 ? index : 0
}

function inferenceStageLabel(stage: string | null | undefined) {
  if (stage === 'queued') return copy('Queued')
  if (stage === 'candidate_retrieval') return copy('Candidate retrieval')
  if (stage === 'ai_reasoning') return copy('AI reasoning')
  if (stage === 'outcome_mapping') return copy('Outcome mapping')
  if (stage === 'script_generation') return copy('Script generation')
  return copy('Waiting')
}

function inferenceRunStatusLabel(
  runStatus: BackendInferenceStatus | null,
  loading: boolean,
  error: string | null,
  complete: boolean,
) {
  if (complete) return copy('Complete')
  if (error) return copy('Failed')
  if (runStatus?.status === 'queued') return copy('Queued')
  if (runStatus?.status === 'running') return copy('Running')
  if (runStatus?.status === 'completed') return copy('Complete')
  if (runStatus?.status === 'failed') return copy('Failed')
  if (runStatus?.status === 'cancelled') return copy('Cancelled')
  return loading ? copy('Starting') : copy('Waiting')
}

function inferenceCacheLabel(runStatus: BackendInferenceStatus | null, complete: boolean) {
  if (!runStatus) return complete ? copy('Loaded') : copy('Checking')
  if (runStatus.status === 'completed' || complete) return runStatus.cacheHit ? copy('Hit') : copy('Miss')
  if (runStatus.status === 'failed' || runStatus.status === 'cancelled') return copy('Not resolved')
  return copy('Resolving')
}

function inferenceProgressCaption(runStatus: BackendInferenceStatus | null, settings: InferenceSettingsState) {
  const model = displayInferenceModel(runStatus?.model ?? settings.modelPreference)
  const stage = inferenceStageLabel(runStatus?.stage ?? 'queued')
  return copy(`${model} - ${stage}`)
}

function inferenceVerificationNote(
  result: InferenceResult | null,
  runStatus: BackendInferenceStatus | null,
  loading: boolean,
) {
  if (result?.verification) {
    const candidateCount = result.verification.candidateCount ?? 0
    const verifiedCount = result.verification.verifiedCount ?? result.relatedMarkets.length
    const excludedCount = result.verification.excludedCount ?? 0
    return copy(`Candidates ${candidateCount} | Kept ${verifiedCount} | Excluded ${excludedCount}`)
  }
  if (loading) return copy(`${inferenceStageLabel(runStatus?.stage ?? 'queued')} in progress`)
  return copy('No verified candidate markets yet')
}

function InferenceProgress({
  auth,
  market,
  onBack,
  onDone,
  onResult,
  result,
  settings,
}: {
  auth: CausewayAuth
  market: Market
  onBack: () => void
  onDone: () => void
  onResult: (result: InferenceResult) => void
  result: InferenceResult | null
  settings: InferenceSettingsState
}) {
  const { chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const steps = inferenceProgressSteps()
  const [loading, setLoading] = useState(!result)
  const [error, setError] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<BackendInferenceStatus | null>(null)
  const { isAuthenticated, isConnected, signIn } = auth
  const hasCurrentResult = result?.rootMarket?.id === market.id
  const currentResult = hasCurrentResult ? result : null
  const isComplete = hasCurrentResult && !error
  const statusComplete = runStatus?.status === 'completed'
  const progress = isComplete || statusComplete
    ? 100
    : error
      ? 100
      : runStatus
        ? clamp(Math.round(runStatus.progress), 0, 100)
        : loading
          ? 5
          : 0
  const activeStage = isComplete || statusComplete ? 'script_generation' : runStatus?.stage ?? (loading ? 'queued' : null)
  const activeStep = inferenceProgressStepIndex(activeStage)
  const runStatusLabel = inferenceRunStatusLabel(runStatus, loading, error, isComplete)
  const stageLabel = inferenceStageLabel(activeStage)
  const cacheLabel = inferenceCacheLabel(runStatus, isComplete)
  const displayedRelatedMarkets = currentResult?.relatedMarkets
  const currentEstimate = estimateInference(settings)

  useEffect(() => {
    if (result?.rootMarket?.id === market.id) {
      return
    }
    if (!isAuthenticated && !isConnected) {
      const timer = window.setTimeout(() => {
        setRunStatus(null)
        setError(copy('Connect and sign in with your wallet before starting AI inference.'))
        setLoading(false)
      }, 0)
      return () => window.clearTimeout(timer)
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setError(null)
      setRunStatus(null)
      setLoading(true)
      const run = async () => {
        if (!isAuthenticated) {
          await signIn()
        }
        if (controller.signal.aborted) return null
        if (chainId !== supportedChain.id) {
          await switchChainAsync({ chainId: supportedChain.id })
        }
        if (controller.signal.aborted) return null
        return runBackendInference(market, settings, controller.signal, (nextStatus) => {
          if (!controller.signal.aborted) setRunStatus(nextStatus)
        })
      }
      run()
        .then((payload) => {
          if (payload) onResult(payload)
        })
        .catch((fetchError: Error) => {
          if (fetchError.name !== 'AbortError') setError(fetchError.message)
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false)
        })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [chainId, isAuthenticated, isConnected, market, market.id, onResult, result?.rootMarket?.id, settings, signIn, switchChainAsync])

  return (
    <section className="page">
      <BackButton onClick={onBack} />
      <div className="progress-overview">
        <div>
          <span>{copy('Run status')}</span>
          <b>{runStatusLabel}</b>
        </div>
        <div>
          <span>{copy('Backend progress')}</span>
          <b>{progress}%</b>
        </div>
        <div>
          <span>{copy('Current stage')}</span>
          <b>{stageLabel}</b>
        </div>
        <div>
          <span>{copy('Cache')}</span>
          <b>{cacheLabel}</b>
        </div>
      </div>
      <div className="progress-steps">
        {steps.map((step, index) => {
          const done = isComplete || statusComplete || index < activeStep
          const current = !isComplete && !statusComplete && !error && index === activeStep
          return (
          <div className={done ? 'step done' : current ? 'step current' : 'step'} key={step.stage}>
            <div className="step-circle">{done ? <CheckCircle2 size={26} /> : index + 1}</div>
            <strong>{step.label}</strong>
            <span>{done ? copy('Complete') : current ? copy('Processing') : copy('Waiting')}</span>
          </div>
        )})}
      </div>
      <div className="global-progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="progress-caption">
        <span>{runStatusLabel} <b>{progress}%</b></span>
        <span>{currentResult?.model ? copy(`Model: ${displayInferenceModel(currentResult.model)}`) : inferenceProgressCaption(runStatus, settings)}</span>
      </div>
      {error ? <div className="status-note error">{copy(`Inference request failed: ${error}`)}</div> : null}
      <div className="content-grid progress-grid">
        <Card>
          <SectionHeader
            title={copy('Verified Candidate Markets')}
            note={inferenceVerificationNote(currentResult, runStatus, loading && !hasCurrentResult)}
          />
          <DiscoveryTable market={market} relatedMarkets={displayedRelatedMarkets} loading={loading && !hasCurrentResult} />
        </Card>
        <Card>
          <SectionHeader title={copy('Live Inference Log')} />
          <LogList error={error} logs={currentResult?.logs} loading={loading && !hasCurrentResult} runStatus={runStatus} />
        </Card>
      </div>
      <Card>
        <SectionHeader title={copy('Current Inference Info')} />
        <div className="info-strip-grid">
          {[
            [copy('Root Market'), market.title],
            [copy('Inference Depth'), copy(`${settings.depth} layer${settings.depth > 1 ? 's' : ''}`)],
            [copy('AI Model'), displayInferenceModel(currentResult?.model ?? settings.modelPreference)],
            [copy('Candidate Budget'), copy(`Up to ${currentEstimate.candidateBudget}`)],
            [copy('Output Cap'), copy(`Up to ${currentEstimate.maxOutputMarkets}`)],
            [copy('Confidence Threshold'), settings.confidenceThreshold.toFixed(2)],
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
        <div className="soft-note">{englishTextOrFallback(
          result?.verification?.summary || result?.summary,
          copy('AI combines Polymarket order books, same-event markets, and related market context to generate causal inference.'),
        )}</div>
      </Card>
      <button className="floating-next" type="button" onClick={onDone} disabled={!hasCurrentResult}>
        {copy('View Generated Script')} <ArrowRight size={18} />
      </button>
    </section>
  )
}

function CausalScript({
  auth,
  market,
  onBack,
  onScripts,
  result,
}: {
  auth: CausewayAuth
  market: Market
  onBack: () => void
  onScripts: () => void
  result: InferenceResult | null
}) {
  const scriptChains = useMemo(() => displayScriptChains(market, result), [market, result])
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null)
  const selectedChain = scriptChains.find((chain) => chain.id === selectedChainId) || scriptChains[0]
  const selectedOrderSelectionIds = useMemo(
    () => selectedChain?.legs.map((leg) => leg.selectionId).filter((selectionId): selectionId is string => Boolean(selectionId)) ?? [],
    [selectedChain],
  )
  const openOrderPanel = useCallback(() => {
    document.getElementById('script-order-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  const scriptSubtitleFallback = copy(
    `AI-generated causal script showing which tradable Polymarket books may react if "${market.title}" occurs.`,
  )
  const scriptSubtitle = englishTextOrFallback(result?.thesis, scriptSubtitleFallback)
  const causalPathSummaryFallback = copy(
    'Based on current market prices, volume, and structured causal modeling, AI identified the main impact paths and logic below.',
  )
  const causalPathSummary = englishTextOrFallback(result?.summary, causalPathSummaryFallback)

  return (
    <section className="page">
      <BackButton onClick={onBack} />
      <div className="script-header">
        <div className="script-context-line">{scriptSubtitle}</div>
        <div className="script-actions">
          <button className="outline-button" type="button">
            <Download size={17} /> {copy('Export Map')}
          </button>
          <button className="outline-button" type="button">
            <Share2 size={17} /> {copy('Share')}
          </button>
        </div>
      </div>
      <div className="tabbar">
        <button className="active" type="button">{copy('Graph View')}</button>
        <button type="button">{copy('Script Detail')}</button>
      </div>
      <div className="content-grid script-grid">
        <Card className="script-map-card">
          <CausalMap
            chains={scriptChains}
            market={market}
            onOpenOrderPanel={openOrderPanel}
            onSelectedChainIdChange={setSelectedChainId}
            result={result}
            selectedChainId={selectedChain?.id ?? null}
          />
        </Card>
        <Card>
          <SectionHeader title={copy('Causal Path Summary')} />
          <p className="body-copy">{causalPathSummary}</p>
          <SummaryList market={market} result={result} />
          <div className="soft-note">{copy('This is AI-generated scenario analysis based on current data and models. It is not financial advice. Markets involve risk.')}</div>
        </Card>
      </div>
      <ArcProofPanel auth={auth} scriptId={result?.scriptId ?? null} />
      <ScriptOrderPanel auth={auth} result={result} selectedSelectionIds={selectedOrderSelectionIds} />
      <Card className="script-footer-card">
        <div className="footer-meta">
          <span><BrainCircuit size={16} /> {copy(`Inference model: ${displayInferenceModel(result?.model)}`)}</span>
          <span><Globe2 size={16} /> {copy('Data source: Polymarket markets and order books')}</span>
          <span><Activity size={16} /> {copy(`Inference time: ${formatDateTime(result?.generatedAt)}`)}</span>
          <span><Bot size={16} /> {copy(`Confidence: ${formatConfidence(result?.confidence)}`)}</span>
        </div>
        <div className="footer-actions">
          <span className="script-saved-pill"><CheckCircle2 size={16} /> {copy('Auto-saved')}</span>
          <button className="outline-button" type="button" onClick={onScripts}>{copy('View My Scripts')}</button>
          <button className="primary-button" type="button"><RotateCw size={17} /> {copy('Run Again')}</button>
        </div>
      </Card>
    </section>
  )
}

function ArcProofPanel({ auth, scriptId }: { auth: CausewayAuth; scriptId: string | null }) {
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient } = useWalletClient()
  const [proof, setProof] = useState<ArcProofResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [anchoring, setAnchoring] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadProof = useCallback(async (signal?: AbortSignal) => {
    if (!auth.accessToken || !scriptId) {
      setProof(null)
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const nextProof = await fetchArcProof(auth.accessToken, scriptId, signal)
      setProof(nextProof)
      return nextProof
    } catch (loadError) {
      if (!signal?.aborted) setError(errorMessage(loadError))
      return null
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [auth.accessToken, scriptId])

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void loadProof(controller.signal)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [loadProof])

  const anchorProof = useCallback(async () => {
    if (!auth.accessToken || !scriptId) {
      setError('Sign in before anchoring a reasoning trace.')
      return
    }
    if (!address || !sameAddress(address, auth.walletAddress)) {
      setError('Connected wallet must match the signed-in wallet.')
      return
    }
    setAnchoring(true)
    setMessage(null)
    setError(null)
    try {
      const currentProof = proof ?? await loadProof()
      if (!currentProof) throw new Error('Reasoning trace proof is not ready.')
      if (chainId !== arcChain.id) await switchChainAsync({ chainId: arcChain.id })
      const sender = address as HexAddress
      const client = walletClient as TypedDataWalletClient | null | undefined
      if (!client?.sendTransaction) throw new Error('Wallet client is not ready for Arc transactions. Switch to Arc Testnet and retry.')
      const txHash = await client.sendTransaction({
        account: sender,
        to: sender,
        value: 0n,
        data: currentProof.calldata as HexString,
      })
      const completed = await completeArcProof(auth.accessToken, scriptId, {
        txHash: String(txHash),
        chainId: arcChain.id,
        fromAddress: sender,
        traceHash: currentProof.traceHash,
        calldata: currentProof.calldata,
      })
      setProof(completed)
      setMessage('Reasoning trace anchored to Arc Testnet.')
      if (chainId === supportedChain.id) switchChainAsync({ chainId: supportedChain.id }).catch(() => undefined)
    } catch (anchorError) {
      setError(errorMessage(anchorError))
    } finally {
      setAnchoring(false)
    }
  }, [address, auth.accessToken, auth.walletAddress, chainId, loadProof, proof, scriptId, switchChainAsync, walletClient])

  const verifyProof = useCallback(async () => {
    if (!proof?.anchor) {
      setError('Anchor this reasoning trace before verification.')
      return
    }
    setVerifying(true)
    setError(null)
    setMessage(null)
    try {
      const latestProof = auth.accessToken && scriptId ? await fetchArcProof(auth.accessToken, scriptId) : proof
      setProof(latestProof)
      if (!latestProof.anchor) throw new Error('No Arc anchor found for this reasoning trace.')
      if (latestProof.anchor.traceHash.toLowerCase() !== latestProof.traceHash.toLowerCase()) {
        throw new Error('Local reasoning trace hash does not match the anchored hash.')
      }
      const verified = await verifyArcProofTransaction(latestProof.anchor, latestProof.calldata)
      if (!verified) throw new Error('Arc transaction calldata does not match this reasoning trace hash.')
      setMessage('Verified: this reasoning trace matches the Arc transaction calldata.')
    } catch (verifyError) {
      setError(errorMessage(verifyError))
    } finally {
      setVerifying(false)
    }
  }, [auth.accessToken, proof, scriptId])

  const txUrl = proof?.anchor?.arcscanUrl || arcTxUrl(proof?.anchor?.txHash)

  return (
    <Card className="arc-proof-card">
      <SectionHeader title="Arc Proof" note={proof?.anchor ? 'Reasoning trace anchored' : 'Optional audit record'} />
      <p className="body-copy">
        Anchor the original AI reasoning trace to Arc Testnet. Polymarket trading stays on Polygon; Arc only records an audit hash.
      </p>
      <div className="arc-proof-grid">
        <div>
          <span>Trace hash</span>
          <b>{proof?.traceHash ? shortAddress(proof.traceHash) : loading ? 'Loading...' : 'Not ready'}</b>
        </div>
        <div>
          <span>Chain</span>
          <b>{arcChain.name}</b>
        </div>
        <div>
          <span>Anchor</span>
          <b>{proof?.anchor ? shortAddress(proof.anchor.txHash) : 'Not anchored'}</b>
        </div>
      </div>
      {proof?.anchor ? (
        <div className="soft-note">Anchored at {formatDateTime(proof.anchor.anchoredAt)} by {shortAddress(proof.anchor.fromAddress)}.</div>
      ) : null}
      {message ? <div className="soft-note success">{message}</div> : null}
      {error ? <div className="script-list-message error">{error}</div> : null}
      <div className="footer-actions">
        <button className="primary-button" type="button" disabled={!scriptId || loading || anchoring} onClick={() => void anchorProof()}>
          <ShieldCheck size={17} /> {anchoring ? 'Anchoring...' : proof?.anchor ? 'Anchor again' : 'Anchor to Arc'}
        </button>
        <button className="outline-button" type="button" disabled={!proof?.anchor || verifying} onClick={() => void verifyProof()}>
          <CheckCircle2 size={17} /> {verifying ? 'Verifying...' : 'Verify'}
        </button>
        {txUrl ? (
          <a className="outline-button" href={txUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={17} /> ArcScan
          </a>
        ) : null}
      </div>
    </Card>
  )
}

function ScriptOrderPanel({
  auth,
  result,
  selectedSelectionIds,
}: {
  auth: CausewayAuth
  result: InferenceResult | null
  selectedSelectionIds: string[]
}) {
  const candidates = useMemo(() => result?.orderCandidates ?? [], [result?.orderCandidates])
  const scriptId = result?.scriptId ?? null
  const draftSeedKey = useMemo(() => orderDraftsKey(candidates), [candidates])
  const selectedSelectionKey = selectedSelectionIds.join('|')
  return (
    <ScriptOrderPanelState
      key={`${scriptId || 'no-script'}:${draftSeedKey}:${selectedSelectionKey}`}
      auth={auth}
      candidates={candidates}
      selectedSelectionIds={selectedSelectionIds}
      scriptId={scriptId}
    />
  )
}

function ScriptOrderPanelState({
  auth,
  candidates,
  selectedSelectionIds,
  scriptId,
}: {
  auth: CausewayAuth
  candidates: ScriptOrderCandidate[]
  selectedSelectionIds: string[]
  scriptId: string | null
}) {
  const { signTypedDataAsync } = useSignTypedData()
  const { signMessageAsync } = useSignMessage()
  const { data: walletClient } = useWalletClient({ chainId: supportedChain.id })
  const { addActivity, updateActivity } = useTradingWalletActivity()
  const executionMode: OrderExecutionMode = 'real'
  const tradingAccountType: TradingAccountType = 'auto'
  const [drafts, setDrafts] = useState<OrderDraftSelection[]>(() => buildDefaultOrderDrafts(candidates, selectedSelectionIds))
  const [preview, setPreview] = useState<OrderPreview | null>(null)
  const [pendingSubmitPreview, setPendingSubmitPreview] = useState<OrderPreview | null>(null)
  const [submitResult, setSubmitResult] = useState<OrderSubmitResult | null>(null)
  const [status, setStatus] = useState<OrderSubmissionStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const activeDrafts = useMemo(() => drafts.filter((draft) => draft.enabled), [drafts])
  const draftBySelectionId = useMemo(() => new Map(drafts.map((draft) => [draft.selectionId, draft])), [drafts])
  const currentIntentId = submitResult?.intentId ?? preview?.intentId ?? null
  const totalDraftAmount = useMemo(
    () => activeDrafts.reduce((sum, draft) => sum + (draft.sizingMode === 'amountUsd' ? positiveNumberOrNull(draft.amountUsd) ?? 0 : 0), 0),
    [activeDrafts],
  )
  const estimatedRequiredUsd = useMemo(
    () => activeDrafts.reduce((sum, draft) => sum + (estimateDraftAmountUsd(draft) ?? 0), 0),
    [activeDrafts],
  )
  const busy = status !== 'idle'

  const updateDraft = useCallback((selectionId: string, patch: Partial<OrderDraftSelection>) => {
    setDrafts((current) => current.map((draft) => (draft.selectionId === selectionId ? { ...draft, ...patch } : draft)))
    setPreview(null)
    setPendingSubmitPreview(null)
    setSubmitResult(null)
  }, [])

  const setDraftOrderMode = useCallback((draft: OrderDraftSelection, orderMode: OrderMode) => {
    updateDraft(draft.selectionId, {
      orderMode,
      limitPrice: orderMode === 'limit' ? defaultLimitPrice(draft.limitPrice ?? draft.price, draftTickSize(draft)) : null,
      orderType: 'GTC',
    })
  }, [updateDraft])

  const setDraftSizingMode = useCallback((draft: OrderDraftSelection, sizingMode: OrderSizingMode) => {
    if (sizingMode === 'size') {
      const price = positiveNumberOrNull(draft.limitPrice) ?? 0.5
      const fallbackSize = positiveNumberOrNull(draft.size) ?? roundDraftSize((positiveNumberOrNull(draft.amountUsd) ?? 10) / price)
      updateDraft(draft.selectionId, { sizingMode, size: fallbackSize })
      return
    }
    const price = positiveNumberOrNull(draft.limitPrice) ?? 0.5
    const fallbackAmount = positiveNumberOrNull(draft.amountUsd) ?? roundDraftAmount((positiveNumberOrNull(draft.size) ?? 1) * price)
    updateDraft(draft.selectionId, { sizingMode, amountUsd: fallbackAmount })
  }, [updateDraft])

  const adjustDraftSizing = useCallback((draft: OrderDraftSelection, delta: number) => {
    if (draft.sizingMode === 'size') {
      updateDraft(draft.selectionId, { size: roundDraftSize((positiveNumberOrNull(draft.size) ?? 0) + delta) })
      return
    }
    updateDraft(draft.selectionId, { amountUsd: roundDraftAmount((positiveNumberOrNull(draft.amountUsd) ?? 0) + delta) })
  }, [updateDraft])

  const adjustLimitPrice = useCallback((draft: OrderDraftSelection, tickSteps: number) => {
    const tickSize = draftTickSize(draft)
    updateDraft(draft.selectionId, { limitPrice: roundDraftPrice((positiveNumberOrNull(draft.limitPrice) ?? 0.5) + tickSize * tickSteps, tickSize) })
  }, [updateDraft])

  const validateDrafts = useCallback(() => {
    if (!scriptId) return copy('Current script is missing scriptId. Complete an AI inference run first.')
    if (!activeDrafts.length) return copy('Select at least one outcome to buy.')
    for (const draft of activeDrafts) {
      if (!draft.isTradable) {
        return copy(
          `${orderDraftContextLabel(draft)} ${draft.marketStatus || 'Market is temporarily not tradable'}. Remove it from the script or wait for data refresh.`,
        )
      }
      const sizingValue = draft.sizingMode === 'size' ? positiveNumberOrNull(draft.size) : positiveNumberOrNull(draft.amountUsd)
      if (sizingValue == null) return copy(
        `${draft.outcomeLabel} is missing a valid ${draft.sizingMode === 'size' ? 'size' : 'amount'}.`,
      )
      const minOrderSize = positiveNumberOrNull(draft.minOrderSize)
      const estimatedSize = estimateDraftSize(draft)
      if (minOrderSize != null && estimatedSize != null && estimatedSize + 1e-9 < minOrderSize) {
        return copy(
          `${draft.outcomeLabel} is below the minimum order size ${formatShares(minOrderSize)} shares (current ${formatShares(estimatedSize)} shares).`,
        )
      }
      if (draft.orderMode === 'limit' && positiveNumberOrNull(draft.limitPrice) == null) {
        return copy(`${draft.outcomeLabel} is missing a valid limit price.`)
      }
    }
    return null
  }, [activeDrafts, scriptId])

  const ensureAuthToken = useCallback(async () => {
    if (!auth.isAuthenticated) {
      await auth.signIn()
    }
    const session = readStoredAuthSession()
    const token = session?.accessToken ?? auth.accessToken
    if (!token) {
      throw new Error(copy('Wallet authentication is not complete. Connect and sign in with your wallet first.'))
    }
    return { token, session }
  }, [auth])

  const buildPreview = useCallback(async () => {
    const validationError = validateDrafts()
    if (validationError) {
      setError(validationError)
      return null
    }
    if (!scriptId) return null

    setError(null)
    setSubmitResult(null)
    try {
      const { token } = await ensureAuthToken()
      setStatus('saving')
      await Promise.all(drafts.map((draft) => patchScriptSelection(scriptId, draft, token)))
      setStatus('previewing')
      const nextPreview = await createOrderPreview(scriptId, executionMode, activeDrafts, token, tradingAccountType)
      setPreview(nextPreview)
      return nextPreview
    } catch (orderError) {
      setError(errorMessage(orderError))
      return null
    } finally {
      setStatus('idle')
    }
  }, [activeDrafts, drafts, ensureAuthToken, executionMode, scriptId, tradingAccountType, validateDrafts])

  const handlePreview = useCallback(async () => {
    await buildPreview()
  }, [buildPreview])

  const ensureDepositWalletFunded = useCallback(async (token: string, initial: TradingReadiness, requiredAmountUsd?: number) => {
    const requiredUsd = Math.max(positiveNumberOrNull(requiredAmountUsd) ?? positiveNumberOrNull(estimatedRequiredUsd) ?? 0, TRADING_WALLET_MIN_READY_USD)
    if (depositWalletReadyForAmount(initial, requiredUsd)) return initial
    return prepareTradingWalletForRealOrders({
      token,
      requiredUsd,
      walletAddress: readStoredAuthSession()?.walletAddress ?? auth.walletAddress,
      tradingAccountType,
      signTypedDataAsync,
      signMessageAsync,
      walletClient: walletClient as TypedDataWalletClient | null | undefined,
      onActivity: addActivity,
      updateActivity,
    })
  }, [addActivity, auth.walletAddress, estimatedRequiredUsd, signMessageAsync, signTypedDataAsync, tradingAccountType, updateActivity, walletClient])

  const ensureRealTradingReady = useCallback(async (token: string, requiredAmountUsd?: number) => {
    let changed = false
    setStatus('checking')
    let readiness = await fetchTradingReadiness(token, tradingAccountType)
    if (!readiness.clobApiKeyConfigured) {
      changed = true
      setStatus('signing')
      const authPayload = await prepareClobAuth(token)
      const signature = await signTypedDataWithFallback({
        variables: typedDataToSignVariables(authPayload.eip712),
        walletAddress: authPayload.walletAddress,
        signTypedDataAsync,
        walletClient: walletClient as TypedDataWalletClient | null | undefined,
      })
      await completeClobAuth(token, authPayload, signature)
      readiness = await fetchTradingReadiness(token, tradingAccountType)
    }
    if (readiness.tradingAccountType === 'deposit_wallet' && !readiness.depositWalletDeployed) {
      changed = true
      readiness = await ensureDepositWallet(token)
      readiness = await waitForDepositWalletReadiness(token, readiness, tradingAccountType)
    }
    if (readiness.status === 'deposit_wallet_pending') {
      throw new Error(readiness.reason || 'Polymarket deposit wallet is being created. Please retry after it is confirmed.')
    }
    const fundedReadiness = await ensureDepositWalletFunded(token, readiness, requiredAmountUsd)
    changed = changed || fundedReadiness !== readiness
    readiness = fundedReadiness
    if (!readiness.canTrade) {
      throw new Error(normalizeTradingCapabilityReason(readiness.reason) || readiness.steps[0]?.message || 'Polymarket trading is not ready for this wallet.')
    }
    return { readiness, changed }
  }, [ensureDepositWalletFunded, signTypedDataAsync, tradingAccountType, walletClient])

  const submitConfirmedPreview = useCallback(async (initialPreview: OrderPreview) => {
    let nextPreview = initialPreview
    setPendingSubmitPreview(null)

    if (nextPreview.executionMode === 'real') {
      try {
        const { token } = await ensureAuthToken()
        const readinessResult = await ensureRealTradingReady(token, nextPreview.totalAmountUsd)
        if (readinessResult.changed) {
          setPreview(null)
          const readyPreview = await buildPreview()
          if (!readyPreview) return
          nextPreview = readyPreview
        }
      } catch (readinessError) {
        setError(errorMessage(readinessError))
        setStatus('idle')
        return
      }
      if (!nextPreview.orders.every((order) => order.valid)) {
        setError(invalidOrderPreviewMessage(nextPreview) || copy('The preview contains invalid orders. Correct amount, size, limit price, or market status.'))
        return
      }
      if (nextPreview.submitMode !== 'signed_clob_order' || !nextPreview.requiresSignature) {
        setError(orderPreviewUnavailableReason(nextPreview))
        return
      }
    }

    let orderActivityId: string | null = null
    try {
      const { token, session } = await ensureAuthToken()
      let signedOrders: { orderId: string; signature: string }[] = []
      if (nextPreview.executionMode === 'real') {
        const walletAddress = session?.walletAddress ?? auth.walletAddress
        const chainId = session?.chainId ?? auth.chainId ?? supportedChain.id
        if (!walletAddress) throw new Error(copy('Order submission is missing an authenticated wallet address.'))
        orderActivityId = addActivity(copy('Submit order'), copy(`Waiting for wallet signature for ${nextPreview.orders.length} Polymarket order(s).`), 'pending')
        setStatus('preparing_signature')
        const prepared = await prepareOrderSignatures(nextPreview, walletAddress, chainId, token)
        orderDebugLog('prepare_order_signatures_result', {
          intentId: prepared.intentId,
          signingStatus: prepared.signingStatus,
          payloadCount: prepared.payloads.length,
          previewOrderCount: nextPreview.orders.length,
          payloads: prepared.payloads.map((payload) => ({
            orderId: payload.orderId,
            primaryType: payload.eip712.primaryType,
            signatureType: payload.signatureType,
            signerAddress: shortAddress(payload.signerAddress),
            makerAddress: shortAddress(payload.makerAddress),
          })),
        })
        if (prepared.signingStatus !== 'ready') {
          throw new Error(prepared.error || copy('Order signing payload is not available yet.'))
        }
        setStatus('signing')
        const rawSignedOrders = await Promise.all(prepared.payloads.map(async (payload) => ({
          orderId: payload.orderId,
          signature: await signTypedDataWithFallback({
            variables: toSignTypedDataVariables(payload),
            walletAddress,
            signTypedDataAsync,
            walletClient: walletClient as TypedDataWalletClient | null | undefined,
          }),
        })))
        orderDebugLog('raw_signed_orders_result', {
          signedOrdersCount: rawSignedOrders.length,
          signedOrders: rawSignedOrders.map((order) => ({
            orderId: order.orderId,
            signatureShape: signatureValueShape(order.signature),
            normalizedLength: normalizeSignatureValue(order.signature).length,
            valid: isHexSignature(normalizeSignatureValue(order.signature)),
          })),
        })
        signedOrders = validatedSignedOrdersForSubmit(nextPreview, rawSignedOrders)
        updateActivity(orderActivityId, 'pending', copy('Order signature complete. Submitting to Polymarket.'))
      }
      setStatus('submitting')
      const submitted = await submitOrderIntent(nextPreview, signedOrders, token)
      setSubmitResult(submitted)
      if (nextPreview.executionMode === 'real') {
        window.dispatchEvent(new CustomEvent('causeway:orders-changed'))
      }
      if (nextPreview.executionMode === 'real' && orderActivityId) {
        updateActivity(orderActivityId, 'done', copy(`${submitted.orders.length} order(s) submitted.`))
      }
    } catch (submitError) {
      if (orderActivityId) {
        updateActivity(orderActivityId, 'error', errorMessage(submitError))
      }
      orderDebugLog('order_submit_error', {
        message: errorMessage(submitError),
      })
      setError(errorMessage(submitError))
    } finally {
      setStatus('idle')
    }
  }, [addActivity, auth.chainId, auth.walletAddress, buildPreview, ensureAuthToken, ensureRealTradingReady, signTypedDataAsync, updateActivity, walletClient])

  const handleSubmit = useCallback(async () => {
    const nextPreview = executionMode === 'real' ? await buildPreview() : preview ?? await buildPreview()
    if (!nextPreview) return
    if (!nextPreview.orders.every((order) => order.valid)) {
      setError(invalidOrderPreviewMessage(nextPreview) || copy('The preview contains invalid orders. Correct amount, size, limit price, or market status.'))
      return
    }

    if (nextPreview.executionMode === 'real') {
      if (nextPreview.submitMode !== 'signed_clob_order' || !nextPreview.requiresSignature) {
        setError(orderPreviewUnavailableReason(nextPreview))
        return
      }
      setPendingSubmitPreview(nextPreview)
      return
    }

    await submitConfirmedPreview(nextPreview)
  }, [buildPreview, executionMode, preview, submitConfirmedPreview])

  const refreshIntent = useCallback(async () => {
    if (!currentIntentId) return
    setError(null)
    try {
      const { token } = await ensureAuthToken()
      setStatus('previewing')
      const detail = await getOrderIntent(currentIntentId, token)
      setPreview(detail.preview)
      setSubmitResult(detail.submitResult)
    } catch (refreshError) {
      setError(errorMessage(refreshError))
    } finally {
      setStatus('idle')
    }
  }, [currentIntentId, ensureAuthToken])

  const statusLabel = {
    idle: '',
    saving: copy('Saving script selections...'),
    previewing: copy('Generating order preview...'),
    checking: copy('Checking trading wallet readiness...'),
    preparing_signature: copy('Preparing wallet signature payload...'),
    signing: copy('Wallet signature prompt is opening...'),
    submitting: copy('Submitting orders...'),
  }[status]

  return (
    <Card className="script-order-panel" id="script-order-panel">
      <div className="order-panel-head">
        <SectionHeader
          title={copy('Order Draft')}
          note={scriptId ? copy(`${activeDrafts.length} outcome(s) selected`) : copy('Backend script selectionId required')}
        />
      </div>

      {!candidates.length ? (
        <div className="soft-note">{copy('This page has no tradable selections yet. Generate a backend AI script first, then return here to preview and submit orders.')}</div>
      ) : (
        <>
          <div className="order-panel-summary">
            <span><WalletCards size={16} /> {copy(`Wallet: ${auth.walletAddress ? shortAddress(auth.walletAddress) : 'Not signed in'}`)}</span>
            <span><ShieldCheck size={16} /> {copy('Wallet confirmation required before submission')}</span>
            <span><Activity size={16} /> {copy(`Draft amount: ${totalDraftAmount > 0 ? formatUsd(totalDraftAmount) : 'estimated from size'}`)}</span>
          </div>

          <div className="trading-wallet-card">
            <div className="trading-wallet-card-title">
              <WalletCards size={18} />
              <div>
                <span>{copy('Trading Wallet')}</span>
                <small>{copy('Orders use your Polymarket trading wallet. Existing Polymarket balance can be used as a funding source.')}</small>
              </div>
            </div>
            <div className="trading-wallet-card-metrics">
              <div><span>{copy('Estimated Required')}</span><b>{formatUsd(Math.max(estimatedRequiredUsd, TRADING_WALLET_MIN_READY_USD))}</b></div>
              <div><span>{copy('Minimum Ready')}</span><b>{formatUsd(TRADING_WALLET_MIN_READY_USD)}</b></div>
              <div><span>{copy('Setup Entry')}</span><b>{copy('Top + Deposit')}</b></div>
            </div>
          </div>

          <div className="order-draft-list">
            {drafts.map((draft) => (
              <div className={[draft.enabled ? 'enabled' : '', !draft.isTradable ? 'disabled-market' : '', 'order-draft-row'].filter(Boolean).join(' ')} key={draft.selectionId}>
                <label className="order-draft-toggle">
                  <input
                    checked={draft.enabled}
                    disabled={!draft.isTradable}
                    onChange={(event) => updateDraft(draft.selectionId, { enabled: event.target.checked })}
                    type="checkbox"
                  />
                  <span>{!draft.isTradable ? copy('Not tradable') : draft.enabled ? copy('Buy') : copy('Skip')}</span>
                </label>
                <div className="order-draft-main">
                  <b>{draft.marketTitle}</b>
                  <small>{[draft.eventTitle, draft.outcomeLabel, draft.aiAction === 'buy' ? copy('AI recommends') : copy('AI avoids'), formatConfidence(draft.confidence), draft.marketStatus].filter(Boolean).join(' · ')}</small>
                  <p>{draft.reason || copy('No recommendation reason available.')}</p>
                </div>
                <div className="order-draft-controls">
                  <div className="order-toggle-group">
                    <button className={draft.orderMode === 'market' ? 'active' : ''} disabled={!draft.enabled || !draft.isTradable} type="button" onClick={() => setDraftOrderMode(draft, 'market')}>
                      {copy('Market')}
                    </button>
                    <button className={draft.orderMode === 'limit' ? 'active' : ''} disabled={!draft.enabled || !draft.isTradable} type="button" onClick={() => setDraftOrderMode(draft, 'limit')}>
                      {copy('Limit')}
                    </button>
                  </div>
                  <label>
                    <span>{copy('Sizing Type')}</span>
                    <select disabled={!draft.enabled || !draft.isTradable} value={draft.sizingMode} onChange={(event) => setDraftSizingMode(draft, event.target.value as OrderSizingMode)}>
                      <option value="amountUsd">{copy('Amount USD')}</option>
                      <option value="size">{copy('Size Shares')}</option>
                    </select>
                  </label>
                  <label>
                    <span>{draft.sizingMode === 'size' ? copy('Size') : copy('Amount')}</span>
                    <input
                      disabled={!draft.enabled || !draft.isTradable}
                      min={draft.sizingMode === 'size' ? '0.000001' : '0.01'}
                      step={draft.sizingMode === 'size' ? '0.000001' : '0.01'}
                      type="number"
                      value={draft.sizingMode === 'size' ? draft.size ?? '' : draft.amountUsd ?? ''}
                      onChange={(event) => {
                        const parsed = parseDraftNumber(event.target.value)
                        updateDraft(draft.selectionId, draft.sizingMode === 'size' ? { size: parsed } : { amountUsd: parsed })
                      }}
                    />
                  </label>
                  <div className="order-step-row" aria-label={copy('Adjust amount or size')}>
                    {[-100, -10, 10, 100].map((delta) => (
                        <button disabled={!draft.enabled || !draft.isTradable} key={delta} type="button" onClick={() => adjustDraftSizing(draft, delta)}>
                        {delta > 0 ? `+${delta}` : delta}
                      </button>
                    ))}
                  </div>
                  {draft.orderMode === 'limit' ? (
                    <label>
                      <span>{copy('Limit Price')}</span>
                      <div className="order-price-input">
                        <button disabled={!draft.enabled || !draft.isTradable} type="button" onClick={() => adjustLimitPrice(draft, -1)}>-</button>
                        <input
                          disabled={!draft.enabled || !draft.isTradable}
                          max="1"
                          min="0.0001"
                          step={draftTickSize(draft)}
                          type="number"
                          value={draft.limitPrice ?? ''}
                          onChange={(event) => {
                            const parsed = parseDraftNumber(event.target.value)
                            updateDraft(draft.selectionId, { limitPrice: parsed == null ? null : roundDraftPrice(parsed, draftTickSize(draft)) })
                          }}
                        />
                        <button disabled={!draft.enabled || !draft.isTradable} type="button" onClick={() => adjustLimitPrice(draft, 1)}>+</button>
                      </div>
                    </label>
                  ) : null}
                  {draft.orderMode === 'limit' ? (
                    <label>
                      <span>{copy('Order Type')}</span>
                      <select disabled={!draft.enabled || !draft.isTradable} value={draft.orderType} onChange={(event) => updateDraft(draft.selectionId, { orderType: event.target.value as LimitOrderType })}>
                        <option value="GTC">GTC</option>
                        <option value="GTD">GTD</option>
                        <option value="FOK">FOK</option>
                        <option value="FAK">FAK</option>
                      </select>
                    </label>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="order-panel-actions">
            <button className="outline-button" disabled={busy || !activeDrafts.length} type="button" onClick={handlePreview}>
              {copy('Generate Preview')}
            </button>
            <button className="primary-button" disabled={busy || !activeDrafts.length} type="button" onClick={handleSubmit}>
              {copy('Sign and Submit')}
            </button>
            {currentIntentId ? (
              <button className="outline-button" disabled={busy} type="button" onClick={() => void refreshIntent()}>
                Refresh intent
              </button>
            ) : null}
            {statusLabel ? <span className="order-status-text">{statusLabel}</span> : null}
          </div>
        </>
      )}

      {error ? <div className="status-note error">{error}</div> : null}
      {preview ? <OrderPreviewBlock draftBySelectionId={draftBySelectionId} preview={preview} /> : null}
      {submitResult ? <OrderSubmitBlock result={submitResult} /> : null}
      {pendingSubmitPreview ? (
        <OrderConfirmDialog
          busy={busy}
          preview={pendingSubmitPreview}
          onCancel={() => setPendingSubmitPreview(null)}
          onConfirm={() => void submitConfirmedPreview(pendingSubmitPreview)}
        />
      ) : null}
    </Card>
  )
}

function OrderPreviewBlock({ draftBySelectionId, preview }: { draftBySelectionId: Map<string, OrderDraftSelection>; preview: OrderPreview }) {
  return (
    <div className="order-preview-block">
      <div className="order-preview-metrics">
        <div><span>{copy('Total Amount')}</span><b>{formatUsd(preview.totalAmountUsd)}</b></div>
        <div><span>{copy('Max Payout Shares')}</span><b>{formatShares(preview.estimatedMaxPayout)}</b></div>
        <div><span>{copy('Max Loss')}</span><b>{formatUsd(preview.estimatedMaxLoss)}</b></div>
        <div><span>{copy('Signature')}</span><b>{preview.requiresSignature ? copy('Required') : copy('Not required')}</b></div>
      </div>
      <div className={preview.submitMode === 'unavailable' ? 'status-note warning' : 'status-note'}>
        {orderPreviewStatusText(preview)}
      </div>
      <div className="order-preview-list">
        {preview.orders.map((order) => {
          const draft = draftBySelectionId.get(order.selectionId)
          const statusText = order.valid ? orderPreviewWarningText(order.warnings) : orderPreviewErrorText(order, draft)
          return (
            <div className={order.valid ? 'order-preview-row' : 'order-preview-row invalid'} key={order.selectionId}>
              <div>
                <b>{draft?.marketTitle || order.marketId}</b>
                {draft?.eventTitle ? <small>{draft.eventTitle}</small> : null}
                <span>{order.outcomeLabel} · {order.orderMode === 'market' ? copy('Market') : copy(`Limit ${formatLimitPrice(order.limitPrice)}`)}</span>
              </div>
              <strong>{formatUsd(order.amountUsd)}</strong>
              <span>{formatShares(order.size)} shares</span>
              <em>{statusText}</em>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OrderConfirmDialog({
  busy,
  onCancel,
  onConfirm,
  preview,
}: {
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
  preview: OrderPreview
}) {
  return (
    <BodyPortal>
      <div className="wallet-modal-backdrop order-confirm-backdrop" role="presentation" onMouseDown={() => !busy && onCancel()}>
        <div className="wallet-modal order-confirm-modal" role="dialog" aria-modal="true" aria-label="Confirm Polymarket order" onMouseDown={(event) => event.stopPropagation()}>
          <div className="wallet-modal-head">
            <div>
              <span><ShieldCheck size={18} /> {copy('Confirm Polymarket Order')}</span>
              <small>{copy('Review the final preview before Causeway opens your wallet signature prompt.')}</small>
            </div>
            <button className="modal-close-button" type="button" disabled={busy} onClick={onCancel}>
              <X size={18} />
            </button>
          </div>
          <div className="order-confirm-summary">
            <div><span>{copy('Max Spend')}</span><b>{formatUsd(preview.totalAmountUsd)}</b></div>
            <div><span>{copy('Orders')}</span><b>{preview.orders.length}</b></div>
            <div><span>{copy('Trading Wallet')}</span><b>{preview.tradingAccountLabel ?? preview.tradingAccountType ?? copy('Auto')}</b></div>
          </div>
          <div className="order-confirm-list">
            {preview.orders.slice(0, 6).map((order, index) => (
              <div className="order-confirm-row" key={order.selectionId}>
                <span>{index + 1}</span>
                <div>
                  <b>{order.outcomeLabel || copy('Outcome')}</b>
                  <small>{order.orderMode === 'market' ? copy('Market order') : copy(`Limit ${formatLimitPrice(order.limitPrice)}`)} / {formatShares(order.size)} shares</small>
                </div>
                <strong>{formatUsd(order.amountUsd)}</strong>
              </div>
            ))}
            {preview.orders.length > 6 ? <small className="order-confirm-extra">+{preview.orders.length - 6} more order(s)</small> : null}
          </div>
          <div className="soft-note">
            <Info size={16} />
            {copy('Canceling here will not submit an order. Confirming will prepare the signature payload and open your wallet.')}
          </div>
          <div className="order-confirm-actions">
            <button className="outline-button" type="button" disabled={busy} onClick={onCancel}>{copy('Cancel')}</button>
            <button className="primary-button" type="button" disabled={busy} onClick={onConfirm}>
              <Play size={16} /> {busy ? copy('Preparing...') : copy('Confirm and Sign')}
            </button>
          </div>
        </div>
      </div>
    </BodyPortal>
  )
}

function orderPreviewStatusText(preview: OrderPreview) {
  if (preview.submitMode === 'unavailable') {
    return orderPreviewUnavailableReason(preview)
  }
  const signatureText = preview.requiresSignature ? copy('Wallet signature required before submission') : copy('No wallet signature required before submission')
  return copy(`${signatureText}. Preview valid until ${formatDateTime(preview.expiresAt)}`)
}

function orderPreviewUnavailableReason(preview: OrderPreview) {
  return normalizeTradingCapabilityReason(preview.tradingCapabilityReason)
    || copy('This order cannot be submitted right now. Refresh market data and try again.')
}

function OrderSubmitBlock({ result }: { result: OrderSubmitResult }) {
  return (
    <div className={`order-submit-block ${result.status}`}>
      <div>
        <b>{orderSubmitTitle(result)}</b>
        <span>{orderSubmitSubtitle(result)}</span>
      </div>
      <div className="order-submit-list">
        {result.orders.map((order) => (
          <span key={order.orderId}>
            {orderSubmitOrderLine(order)}
          </span>
        ))}
      </div>
    </div>
  )
}

function orderSubmitTitle(result: OrderSubmitResult) {
  if (result.status === 'dry_run_completed') return 'Order saved'
  if (result.status === 'submitted') return 'Order submitted to Polymarket'
  if (result.status === 'partially_submitted') return 'Some orders were submitted'
  if (result.status === 'unknown') return 'Submission status is being verified'
  return 'Order submission failed'
}

function orderSubmitSubtitle(result: OrderSubmitResult) {
  if (result.status === 'unknown') return 'Refresh open orders before submitting the same order again.'
  if (result.status === 'failed') return 'No successful Polymarket order was confirmed.'
  return `Reference: ${shortAddress(result.intentId)}`
}

function orderSubmitOrderLine(order: OrderSubmitResult['orders'][number]) {
  const orderId = order.externalOrderId ? shortAddress(order.externalOrderId) : shortAddress(order.orderId)
  const status = order.status === 'submitted' ? 'submitted' : order.status
  return `${orderId}: ${status}${order.errorMessage ? ` - ${order.errorMessage}` : ''}`
}

function MyScripts({
  auth,
  onNew,
  onOpen,
  settings,
}: {
  auth: CausewayAuth
  onNew: () => void
  onOpen: (market: Market, result: InferenceResult) => void
  settings: InferenceSettingsState
}) {
  const [items, setItems] = useState<BackendScriptListItem[]>([])
  const [itemsAccessToken, setItemsAccessToken] = useState<string | null>(null)
  const [itemsStatusFilter, setItemsStatusFilter] = useState<ScriptStatusFilter>('all')
  const [itemsQuery, setItemsQuery] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ScriptStatusFilter>('all')
  const [openingScriptId, setOpeningScriptId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (!auth.accessToken) return

    const controller = new AbortController()
    const requestToken = auth.accessToken
    const requestStatus = statusFilter
    const requestQuery = debouncedQuery
    queueMicrotask(() => {
      if (controller.signal.aborted) return
      setItems([])
      setNextCursor(null)
      setItemsAccessToken(requestToken)
      setItemsStatusFilter(requestStatus)
      setItemsQuery(requestQuery)
      setLoading(true)
      setError(null)
    })
    fetchUserScripts(requestToken, controller.signal, null, requestStatus, requestQuery)
      .then((data) => {
        setItems(data.items)
        setNextCursor(data.nextCursor)
        setItemsAccessToken(requestToken)
        setItemsStatusFilter(requestStatus)
        setItemsQuery(requestQuery)
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(loadError instanceof Error ? loadError.message : copy('Script list failed to load.'))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [auth.accessToken, debouncedQuery, statusFilter])

  const filteredItems = useMemo(() => {
    return auth.isAuthenticated
      && itemsAccessToken === auth.accessToken
      && itemsStatusFilter === statusFilter
      && itemsQuery === debouncedQuery
      ? items
      : []
  }, [auth.accessToken, auth.isAuthenticated, debouncedQuery, items, itemsAccessToken, itemsQuery, itemsStatusFilter, statusFilter])

  const stats = useMemo(() => {
    const visibleItems = auth.isAuthenticated
      && itemsAccessToken === auth.accessToken
      && itemsStatusFilter === statusFilter
      && itemsQuery === debouncedQuery
      ? items
      : []
    const drafts = visibleItems.filter((item) => item.status === 'draft').length
    const active = visibleItems.filter((item) => item.status === 'active').length
    const archived = visibleItems.filter((item) => item.status === 'archived').length
    const orderIntents = visibleItems.reduce((total, item) => total + item.orderIntentCount, 0)
    return [
      [copy('Scripts'), String(visibleItems.length), copy('Real backend records'), 'blue', <Star size={19} />],
      [copy('Drafts'), String(drafts), copy('Orders can still be adjusted'), 'orange', <Play size={19} />],
      [copy('Submitted'), String(active), copy('Order flow completed'), 'green', <CheckCircle2 size={19} />],
      [statusFilter === 'archived' ? copy('Archived') : copy('Order Intents'), String(statusFilter === 'archived' ? archived : orderIntents), statusFilter === 'archived' ? copy('Historical scripts') : copy('Generated by scripts'), 'purple', <ExternalLink size={19} />],
    ] as const
  }, [auth.accessToken, auth.isAuthenticated, debouncedQuery, items, itemsAccessToken, itemsQuery, itemsStatusFilter, statusFilter])

  const handleLoadMore = useCallback(async () => {
    if (!auth.accessToken || !nextCursor || loadingMore || itemsAccessToken !== auth.accessToken || itemsStatusFilter !== statusFilter || itemsQuery !== debouncedQuery) return
    const controller = new AbortController()
    setLoadingMore(true)
    setError(null)
    try {
      const data = await fetchUserScripts(auth.accessToken, controller.signal, nextCursor, statusFilter, debouncedQuery)
      setItems((current) => {
        const existingIds = new Set(current.map((item) => item.id))
        return [...current, ...data.items.filter((item) => !existingIds.has(item.id))]
      })
      setNextCursor(data.nextCursor)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy('More scripts failed to load.'))
    } finally {
      setLoadingMore(false)
    }
  }, [auth.accessToken, debouncedQuery, itemsAccessToken, itemsQuery, itemsStatusFilter, loadingMore, nextCursor, statusFilter])

  const handleOpen = useCallback(async (item: BackendScriptListItem) => {
    if (!auth.accessToken) {
      await auth.signIn()
      return
    }

    const controller = new AbortController()
    setOpeningScriptId(item.id)
    setError(null)
    try {
      const script = await fetchSavedScript(auth.accessToken, item.id, controller.signal)
      const market = scriptRootMarket(script, item)
      onOpen(market, scriptToInferenceResult(script, scriptCompletedRun(script), market, settings))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy('Script detail failed to load.'))
    } finally {
      setOpeningScriptId(null)
    }
  }, [auth, onOpen, settings])

  return (
    <section className="page">
      <div className="scripts-headline scripts-headline-actions">
        <button className="primary-button" type="button" onClick={onNew}>
          <Plus size={17} /> {copy('New Inference')}
        </button>
      </div>
      <div className="stats-row">
        {stats.map(([label, value, note, tone, icon]) => (
          <Card className="stat-card" key={label}>
            <span className={`stat-icon ${tone}`}>{icon}</span>
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
          {[
            ['all', copy('All')],
            ['draft', copy('Drafts')],
            ['active', copy('Submitted')],
            ['archived', copy('Archived')],
          ].map(([value, label]) => (
            <button
              className={statusFilter === value ? 'active' : ''}
              key={value}
              type="button"
              onClick={() => setStatusFilter(value as ScriptStatusFilter)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="searchbox narrow">
          <Search size={17} />
          <input
            aria-label={copy('Search scripts')}
            value={query}
            placeholder={copy('Search script names or keywords...')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <span className="scripts-sort-label">{copy('Newest first')}</span>
      </div>
      {auth.isAuthenticated && error ? <div className="script-list-message error">{error}</div> : null}
      {!auth.isAuthenticated ? (
        <div className="script-list-message">
          <b>{copy('Sign in to view your scripts')}</b>
          <span>{copy('No demo data is shown here. After wallet sign-in, the app loads saved backend scripts for the current user.')}</span>
          <button className="primary-button" type="button" onClick={() => void auth.signIn()} disabled={auth.isSigningIn}>
            <WalletCards size={17} /> {auth.isSigningIn ? copy('Waiting for signature') : copy('Sign in with wallet')}
          </button>
        </div>
      ) : null}
      <div className="script-list">
        {auth.isAuthenticated && loading ? <div className="script-list-message">{copy('Loading scripts from the backend...')}</div> : null}
        {auth.isAuthenticated && !loading && !filteredItems.length ? (
          <div className="script-list-message">
            <b>{query.trim() ? copy('No matching scripts') : copy('No scripts yet')}</b>
            <span>{query.trim() ? copy('Adjust your search keywords.') : copy('Generated scripts will appear here after you complete an AI inference.')}</span>
          </div>
        ) : null}
        {auth.isAuthenticated && !loading && filteredItems.map((item, index) => (
          <button
            className="script-row"
            key={item.id}
            type="button"
            onClick={() => void handleOpen(item)}
            disabled={openingScriptId === item.id}
          >
            <MarketIcon market={scriptListItemMarket(item, index)} size="small" />
            <div className="script-row-title">
              <b>{item.title}</b>
              {item.rootEventTitle ? <small>{item.rootEventTitle}</small> : null}
              <span>
                {copy(`Created: ${formatDateTime(item.createdAt)}`)}
                {item.rootOutcomeLabel ? copy(` · Root outcome: ${item.rootOutcomeLabel}`) : ''}
              </span>
            </div>
            <span className={`status-badge ${scriptStatusClass(item.status)}`}>{scriptStatusLabel(item.status)}</span>
            <div className="script-row-metrics">
              <span>{copy('Price')} <b>{formatUnitPercent(item.rootPrice)}</b></span>
              <span>24h <b>{formatCompactMoney(item.rootVolume24hr)}</b></span>
              <span>{copy('Markets')} <b>{item.marketCount}</b></span>
            </div>
            <span className="script-row-proof"><ShieldCheck size={15} /> Arc proof</span>
            <div className="row-actions">
              {openingScriptId === item.id ? <RotateCw size={18} /> : <ExternalLink size={18} />}
            </div>
          </button>
        ))}
      </div>
      {auth.isAuthenticated ? (
        <div className="pagination">
          <span>{copy(`${filteredItems.length} shown`)}</span>
          {itemsAccessToken === auth.accessToken && itemsStatusFilter === statusFilter && itemsQuery === debouncedQuery && nextCursor ? (
            <button type="button" onClick={() => void handleLoadMore()} disabled={loadingMore}>
              {loadingMore ? copy('Loading') : copy('More')}
            </button>
          ) : null}
        </div>
      ) : null}
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
        <span className="flow-node-kind">{market.nodeType === 'event' ? `${market.marketsCount ?? market.topMarkets?.length ?? 0} markets` : 'Market'}</span>
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
  const visibleMarkets = useMemo(() => graphMarkets.slice(0, MAX_FLOW_NODES), [graphMarkets])
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
      {loading ? <div className="network-loading">{copy('Syncing market network from Polymarket...')}</div> : null}
      {!loading && !visibleMarkets.length ? <div className="network-empty">{copy('No market network data yet')}</div> : null}
      <div className="legend">
        <span><i className="dot blue" />{copy('Politics')}</span>
        <span><i className="dot green" />{copy('Macro')}</span>
        <span><i className="dot orange" />{copy('Crypto')}</span>
        <span><i className="line solid" />{copy('Strong relation')}</span>
        <span><i className="line dashed" />{copy('Medium relation')}</span>
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
  const normalizedDirection = normalizeInferenceDirection(direction)
  if (normalizedDirection === 'negative') return 'red'
  if (normalizedDirection === 'conditional') return 'orange'
  if (normalizedDirection === 'unknown') return 'purple'
  if ((confidence || 0) < 0.35) return 'purple'
  return 'green'
}

function scriptSideTone(side: string | null | undefined) {
  const normalized = (side || '').toLowerCase()
  if (normalized.includes('no')) return 'red'
  if (normalized.includes('watch')) return 'muted'
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
        title: copy(`${directionLabel(link.direction)}: ${trimNodeTitle(target.title, 26)}`),
        summary: englishTextOrFallback(link.rationale || target.reason, copy('This book may reprice if the root outcome occurs.')),
        confidence: link.confidence,
        expectedReturnHint: copy('Confirm live depth and slippage before adding this direction to an order draft.'),
        legs: [{
          marketId: target.id,
          marketTitle: target.title,
          eventTitle: target.eventTitle ?? null,
          side: defaultOrderHintForDirection(link.direction),
          probability: target.price,
          direction: link.direction,
          impact: link.impact || inferenceImpactSummary(link.direction),
          confidence: link.confidence,
          rationale: englishTextOrFallback(link.rationale || target.reason || target.evidenceSummary, copy('AI verified that this market is related to the root node.')),
          orderHint: defaultOrderHintForDirection(link.direction),
          evidenceIds: link.evidenceIds || target.evidenceIds || [],
        }],
      }]
    })
  if (linkChains.length) return linkChains.slice(0, 4)
  const related = (result?.relatedMarkets || []).slice(0, 4)
  if (related.length) {
    return related.map((item, index) => ({
      id: `related_chain_${index + 1}`,
      title: copy(`Path ${index + 1}: ${trimNodeTitle(item.title, 28)}`),
      summary: englishTextOrFallback(item.reason || item.evidenceSummary, copy('This market passed relevance checks and can be monitored as a downstream path.')),
      confidence: item.verificationScore || item.confidence,
      expectedReturnHint: copy('This path is assembled from related markets. Review live books before trading.'),
      legs: [{
        marketId: item.id,
        marketTitle: item.title,
        eventTitle: item.eventTitle ?? null,
        side: defaultOrderHintForDirection(item.direction),
        probability: item.price,
        direction: item.direction || 'unknown',
        impact: item.impact || inferenceImpactSummary(item.direction),
        confidence: item.verificationScore || item.confidence,
        rationale: item.reason || item.evidenceSummary || copy('AI verified that this market is related to the root node.'),
        orderHint: defaultOrderHintForDirection(item.direction),
        evidenceIds: item.evidenceIds || [],
      }],
    }))
  }
  return [{
    id: 'pending_chain',
    title: copy('Waiting for AI script path'),
    summary: copy(`After inference completes, this section will show which tradable Polymarket books may react if "${market.title}" occurs.`),
    confidence: 0.5,
    expectedReturnHint: copy('No executable market yet.'),
    legs: [],
  }]
}

function displayScriptChains(market: Market, result: InferenceResult | null): InferenceScriptChain[] {
  const apiChains = (result?.scriptChains || []).filter((chain) => chain.legs?.length)
  return (apiChains.length ? apiChains : scriptFallbackChains(market, result)).slice(0, 4)
}

function CausalMap({
  chains,
  market,
  onOpenOrderPanel,
  onSelectedChainIdChange,
  result,
  selectedChainId,
}: {
  chains: InferenceScriptChain[]
  market: Market
  onOpenOrderPanel?: () => void
  onSelectedChainIdChange: (chainId: string) => void
  result: InferenceResult | null
  selectedChainId: string | null
}) {
  const relatedById = useMemo(() => new Map((result?.relatedMarkets || []).map((item) => [item.id, item])), [result])

  const selectedChain = chains.find((chain) => chain.id === selectedChainId) || chains[0]
  const activeChainId = selectedChain?.id || null
  const chainCount = Math.max(1, chains.length)
  const branchXs = chains.map((_, index) => (chainCount === 1 ? 500 : 120 + (760 / (chainCount - 1)) * index))

  return (
    <div className="causal-map script-chain-map">
      <div className="script-map-head">
        <span>{copy('Root Event')}</span>
        <div>
          <span><i className="line green" />{copy('Positive impact')}</span>
          <span><i className="line red" />{copy('Negative impact')}</span>
          <span><i className="line orange" />{copy('Conditional path')}</span>
        </div>
      </div>
      <div className="script-root-card">
        <MarketIcon market={market} size="medium" />
        <div>
          <small>{copy('Root Market')}</small>
          <b>{market.title}</b>
          {market.eventTitle ? <small>{market.eventTitle}</small> : null}
          <strong>{market.price}% <span>{formatConfidence(result?.confidence)}</span></strong>
          <em>{copy(`Synced ${formatDate(market.syncedAt)}`)}</em>
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
              onClick={() => onSelectedChainIdChange(chain.id)}
              type="button"
            >
              <div className="script-chain-title">
                <span>{index + 1}</span>
                <b>{chain.title}</b>
                <strong>{formatConfidence(chain.confidence)}</strong>
              </div>
              <p>{englishTextOrFallback(chain.summary, 'This path was generated from related Polymarket markets and should be checked against live books before trading.')}</p>
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
                        <small>{[leg.eventTitle, directionLabel(leg.direction), leg.impact || inferenceImpactSummary(leg.direction)].filter(Boolean).join(' · ')}</small>
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
          <b>{copy(`Selected path: ${selectedChain?.title || 'None'}`)}</b>
          <span>{selectedChain?.expectedReturnHint || copy('Choose a script path to add all included market directions to the order draft.')}</span>
        </div>
        <button type="button" disabled={!selectedChain?.legs.length} onClick={onOpenOrderPanel}>{copy('Buy This Path')}</button>
      </div>
      <div className="confidence-legend">
        <b>{copy('Confidence Guide')}</b>
        <span><i className="dot green" />{copy('High confidence >= 0.65')}</span>
        <span><i className="dot orange" />{copy('Elevated confidence 0.45 - 0.64')}</span>
        <span><i className="dot red" />{copy('Medium confidence 0.25 - 0.44')}</span>
        <span><i className="dot purple" />{copy('Lower confidence 0.10 - 0.24')}</span>
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
  const isEventNode = market.nodeType === 'event'
  const topOutcome = market.outcomes?.[0]
  const topMarket = market.topMarkets?.[0]
  const description = market.description?.trim() || ''
  const rules = market.rules?.trim() || ''
  const hasDistinctSummary = Boolean(description && rules && description !== rules)
  const subtitle = isEventNode
    ? `${market.marketsCount ?? market.topMarkets?.length ?? 0} markets - ${market.category}`
    : market.eventTitle || market.category
  const topMarketLabel = topMarket?.groupItemTitle || topMarket?.title
  const rulesText = rules || description || copy('Polymarket has not provided detailed rules for this market.')
  const tradingStatus = marketTradingStatusLabel(market)
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
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="hover-card-stats">
        <div><span>{copy('Price')}</span><b>{market.price}%</b></div>
        <div><span>{copy('Volume')}</span><b>{market.volume}</b></div>
        <div><span>{copy('Liquidity')}</span><b>{formatCompactMoney(market.liquidity)}</b></div>
        <div><span>{copy('End Date')}</span><b>{formatDate(market.endDate)}</b></div>
      </div>
      <div className="hover-card-body" tabIndex={0}>
        {hasDistinctSummary ? (
          <section className="hover-card-section">
            <span>{copy('Summary')}</span>
            <p>{description}</p>
          </section>
        ) : null}
        <section className="hover-card-section">
          <span>{copy('Rules')}</span>
          <p>{rulesText}</p>
        </section>
      </div>
      <div className="hover-card-footer">
        <span className={marketIsTradable(market) ? 'open' : 'closed'}>{tradingStatus}</span>
        {topMarket ? <span>{topMarketLabel}: {formatUnitPercent(topMarket.price)}</span> : topOutcome ? <span>{topOutcome.label}: {formatUnitPercent(topOutcome.price)}</span> : null}
      </div>
    </aside>
  )
}

function Card({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section className={`card ${className}`} id={id}>{children}</section>
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
      <ArrowLeft size={17} /> {copy('Back')}
    </button>
  )
}

function SearchPopover({
  activeType,
  error,
  loading,
  onTypeChange,
  onSelect,
  query,
  results,
}: {
  activeType: SearchResultType
  error: string | null
  loading: boolean
  onTypeChange: (type: SearchResultType) => void
  onSelect: (result: MarketSearchResult) => void
  query: string
  results: MarketSearchResult[]
}) {
  const tabs: Array<{ type: SearchResultType; label: string }> = [
    { type: 'market', label: copy('Markets') },
    { type: 'event', label: copy('Events') },
    { type: 'topic', label: copy('Topics') },
  ]
  const filteredResults = results.filter((result) => result.type === activeType)
  return (
    <div className="search-popover">
      <div className="search-tabs">
        {tabs.map((tab) => {
          const count = results.filter((result) => result.type === tab.type).length
          return (
            <button className={activeType === tab.type ? 'active' : ''} key={tab.type} type="button" onClick={() => onTypeChange(tab.type)}>
              {tab.label}{count ? ` ${count}` : ''}
            </button>
          )
        })}
      </div>
      <div className="search-result-list">
        {filteredResults.map((result) => (
          <button className="search-result-item" key={`${result.type}:${result.id}`} type="button" onClick={() => onSelect(result)}>
            <span className="search-result-avatar">
              {result.image || result.icon ? <img alt="" src={result.image || result.icon || ''} /> : <i>{result.title.slice(0, 1)}</i>}
            </span>
            <span className="search-result-main">
              <b>{result.title}</b>
              <small>{result.subtitle || result.category || copy('Polymarket market')}</small>
            </span>
            <span className="search-result-meta">
              <b>{formatProbability(result.price)}</b>
              <small>{result.type === 'topic' ? copy('Topic') : result.endDate ? formatDate(result.endDate) : formatCompactMoney(result.volume)}</small>
            </span>
          </button>
        ))}
        {error ? <div className="search-empty error">{error}</div> : null}
        {!loading && !error && !filteredResults.length ? <div className="search-empty">{copy(`No ${searchTypeLabel(activeType)} results found for "${query}"`)}</div> : null}
        {loading ? <div className="search-empty">{copy('Searching Polymarket markets...')}</div> : null}
      </div>
    </div>
  )
}

function searchTypeLabel(type: SearchResultType) {
  if (type === 'market') return copy('market')
  if (type === 'event') return copy('event')
  return copy('topic')
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
      {categories.map((category, index) => {
        const separated = index > 0
          && primaryMarketCategoryKeySet.has(categories[index - 1]?.key || '')
          && !primaryMarketCategoryKeySet.has(category.key)
        return (
          <button
            className={[
              'chip',
              active === category.key ? 'active' : '',
              separated ? 'chip-after-primary' : '',
            ].filter(Boolean).join(' ')}
            key={category.key}
            type="button"
            onClick={() => onChange(category.key)}
          >
            {category.key === 'hot' ? <Flame size={15} /> : null}
            {category.key === 'new' ? <Star size={15} /> : null}
            {category.label}
            <span className="chip-count">{formatCompactCount(category.count)}</span>
          </button>
        )
      })}
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
  const estimate = estimateInference(settings)
  const selectedOutcome = market.outcomes?.find((outcome) => outcome.outcomeId === settings.rootOutcomeId)
    ?? market.outcomes?.find((outcome) => outcome.outcomeId)
  const items = [
    [copy('Root Market'), market.title],
    [copy('Root Outcome'), selectedOutcome?.label ?? copy('Not selected')],
    [copy('AI Model'), modelPreferenceLabel(settings.modelPreference)],
    [copy('Depth'), `${settings.depth} layer${settings.depth > 1 ? 's' : ''}`],
    [copy('Candidate Budget'), copy(`Up to ${estimate.candidateBudget}`)],
    [copy('Output Cap'), copy(`Up to ${estimate.maxOutputMarkets}`)],
    [copy('Confidence Threshold'), `${settings.confidenceThreshold.toFixed(2)} · ${confidenceModeLabel(settings.confidenceMode)}`],
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

function DiscoveryTable({ market, relatedMarkets, loading }: { market?: Market; relatedMarkets?: InferenceRelatedMarket[]; loading?: boolean }) {
  const seedMarket = market || rootMarket
  if (relatedMarkets?.length) {
    return (
      <div className="discovery-table">
        {relatedMarkets.map((item) => {
          const tone = categoryTones[item.category] || seedMarket.tone
          const score = item.verificationScore ?? item.confidence
          const evidenceCount = item.evidenceCount ?? item.evidenceIds?.length ?? 0
          const relationMeta = evidenceCount > 0 ? copy(`Evidence ${evidenceCount}`) : item.relation
          return (
            <div key={item.id}>
              <MarketIcon market={{ icon: seedMarket.icon, iconUrl: item.icon || item.image || null, tone }} size="small" />
              <div className="discovery-market-title">
                <b>{item.title}</b>
                {item.eventTitle ? <small>{item.eventTitle}</small> : null}
              </div>
              <span className="relation-cell">
                <b>{item.relation || item.category}</b>
                <small>{directionLabel(item.direction)} · {relationMeta}</small>
              </span>
              <strong>{formatConfidence(score)}</strong>
              <em>{item.volume}</em>
              <div className="impact-cell">
                <b>{item.impact || inferenceImpactSummary(item.direction)}</b>
                <small>{formatMarketPercent(item.price)}</small>
              </div>
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div className="discovery-empty">
      <Info size={18} />
      <div>
        <b>{loading ? copy('Candidate markets are being verified') : copy('No verified markets returned')}</b>
        <span>{loading ? copy('Results will appear here after the backend finishes candidate scoring.') : copy('Run inference again with lower confidence or refresh market data if this looks too narrow.')}</span>
      </div>
    </div>
  )
}

type InferenceLogState = 'waiting' | 'processing' | 'complete' | 'error'

function inferenceRuntimeLogs(
  runStatus: BackendInferenceStatus | null | undefined,
  loading: boolean | undefined,
  error: string | null | undefined,
) {
  const stage = error ? runStatus?.stage : runStatus?.stage ?? (loading ? 'queued' : null)
  const activeIndex = inferenceProgressStepIndex(stage)
  const steps = inferenceProgressSteps()
  return steps.map((step, index) => {
    const state: InferenceLogState = error && index === activeIndex
      ? 'error'
      : index < activeIndex || runStatus?.status === 'completed'
        ? 'complete'
        : index === activeIndex && loading
          ? 'processing'
          : 'waiting'
    return {
      detail: inferenceStepDetail(step.stage),
      state,
      title: step.label,
    }
  })
}

function inferenceStepDetail(stage: string) {
  if (stage === 'queued') return copy('The run is registered and waiting for backend capacity.')
  if (stage === 'candidate_retrieval') return copy('Causeway loads same-event markets, cached market links, prices, and order-book context.')
  if (stage === 'ai_reasoning') return copy('The selected GPT or Claude model scores relevance and causal direction.')
  if (stage === 'outcome_mapping') return copy('AI output is mapped back to tradable Polymarket outcomes and verified market ids.')
  if (stage === 'script_generation') return copy('Causeway persists the causal script, graph, and tradable order candidates.')
  return copy('Waiting for the next backend update.')
}

function inferenceLogStateLabel(state: InferenceLogState) {
  if (state === 'complete') return copy('Complete')
  if (state === 'processing') return copy('Processing')
  if (state === 'error') return copy('Failed')
  return copy('Waiting')
}

function LogList({
  error,
  logs,
  loading,
  runStatus,
}: {
  error?: string | null
  logs?: string[]
  loading?: boolean
  runStatus?: BackendInferenceStatus | null
}) {
  const displayLogs = logs?.length ? logs.map((title) => ({
    detail: copy('Persisted by the completed inference run.'),
    state: 'complete' as const,
    title,
  })) : inferenceRuntimeLogs(runStatus, loading, error)
  return (
    <div className="log-list">
      {displayLogs.map((item, index) => (
        <div key={`${item.title}-${index}`}>
          <i className={`dot ${item.state === 'complete' ? 'green' : item.state === 'processing' ? 'cyan' : item.state === 'error' ? 'red' : 'blue'}`} />
          <span>{inferenceLogStateLabel(item.state)}</span>
          <b>{item.title}</b>
          <small>{item.detail}</small>
        </div>
      ))}
    </div>
  )
}

function SummaryList({ market, result }: { market: Market; result: InferenceResult | null }) {
  if (result) {
    const chainItems = (result.scriptChains || []).slice(0, 5).map((chain, index) => {
      const chainSummary = englishTextOrFallback(
        chain.summary,
        'This path was generated from related Polymarket markets and should be checked against live books before trading.',
      )
      const expectedReturnHint = englishTextOrFallback(chain.expectedReturnHint, '')
      return [
        englishTextOrFallback(chain.title, `Path ${index + 1}`),
        `${formatConfidence(chain.confidence)} · ${chain.legs.length} market${chain.legs.length === 1 ? '' : 's'}. ${chainSummary}${expectedReturnHint ? ` ${expectedReturnHint}` : ''}`,
      ]
    })
    const linkItems = result.causalLinks.slice(0, 5).map((link) => {
      const impact = englishTextOrFallback(link.impact, inferenceImpactSummary(link.direction))
      const rationale = englishTextOrFallback(link.rationale, 'This related market may reprice if the root outcome occurs.')
      const evidenceSummary = englishTextOrFallback(link.evidenceSummary, '')
      return [
        `${market.title} -> ${link.target}`,
        `${directionLabel(link.direction)} · ${formatConfidence(link.confidence)} · ${impact}. ${rationale}${evidenceSummary ? ` Evidence: ${evidenceSummary}` : ''}`,
      ]
    })
    const scenarioItems = result.scenarios.slice(0, 2).map((scenario, index) => [
      englishTextOrFallback(scenario.name, `Scenario ${index + 1}`),
      `${scenario.probabilityShift}: ${englishTextOrFallback(scenario.description, 'AI generated this scenario from current Polymarket context.')}`,
    ])
    const excludedNote = result.excludedMarkets?.length
      ? [[
        `Excluded ${result.excludedMarkets.length} low-relevance candidate${result.excludedMarkets.length === 1 ? '' : 's'}`,
        result.excludedMarkets.slice(0, 3).map((item) => {
          const reason = englishTextOrFallback(item.reason, 'Low relevance to the selected root outcome.')
          return `${item.title || item.id}: ${reason}`
        }).join('; '),
      ]]
      : []
    const items = [
      [copy('Root Market Thesis'), englishTextOrFallback(result.thesis, 'AI analyzed the selected root outcome against related Polymarket markets.')],
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
    [market.title, copy(`Current market price is ${market.price}% with ${market.volume} volume. This is the root node for this inference.`)],
    [
      copy('Same-Event Market Links'),
      market.eventTitle
        ? copy(`Prioritize other markets under the "${market.eventTitle}" event to evaluate probability migration inside the event.`)
        : copy('Prioritize markets with similar topics and categories to evaluate probability migration between nearby markets.'),
    ],
    ['Liquidity', `This market has ${formatCompactMoney(market.liquidity)} liquidity; review live depth before trading.`],
    [copy('Time Constraint'), copy(`Market end date is ${formatDate(market.endDate)}. Inference prioritizes key triggers before close.`)],
    [copy('Risk Note'), copy('This script is scenario analysis based on market data and AI reasoning. It is not trading advice.')],
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

export default App
