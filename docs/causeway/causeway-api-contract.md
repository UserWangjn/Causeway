# Causeway 接口文档

## 1. 通用约定

Base URL：

```text
/api/v1
```

响应格式：

```ts
type ApiResponse<T> = {
  data: T;
  requestId: string;
};
```

除错误响应外，本文档所有响应类型默认都包在 `ApiResponse<T>` 的 `data` 字段中，示例中展示裸类型时表示 `data` 内部结构。

错误格式：

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
};
```

分页：

```ts
type Page<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};
```

鉴权：

```text
Authorization: Bearer <accessToken>
```

除公开市场浏览接口外，推演、脚本、订单、资产组合和内部接口都需要登录。内部接口还需要服务端内部 token 或后台网络访问控制。

## 2. Auth

### `POST /auth/nonce`

请求：

```json
{
  "address": "0x...",
  "chainId": 137
}
```

响应：

```json
{
  "data": {
    "nonce": "Sign in to Causeway: ...",
    "expiresAt": "2026-05-17T10:00:00.000Z"
  },
  "requestId": "req_x"
}
```

### `POST /auth/verify`

请求：

```json
{
  "address": "0x...",
  "chainId": 137,
  "message": "Sign in to Causeway: ...",
  "signature": "0x..."
}
```

响应：

```json
{
  "data": {
    "accessToken": "jwt",
    "user": {
      "id": "user_x",
      "walletAddress": "0x..."
    }
  },
  "requestId": "req_x"
}
```

## 3. Markets

### `GET /markets`

查询参数：

```text
q
category
active
closed
sort
cursor
limit
```

响应：

```ts
type MarketListItem = {
  id: string;
  eventId: string | null;
  slug: string;
  question: string;
  icon: string | null;
  image: string | null;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  volume: number | null;
  liquidity: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  outcomes: MarketOutcome[];
  syncedAt: string;
};
```

### `GET /markets/:marketId`

响应：

```ts
type MarketDetail = MarketListItem & {
  conditionId: string | null;
  questionId: string | null;
  description: string | null;
  rules: string | null;
  endDate: string | null;
  orderMinSize: number | null;
  orderPriceMinTickSize: number | null;
  negRisk: boolean;
  relatedMarkets: MarketListItem[];
};
```

### `GET /markets/by-slug/:slug`

用于前端 `/markets/:marketSlug` 路由解析，响应结构同 `GET /markets/:marketId`。

标准 outcome 结构：

```ts
type MarketOutcome = {
  outcomeId: string;
  label: string;
  tokenId: string;
  price: number | null;
  bestBid: number | null;
  bestAsk: number | null;
  lastTradePrice: number | null;
};
```

### `GET /markets/:marketId/orderbook`

查询参数：

```text
tokenId
```

响应：

```ts
type OrderBook = {
  marketId: string;
  tokenId: string;
  bids: { price: number; size: number }[];
  asks: { price: number; size: number }[];
  tickSize: number;
  minOrderSize: number;
  negRisk: boolean;
  refreshedAt: string;
};
```

## 4. Market Network

### `GET /market-network`

查询参数：

```text
category
q
limit
```

响应：

```ts
type MarketNetwork = {
  nodes: {
    id: string;
    marketId: string;
    title: string;
    icon: string | null;
    price: number | null;
    volume: number | null;
    category: string | null;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    relationType: "tag" | "event" | "semantic" | "price_correlation" | "ai";
    weight: number;
  }[];
};
```

## 5. Inference

### `POST /inference-runs`

请求：

```json
{
  "rootMarketId": "market_x",
  "rootOutcomeId": "outcome_x",
  "depth": 2,
  "maxMarketsPerLayer": 8,
  "confidenceThreshold": 0.55,
  "model": "configured-reasoning-model",
  "cacheEnabled": true
}
```

响应：

```json
{
  "data": {
    "runId": "run_x",
    "status": "queued",
    "cacheKey": "inf_x"
  },
  "requestId": "req_x"
}
```

### `GET /inference-runs/:runId`

响应：

```ts
type InferenceRunStatus = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  stage:
    | "candidate_retrieval"
    | "ai_reasoning"
    | "outcome_mapping"
    | "market_refresh"
    | "script_generation"
    | null;
  progress: number;
  cacheHit: boolean;
  scriptId: string | null;
  errorMessage: string | null;
};
```

## 6. Scripts

### `GET /scripts/:scriptId`

响应：

```ts
type CausalScript = {
  id: string;
  title: string;
  root: {
    marketId: string;
    outcomeId: string;
    outcomeLabel: string;
  };
  graph: {
    nodes: ScriptNode[];
    edges: ScriptEdge[];
  };
  markets: ScriptMarket[];
};

type ScriptNode = {
  nodeId: string;
  marketId: string;
  title: string;
  layer: 0 | 1 | 2 | 3;
  recommendedOutcomes: {
    outcomeId: string;
    label: string;
    tokenId: string;
  }[];
  confidence: number;
  direction: "supports" | "opposes" | "unclear";
};

type ScriptEdge = {
  sourceNodeId: string;
  targetNodeId: string;
  sourceOutcomeId: string;
  targetOutcomeId: string;
  relation: "causes" | "supports" | "hedges" | "contradicts" | "correlates";
  confidence: number;
  reason: string;
};

type ScriptMarket = {
  scriptMarketId: string;
  marketId: string;
  title: string;
  layer: 0 | 1 | 2 | 3;
  confidence: number;
  outcomes: {
    selectionId: string;
    outcomeId: string;
    label: string;
    tokenId: string;
    aiAction: "buy" | "avoid";
    userAction: "buy" | "skip";
    orderMode: "market" | "limit";
    limitPrice: number | null;
    size: number | null;
    amountUsd: number | null;
    reason: string | null;
  }[];
};
```

### `PATCH /scripts/:scriptId/outcome-selections/:selectionId`

请求：

```json
{
  "userAction": "buy",
  "orderMode": "limit",
  "limitPrice": 0.42,
  "size": 60,
  "amountUsd": 25
}
```

响应：

```json
{
  "data": {
    "selectionId": "sel_x",
    "userAction": "buy",
    "orderMode": "limit",
    "limitPrice": 0.42,
    "size": 60,
    "amountUsd": 25
  },
  "requestId": "req_x"
}
```

## 7. Orders

订单接口必须在真实 CLOB 下单能力不可用时仍保持协议可用。前后端统一使用 `executionMode` 和 capability 状态：

```ts
type ExecutionMode = "dry_run" | "real";
type CapabilityStatus = "available" | "degraded" | "unavailable";
type OrderMode = "market" | "limit";
type LimitOrderType = "GTC" | "GTD" | "FOK" | "FAK";
```

说明：

- `dry_run`：不提交 Polymarket，只生成和记录 Causeway 本地订单结果，用于开发、演示和 CLOB 不可用降级。
- `real`：提交 Polymarket CLOB。若签名、余额或 CLOB 能力不可用，接口返回结构化错误，不改变协议。

### `POST /orders/preview`

请求：

```json
{
  "scriptId": "script_x",
  "executionMode": "dry_run",
  "selections": [
    {
      "selectionId": "sel_x",
      "orderMode": "limit",
      "amountUsd": 25,
      "size": 60,
      "limitPrice": 0.42,
      "orderType": "GTC"
    }
  ]
}
```

响应：

```ts
type OrderPreview = {
  intentId: string;
  executionMode: "dry_run" | "real";
  tradingCapability: "available" | "degraded" | "unavailable";
  balanceCapability: "available" | "degraded" | "unavailable";
  tradingCapabilityReason: string | null;
  balanceCapabilityReason: string | null;
  cashAvailable: number | null;
  totalAmountUsd: number;
  estimatedMaxPayout: number;
  estimatedMaxLoss: number;
  requiresSignature: boolean;
  submitMode: "dry_run_no_signature" | "signed_clob_order";
  refreshedAt: string;
  expiresAt: string;
  orders: {
    selectionId: string;
    marketId: string;
    outcomeId: string;
    tokenId: string;
    outcomeLabel: string;
    side: "BUY";
    orderMode: "market" | "limit";
    orderType: "GTC" | "GTD" | "FOK" | "FAK" | null;
    limitPrice: number | null;
    estimatedFillPrice: number | null;
    amountUsd: number;
    size: number;
    tickSize: number | null;
    minOrderSize: number | null;
    valid: boolean;
    warnings: string[];
    error: string | null;
  }[];
};
```

### `POST /orders/prepare-signature`

真实下单前调用。只有 `orders/preview` 返回 `requiresSignature=true` 时前端才需要调用。`dry_run` 模式返回 `not_required`，`real` 模式返回前端需要签名的 payload。若真实 CLOB 签名方案尚未接通，返回 `unavailable`，前端仍可展示一致的错误状态。

请求：

```json
{
  "intentId": "intent_x",
  "executionMode": "real",
  "walletAddress": "0x...",
  "chainId": 137
}
```

响应：

```ts
type PrepareSignatureResult = {
  intentId: string;
  executionMode: "dry_run" | "real";
  signingStatus: "ready" | "not_required" | "unavailable";
  protocol: "dry_run_no_signature" | "polymarket_clob_eip712";
  expiresAt: string | null;
  payloads: {
    orderId: string;
    tokenId: string;
    payload: unknown;
  }[];
  error: string | null;
};
```

### `POST /orders/submit`

请求：

```json
{
  "intentId": "intent_x",
  "executionMode": "dry_run",
  "idempotencyKey": "uuid-from-client",
  "signedOrders": []
}
```

响应：

```ts
type OrderSubmitResult = {
  intentId: string;
  executionMode: "dry_run" | "real";
  status: "dry_run_completed" | "submitted" | "partially_submitted" | "failed";
  orders: {
    orderId: string;
    externalOrderId: string | null;
    status: string;
    errorMessage: string | null;
  }[];
};
```

`idempotencyKey` 在同一用户、同一 `intentId` 下必须唯一。重复提交相同 key 返回第一次提交结果；同 key 但请求内容不同返回 `IDEMPOTENCY_CONFLICT`。

### `GET /orders/intents/:intentId`

用于订单确认页刷新预览、提交结果和部分失败状态。

响应结构：

```ts
type OrderIntentDetail = {
  intentId: string;
  executionMode: "dry_run" | "real";
  status: "draft" | "preview_ready" | "user_confirming" | "dry_run_completed" | "submitted" | "partially_submitted" | "failed" | "cancelled";
  preview: OrderPreview | null;
  submitResult: OrderSubmitResult | null;
  createdAt: string;
  updatedAt: string;
};
```

## 8. Portfolio

### `GET /portfolio/summary`

响应：

```ts
type PortfolioSummary = {
  capability: "available" | "degraded" | "unavailable";
  dataSource: "polymarket_data_api" | "clob" | "chain" | "stub";
  cashAvailable: number | null;
  portfolioValue: number | null;
  openPositionsValue: number | null;
  openOrdersValue: number | null;
  pnl: number | null;
  refreshedAt: string;
  error: string | null;
};
```

### `GET /portfolio/positions`

响应：

```ts
type PortfolioPositionsResponse = {
  capability: "available" | "degraded" | "unavailable";
  dataSource: "polymarket_data_api" | "clob" | "stub";
  items: Position[];
  refreshedAt: string;
  error: string | null;
};

type Position = {
  marketId: string;
  outcomeId: string;
  tokenId: string;
  title: string;
  outcomeLabel: string;
  size: number;
  avgPrice: number | null;
  currentPrice: number | null;
  currentValue: number | null;
  pnl: number | null;
};
```

### `GET /portfolio/orders`

查询参数：

```text
status=open|filled|cancelled|failed
cursor
limit
```

响应结构同样使用 capability wrapper：

```ts
type PortfolioOrdersResponse = {
  capability: "available" | "degraded" | "unavailable";
  dataSource: "clob" | "local" | "stub";
  items: unknown[];
  refreshedAt: string;
  error: string | null;
};
```

### `GET /portfolio/trades`

查询参数：

```text
cursor
limit
```

响应结构：

```ts
type PortfolioTradesResponse = {
  capability: "available" | "degraded" | "unavailable";
  dataSource: "polymarket_data_api" | "clob" | "stub";
  items: unknown[];
  refreshedAt: string;
  error: string | null;
};
```

## 9. Sync

### `POST /internal/sync/polymarket`

内部接口，触发同步任务。必须只允许内部 token 或后台网络访问。

请求：

```json
{
  "scope": "markets",
  "mode": "incremental"
}
```

### `GET /internal/sync/runs`

查看同步任务历史。

## 10. 错误码

```text
AUTH_REQUIRED
INVALID_SIGNATURE
UNSUPPORTED_CHAIN
MARKET_NOT_FOUND
OUTCOME_NOT_FOUND
MARKET_NOT_TRADABLE
ORDERBOOK_UNAVAILABLE
INSUFFICIENT_CASH
INVALID_TICK_SIZE
BELOW_MIN_ORDER_SIZE
ORDER_PREVIEW_EXPIRED
CAPABILITY_UNAVAILABLE
USER_REJECTED_SIGNATURE
SIGNATURE_EXPIRED
IDEMPOTENCY_CONFLICT
RATE_LIMITED
INFERENCE_FAILED
CACHE_ENTRY_EXPIRED
POLYMARKET_API_ERROR
POLYMARKET_IDENTITY_CONFLICT
```
