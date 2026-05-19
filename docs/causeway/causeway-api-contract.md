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

`cursor` 必须使用上一页响应里的 `nextCursor` 原样回传。它是后端生成的 opaque cursor，前端不能解析、拼接或假设它等于数据库 id。

鉴权：

```text
Authorization: Bearer <accessToken>
```

除公开市场浏览接口外，推演、脚本、订单、资产组合和内部接口都需要登录。内部接口还需要服务端内部 token 或后台网络访问控制。

限流：

- 默认所有非健康检查接口都会被限流；`GET /health` 和 `GET /health/ready` 不参与限流，避免影响部署平台探活。
- 默认按路由和调用身份计数。已登录请求优先使用用户或 bearer token 维度，未登录请求使用客户端 IP 维度。
- Auth 接口、内部接口和普通 API 使用独立限流额度；生产环境必须配置 Redis 作为跨实例限流存储。
- 响应头会返回 `X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Reset`。超过额度时返回 `429 RATE_LIMITED`，并包含 `Retry-After`。

## 2. Health

### `GET /health`

公开 liveness endpoint，不访问数据库。

响应：

```ts
type HealthResponse = {
  ok: true;
  service: "causeway-api";
  timestamp: string;
};
```

### `GET /health/ready`

公开 readiness endpoint，用于部署平台判断服务是否可以接流量。该接口会执行数据库探活；限流启用时还会检查限流存储。数据库或限流存储不可用时返回 `503 READINESS_FAILED`，错误响应不能泄漏连接串、密码或内部异常。

响应：

```ts
type ReadinessResponse = {
  ok: true;
  service: "causeway-api";
  checks: {
    database: "ok";
    rateLimit?: "ok";
  };
  timestamp: string;
};
```

## 3. Auth

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

## 4. Markets

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

`cursor` 为服务端返回的 opaque cursor，和当前 `sort` 绑定。切换 `q`、`category`、`active`、`closed` 或 `sort` 后必须丢弃旧 cursor，从第一页重新请求。

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

`tickSize` 和 `minOrderSize` 是前端下单校验必需字段。CLOB 和本地缓存都无法提供这两个数值时，接口返回 `ORDERBOOK_UNAVAILABLE`，不能返回 `null`。

## 5. Market Network

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

## 6. Inference

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
    "cacheKey": "inf_x",
    "cacheHit": false,
    "scriptId": null
  },
  "requestId": "req_x"
}
```

说明：一期后端支持 `mock-causeway-v1` 本地 mock 推演模型，用于开发和测试完整脚本链路。该模式可能同步返回 `status="completed"` 和 `scriptId`。真实 AI provider 或持久 worker 未配置时，非 mock 模型必须返回 `503 CAPABILITY_UNAVAILABLE`，不允许伪造成真实 AI 成功或留下不可恢复的后台任务。

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

## 7. Scripts

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

## 8. Orders

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
// Validation rules:
// - Each selection must provide at least one of amountUsd or size.
// - If both are provided, amountUsd must match size * price within USD cent precision.
// - orderType is valid only for limit orders; market orders return orderType=null.
// - minOrderSize is enforced against amountUsd.
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
  submitMode: "dry_run_no_signature" | "signed_clob_order" | "unavailable";
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

## 9. Portfolio

### `GET /portfolio/summary`

响应：

```ts
type PortfolioSummary = {
  capability: "available" | "degraded" | "unavailable";
  dataSource: "polymarket_data_api" | "clob" | "chain" | "local" | "stub";
  cashAvailable: number | null;
  portfolioValue: number | null;
  openPositionsValue: number | null;
  openOrdersValue: number | null;
  pnl: number | null;
  refreshedAt: string;
  error: string | null;
};
```

`openOrdersValue` 只统计已经提交但未完全结束的订单，例如 `submitted`、`partially_filled`。`preview_ready` 和 `user_confirming` 只代表预览或确认中，不能计入资产敞口。

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

如果最近一次持仓同步已成功且本地没有持仓，返回 `capability="available"`、`dataSource="polymarket_data_api"` 和空 `items`。如果尚未同步或最近同步失败，必须通过 `degraded/unavailable` 和 `error` 区分，不能把“空持仓”和“数据源不可用”混在一起。

### `POST /portfolio/positions/sync`

触发当前登录用户的钱包持仓同步。后端从 Polymarket Data API 拉取公开 positions 数据，按 `clobTokenId` 关联本地 outcome，按 `conditionId` 辅助关联 market。同步结果写入本地 `ExternalPosition`，读取接口仍然只读本地数据库。

响应：

```ts
type PortfolioPositionsSyncResponse = {
  runId: string;
  status: "completed";
  capability: "available" | "degraded" | "unavailable";
  fetchedCount: number;
  upsertedCount: number;
  skippedCount: number;
  deletedStaleCount: number;
};
```

### `GET /portfolio/orders`

查询参数：

```text
status=open|filled|cancelled|failed
cursor
limit
```

`cursor` 为服务端返回的 opaque cursor，按 `createdAt desc, id asc` 稳定分页。

响应结构同样使用 capability wrapper：

```ts
type PortfolioOrdersResponse = {
  capability: "available" | "degraded" | "unavailable";
  dataSource: "clob" | "local" | "stub";
  items: PortfolioOrderIntent[];
  nextCursor: string | null;
  hasMore: boolean;
  refreshedAt: string;
  error: string | null;
};

type PortfolioOrderIntent = {
  intentId: string;
  status:
    | "draft"
    | "preview_ready"
    | "user_confirming"
    | "dry_run_completed"
    | "submitted"
    | "partially_submitted"
    | "failed"
    | "cancelled";
  executionMode: "dry_run" | "real";
  totalAmountUsd: number | null;
  createdAt: string;
  updatedAt: string;
  orders: PortfolioOrder[];
};

type PortfolioOrder = {
  id: string;
  marketId: string;
  outcomeId: string;
  clobTokenId: string;
  side: "BUY";
  orderMode: "market" | "limit";
  orderType: "GTC" | "GTD" | "FOK" | "FAK" | null;
  limitPrice: number | null;
  estimatedFillPrice: number | null;
  size: number | null;
  amountUsd: number | null;
  externalOrderId: string | null;
  status: string;
  errorMessage: string | null;
  market: {
    id: string;
    slug: string;
    question: string;
  };
  outcome: {
    id: string;
    label: string;
    clobTokenId: string;
  };
};
```

### `GET /portfolio/trades`

查询参数：

```text
cursor
limit
```

`cursor` 为服务端返回的 opaque cursor，按 `updatedAt desc, id asc` 稳定分页。

当前真实成交历史源未接通时，接口返回本地已完成订单作为 degraded trade history。没有本地成交时也返回 `dataSource="local"` 的空分页，而不是 `stub/unavailable`。

响应结构：

```ts
type PortfolioTradesResponse = {
  capability: "available" | "degraded" | "unavailable";
  dataSource: "polymarket_data_api" | "clob" | "local" | "stub";
  items: PortfolioTrade[];
  nextCursor: string | null;
  hasMore: boolean;
  refreshedAt: string;
  error: string | null;
};

type PortfolioTrade = {
  tradeId: string;
  orderId: string;
  intentId: string;
  executionMode: "dry_run" | "real";
  intentStatus: string;
  marketId: string;
  outcomeId: string;
  tokenId: string;
  side: "BUY";
  orderMode: "market" | "limit";
  orderType: "GTC" | "GTD" | "FOK" | "FAK" | null;
  price: number | null;
  size: number | null;
  amountUsd: number | null;
  externalOrderId: string | null;
  status: string;
  market: {
    id: string;
    slug: string;
    question: string;
  };
  outcome: {
    id: string;
    label: string;
    clobTokenId: string;
  };
  tradedAt: string;
};
```

## 10. Sync

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

## 11. Monitor

### `POST /internal/monitor/order-statuses/refresh`

内部接口，触发订单状态刷新边界。当前实现按批扫描本地订单状态，先记录 `SyncRun.running`，结束时更新为 `completed` 或 `failed`；真实 CLOB 状态刷新未接通前不能伪造成 available 或外部状态已刷新。

响应：
```ts
type OrderStatusRefreshResult = {
  runId: string;
  jobType: "order_status_refresh";
  status: "completed" | "failed";
  capability: "degraded" | "unavailable";
  source: "local_order_state";
  reason: string;
  inspectedOrderCount: number;
  batchCount: number;
  statusCounts: Record<string, number>;
  intentStatusCounts: Record<string, number>;
  refreshableExternalOrderCount: number;
  missingExternalOrderIdCount: number;
};
```

### `POST /internal/monitor/script-markets/refresh`

内部接口，触发脚本市场监控刷新边界。当前实现按批扫描非 archived 脚本相关市场，基于本地 Polymarket 缓存为 market 和 outcome 写入 `MarketSnapshot`，先记录 `SyncRun.running`，结束时更新为 `completed` 或 `failed`；未接通真实外部刷新前不能伪造为 available。

响应：
```ts
type ScriptMarketRefreshResult = {
  runId: string;
  jobType: "script_market_refresh";
  status: "completed" | "failed";
  capability: "degraded" | "unavailable";
  source: "local_polymarket_cache";
  reason: string;
  refreshedScriptMarketCount: number;
  snapshotCount: number;
  batchCount: number;
};
```

## 12. 错误码

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
ORDER_INTENT_NOT_SUBMITTABLE
REQUEST_VALIDATION_FAILED
READINESS_FAILED
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
