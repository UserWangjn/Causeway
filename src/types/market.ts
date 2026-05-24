export type Market = {
  id: string
  nodeType?: 'event' | 'market'
  marketId?: string | null
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
  active?: boolean
  closed?: boolean
  archived?: boolean
  staleDetectedAt?: string | null
  acceptingOrders?: boolean
  enableOrderBook?: boolean
  syncedAt?: string | null
  outcomes?: { outcomeId?: string | null; label: string; price: number | null; tokenId: string | null }[]
  bestBid?: number | null
  bestAsk?: number | null
  lastTradePrice?: number | null
  orderMinSize?: number | null
  tickSize?: number | null
  marketsCount?: number | null
  topMarkets?: { marketId: string; title: string; groupItemTitle?: string | null; price: number | null; volume: number | null }[]
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

export type MarketOutcome = NonNullable<Market['outcomes']>[number]

export type ApiMarketNode = {
  id: string
  nodeType?: 'event' | 'market'
  marketId?: string | null
  slug?: string | null
  title: string
  groupItemTitle?: string | null
  eventId?: string | null
  eventSlug?: string | null
  eventTitle?: string | null
  category?: string | null
  categoryKey?: string | null
  officialCategory?: string | null
  tags?: string[]
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
  outcomes?: { outcomeId?: string | null; label: string; price: number | null; tokenId: string | null }[]
  bestBid?: number | null
  bestAsk?: number | null
  lastTradePrice?: number | null
  orderMinSize?: number | null
  tickSize?: number | null
  marketsCount?: number | null
  topMarkets?: { marketId: string; title: string; groupItemTitle?: string | null; price: number | null; volume: number | null }[]
  syncedAt?: string | null
  x?: number
  y?: number
}

export type ApiMarketEdge = {
  id: string
  source: string
  target: string
  relationType: 'tag' | 'event' | 'semantic' | 'price_correlation' | 'ai'
  weight: number
  reason: string
}

export type MarketNetworkResponse = {
  data: {
    nodes: ApiMarketNode[]
    edges: ApiMarketEdge[]
    source: string
    generatedAt: string
  }
}

export type EventDetail = {
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
    marketsReturned?: number | null
    hasMoreMarkets?: boolean
    syncedAt: string | null
  } | null
  selectedMarket?: ApiMarketNode | null
  markets: ApiMarketNode[]
  source: string
  generatedAt: string
}

export type EventDetailResponse = {
  data: EventDetail
}

export type PricePoint = {
  t: number
  p: number
}

export type ChartRow = {
  id: string
  index: number
  label: string
  price: number | null
  tokenId: string
}

export type PriceHistoryResponse = {
  data: {
    history: Record<string, PricePoint[]>
    source: string
    generatedAt: string
  }
}
