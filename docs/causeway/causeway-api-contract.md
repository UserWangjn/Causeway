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
    "nonce": "example.com wants you to sign in with your Ethereum account:\n0x...\n\nSign in to Causeway.\n\nURI: https://example.com\nVersion: 1\nChain ID: 137\nNonce: ...",
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
    "expiresAt": "2026-05-17T11:00:00.000Z",
    "user": {
      "id": "user_x",
      "walletAddress": "0x..."
    }
  },
  "requestId": "req_x"
}
```

### `POST /auth/logout`

请求头：

```text
Authorization: Bearer <accessToken>
```

响应：

```json
{
  "data": {
    "revoked": true
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

### `GET /markets/network`

说明：`/markets/network` 是正式资源路径；`/market-network` 仅作为旧版兼容别名保留，不建议新前端继续使用。

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
    volume24hr: number | null;
    liquidity: number | null;
    category: string | null;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    relationType: "tag" | "event" | "semantic" | "price_correlation" | "ai";
    weight: number;
  }[];
  total: number;
  returned: number;
  limit: number;
  hasMore: boolean;
  category: string;
  source: "database";
  topologySource: "precomputed" | "deterministic";
  generatedAt: string;
};
```

`nodes` 是用于前端图谱渲染的有限样本，不代表当前分类下的全量市场。全量市场数量必须读取 `total`；当前返回节点数读取 `returned`。`category=hot` 表示开放且未过期、并且 `volume24hr`、`volume` 或 `liquidity` 任一指标大于 0 的活跃市场子集。后端会先用索引友好的成交量和流动性排序读取有限候选池，再按 24h 成交量、流动性、总成交量、可下单状态、价格可判断空间、预计算图谱分数综合重排，并限制同一事件和同一分类过度集中。后端同步 Polymarket 数据时会把事件标签归一化为稳定分类键，因此 `/markets/categories` 不需要在请求时扫描全部市场文本。

### `GET /markets/categories`

响应：

```ts
type MarketCategories = {
  categories: {
    key: string;
    label: string;
    count: number;
  }[];
  generatedAt: string;
  source: string;
};
```

`key` uses stable category keys (`politics`, `sports`, `crypto`, `macro`, `tech`, `entertainment`, `other`).
When Polymarket Gamma does not provide explicit tags, the backend infers the category from event and market text so frontend filters remain usable with real synced data.

### `GET /markets/search`

查询参数：

```text
q
limit
```

响应：

```ts
type MarketSearch = {
  results: {
    type: "market" | "event";
    id: string;
    marketId: string | null;
    eventId: string | null;
    eventSlug: string | null;
    slug: string | null;
    title: string;
    subtitle: string | null;
    category: string | null;
    categoryKey: string | null;
    icon: string | null;
    image: string | null;
    price: number | null;
    volume: number | null;
    liquidity: number | null;
    endDate: string | null;
    score: number;
    matchedBy: "market" | "event";
  }[];
  generatedAt: string;
  source: string;
};
```

### `GET /events/detail`

查询参数至少提供一个：

```text
marketId
eventId
eventSlug
```

Response:

```ts
type EventDetail = {
  event: EventSummary | null;
  selectedMarket: ExplorerMarket | null;
  markets: ExplorerMarket[];
  source: "database";
  generatedAt: string;
};
```

When `marketId` is provided, `selectedMarket` is the exact clicked market and its `title` is the market question.
`event.title` is the parent event/group title. Frontend detail pages should use `selectedMarket.title` as the primary
market title and `event.title` as the group subtitle.

### `GET /markets/history`

查询参数：

```text
tokenIds
interval = 1h | 6h | 1d | 1w | 1m | all
fidelity
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

说明：`POST /inference-runs` 始终只创建 `queued` 任务，前端通过 `GET /inference-runs/:runId` 轮询 `completed` 后再读取 `scriptId`。`mock-causeway-v1` 也走同一套异步任务语义。配置 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL` 后，非 mock 模型通过 OpenAI-compatible `POST /chat/completions` JSON 输出通道执行；`AI_BASE_URL` 必须是纯 base URL，生产环境必须使用 HTTPS，且请求中的 `model` 必须等于当前 `AI_MODEL`。真实 AI provider 未配置、请求模型不匹配或 provider 输出不能通过后端 schema 校验时，任务应进入 `failed` 并写入 `errorMessage`。

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

### `POST /scripts/direct-order`

用于市场详情页的单 outcome 下单入口。后端会把用户选择的 market/outcome 转成一个标准 `CausalScript`，后续仍复用 `PATCH /scripts/:scriptId/outcome-selections/:selectionId`、`POST /orders/preview`、`POST /orders/prepare-signature`、`POST /orders/submit`，不新增第二套订单模型。

请求：

```json
{
  "marketId": "market_x",
  "outcomeId": "outcome_x",
  "orderMode": "market",
  "amountUsd": 10
}
```

响应：同 `GET /scripts/:scriptId`。

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
  price: number | null;
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
  orderMinSize: number | null;
  tickSize: number | null;
  bestAsk: number | null;
  lastTradePrice: number | null;
  outcomes: {
    selectionId: string;
    outcomeId: string;
    label: string;
    tokenId: string;
    price: number | null;
    aiAction: "buy" | "avoid";
    userAction: "buy" | "skip";
    side: "BUY";
    orderMode: "market" | "limit";
    limitPrice: number | null;
    size: number | null;
    amountUsd: number | null;
    confidence: number | null;
    reason: string;
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
    orderBookRefreshedAt: string | null;
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

`funderAddress` 仅作为高级调用方的可选覆盖字段。Causeway 默认真实 CLOB 订单使用 Polymarket `signatureType=2` (`POLY_GNOSIS_SAFE`)，后端会通过 Polymarket relayer `relay-payload` 自动解析用户钱包对应的 proxy / Safe funder，前端不应要求用户手工填写 funder 地址。

响应：

```ts
type PrepareSignatureResult = {
  intentId: string;
  executionMode: "dry_run" | "real";
  signingStatus: "ready" | "not_required" | "unavailable";
  protocol: "dry_run_no_signature" | "polymarket_clob_eip712_v2";
  expiresAt: string | null;
  payloads: {
    orderId: string;
    protocol: "polymarket_clob_eip712_v2";
    orderType: "GTC" | "GTD" | "FOK" | "FAK";
    signatureType: 0 | 1 | 2 | 3;
    makerAddress: string;
    signerAddress: string;
    funderAddress: string | null;
    eip712: {
      primaryType: "Order";
      domain: {
        name: "Polymarket CTF Exchange";
        version: "2";
        chainId: number;
        verifyingContract: string;
      };
      types: {
        Order: { name: string; type: string }[];
      };
      message: Record<string, string | number>;
    };
  }[];
  error: string | null;
};
```

### `POST /orders/submit`

请求：

```json
{
  "intentId": "intent_x",
  "executionMode": "real",
  "idempotencyKey": "uuid-from-client",
  "signedOrders": [
    {
      "orderId": "order_x",
      "signature": "0x..."
    }
  ]
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

`openOrdersValue` 只统计已经提交但未完全结束的订单，例如 `submitted`、`partially_filled`。`preview_ready` 和 `user_confirming` 只代表预览或确认中，不能计入资产敞口。现金余额源未接通时，`cashAvailable=null` 且 summary 必须返回 `capability="degraded"` 或 `capability="unavailable"`；不能因为 Data API 可配置就把空 summary 伪造成 `available`。没有本地持仓和订单时，summary 必须结合最近一次 positions sync 状态区分“未同步”“同步失败”和“已同步为空”。

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

触发当前登录用户的钱包持仓同步。后端从 Polymarket Data API 拉取公开 positions 数据，按 `clobTokenId` 关联本地 outcome，按 `conditionId` 辅助关联 market。同步结果写入本地 `ExternalPosition`，读取接口仍然只读本地数据库。`POLYMARKET_DATA_API_ENABLED=false` 时，该接口返回 `503 CAPABILITY_UNAVAILABLE`，不会访问外部 Data API；上游失败响应不得把钱包地址 query 参数暴露给前端。

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

`mode` 支持：

- `full`：全量 event discovery，用于发现所有活跃市场，并在完整跑完后执行 stale cleanup。
- `incremental`：按 Gamma markets 分页刷新一批活跃市场。
- `hot`：高频热市场刷新。它会拉 Polymarket 热门 event 的 markets，并精准刷新本地近期订单、近期脚本和高成交 market；不会执行 stale cleanup。热刷新必须为用户相关市场保留容量，不能被热门 event 批量 markets 完全挤掉。

手动触发必须与后台调度共用同一个 in-process running guard、分布式锁和 heartbeat；如果已有同步运行，返回 `409 POLYMARKET_SYNC_ALREADY_RUNNING` 或 `409 POLYMARKET_SYNC_LOCK_UNAVAILABLE`，不得绕过调度器直接并发写入。

推荐生产调度：

```text
POLYMARKET_MARKET_SYNC_MODE=full
POLYMARKET_MARKET_SYNC_INTERVAL_MS=21600000
POLYMARKET_MARKET_SYNC_RUN_ON_STARTUP=true
POLYMARKET_HOT_MARKET_SYNC_ENABLED=true
POLYMARKET_HOT_MARKET_SYNC_INTERVAL_MS=300000
POLYMARKET_HOT_MARKET_SYNC_LIMIT=250
POLYMARKET_HOT_MARKET_SYNC_EVENT_LIMIT=50
```

### `GET /internal/sync/runs`

查看同步任务历史。

查询参数：
```text
jobType
scope
status=running|completed|failed
cursor
limit
```

`cursor` 为服务端返回的 opaque cursor，按 `startedAt desc, id asc` 稳定分页。`limit` 默认 50，最大 100。

响应：
```ts
type SyncRunsResponse = {
  items: SyncRunItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

type SyncRunItem = {
  id: string;
  jobType: string;
  scope: string;
  status: "running" | "completed" | "failed";
  fetchedCount: number;
  upsertedCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
};
```

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
