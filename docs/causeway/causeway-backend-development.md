# Causeway 后端开发文档

## 1. 技术栈

- Language：TypeScript。
- Framework：NestJS。
- Database：PostgreSQL + Prisma。
- Jobs：P1 可先用 NestJS schedule；P3/P4 开始建议使用 BullMQ 或独立 worker 承载同步、AI 推演和订单状态刷新，避免长任务阻塞 API 进程。
- AI：后端直接调用模型 API；一期不再保留 Python AI sidecar 作为主路径。
- Polymarket：Gamma API + CLOB SDK/API + Data API。

## 2. 后端模块

```text
AuthModule
WalletModule
MarketsModule
PolymarketSyncModule
InferenceModule
ScriptsModule
OrdersModule
PortfolioModule
MonitorModule
AuditModule
```

## 3. 数据同步

市场网络首页只读本地数据库。后端必须定时同步 Polymarket 数据。

### 3.1 同步来源

- Gamma API：Events、Markets、tags、图片、规则、成交量、流动性、outcomes、outcomePrices、clobTokenIds。
- CLOB API/SDK：order book、best bid/ask、midpoint、spread、tick size、min order size、neg risk、price history。
- Data API：用户 positions、trades、activity。

### 3.2 同步频率

- Event/Market 主数据：5-15 分钟。
- 活跃市场价格：30-60 秒。
- 推演脚本涉及的重点市场：10-30 秒。
- 订单簿：下单预览时实时刷新。
- 用户资产组合：进入页面时刷新，之后 10-30 秒轮询或 WebSocket。

同步任务必须支持：

- 分页 cursor 和断点续跑。
- rate limit、重试和指数退避。
- 原始 payload 保存，字段变化时先不中断主流程。
- `SyncRun` 记录成功、失败、拉取数量和错误原因。
- 市场主数据同步失败时，前端仍可读取上一次成功同步的数据并展示过期状态。

## 4. 关键数据表

现有 Prisma schema 需要向 Causeway 语义迁移。建议新增或重命名如下表。

### 4.1 `users`

```text
id
walletAddress
createdAt
updatedAt
```

### 4.2 `wallet_sessions`

```text
id
userId
nonce
address
chainId
expiresAt
createdAt
```

### 4.3 `polymarket_events`

```text
id
externalEventId
slug
title
description
image
icon
tagsJson
active
closed
endDate
volume
liquidity
rawPayload
syncedAt
```

### 4.4 `polymarket_markets`

```text
id
eventId
externalMarketId
conditionId
questionId
slug
question
description
rules
image
icon
active
closed
acceptingOrders
enableOrderBook
negRisk
orderMinSize
orderPriceMinTickSize
bestBid
bestAsk
lastTradePrice
volume
liquidity
endDate
rawPayload
syncedAt
```

### 4.5 `polymarket_outcomes`

必须新增。不能只把 outcomes 放 JSON，否则下单和脚本编辑会很痛苦。

```text
id
marketId
outcomeIndex
label
tokenId
price
bestBid
bestAsk
lastTradePrice
rawPayload
syncedAt
```

### 4.6 `inference_runs`

```text
id
userId
rootEventId
rootMarketId
rootOutcomeId
rootTokenId
depth
maxMarketsPerLayer
confidenceThreshold
model
promptVersion
outputSchemaVersion
cacheEnabled
cacheKey
cacheHit
status
stage
progress
errorMessage
createdAt
completedAt
```

### 4.7 `inference_cache_entries`

```text
id
cacheKey
model
promptVersion
outputSchemaVersion
inputHash
outputHash
resultJson
expiresAt
createdAt
lastUsedAt
useCount
```

### 4.8 `causal_scripts`

```text
id
userId
inferenceRunId
title
status
rootMarketId
rootOutcomeId
graphJson
createdAt
updatedAt
```

### 4.9 `script_markets`

```text
id
scriptId
marketId
layer
parentScriptMarketId
impactDirection
confidence
reason
createdAt
```

### 4.10 `script_outcome_selections`

```text
id
scriptMarketId
outcomeId
aiAction       buy | avoid
userAction     buy | skip
side           BUY
orderMode      market | limit
limitPrice
size
amountUsd
confidence
reason
updatedAt
```

### 4.11 `order_intents`

```text
id
userId
scriptId
status
executionMode
totalAmountUsd
cashAvailable
tradingCapability
tradingCapabilityReason
balanceCapability
balanceCapabilityReason
previewJson
riskJson
previewExpiresAt
createdAt
updatedAt
```

### 4.12 `orders`

```text
id
orderIntentId
selectionId
marketId
outcomeId
tokenId
side
orderMode
orderType
limitPrice
estimatedFillPrice
size
amountUsd
externalOrderId
status
submitPayload
errorMessage
createdAt
updatedAt
```

### 4.13 `order_submissions`

```text
id
userId
orderIntentId
idempotencyKey
requestHash
status
responseJson
errorMessage
createdAt
```

## 5. 推演缓存设计

### 5.1 缓存目标

避免用户在短时间内对完全相同的根假设和参数重复调用 AI。

### 5.2 缓存命中条件

必须全部一致：

- rootMarketId
- rootOutcomeId 或 rootTokenId
- depth
- maxMarketsPerLayer
- confidenceThreshold
- candidate market set version
- promptVersion
- model
- temperature
- structured output schema version

### 5.3 不进入缓存键的内容

以下内容不进入 AI 缓存键，因为它们每次都要刷新：

- 当前 best bid / best ask。
- 当前 last trade price。
- 当前 accepting orders。
- 当前 cash balance。
- 当前 order book depth。

### 5.4 TTL

一期建议：

- 默认 30 分钟。
- 高成交量市场 10 分钟。
- 低成交量市场 60 分钟。
- 用户点击 `重新推演` 可绕过缓存。

### 5.5 缓存命中后的流程

1. 读取缓存 AI 结果。
2. 重新拉取所有相关 market/outcome 当前数据。
3. 重新校验可交易状态。
4. 重新生成订单预览。
5. 前端标记 `AI 结果来自缓存，市场价格已刷新`。

## 6. AI 推演任务

推演任务必须异步执行。API 创建任务后立即返回 `runId`，前端轮询或订阅任务状态。

状态：

```text
queued
running
completed
failed
cancelled
```

阶段：

```text
candidate_retrieval
ai_reasoning
outcome_mapping
market_refresh
script_generation
```

## 7. 交易执行

一期只支持 BUY。

交易 API 必须先实现一致协议，再接入真实 CLOB。真实 CLOB 调通不阻塞前端并行开发；即使真实下单、余额读取暂时不可用，后端也要支持 `dry_run`，并通过 capability 状态告诉前端当前真实能力是否可用。

后端职责：

- 校验用户登录和钱包地址。
- 校验 outcome token 存在且可交易。
- 刷新订单簿。
- 校验最小下单金额和 tick size。
- 支持市价和限价两种订单输入。
- 校验数量、金额、限价价格和订单模式。
- 生成预览，并返回刷新时间和过期时间。
- 只有 `real` 且 capability 可用时才生成签名 payload；不可用时返回结构化 capability 原因。
- 要求用户确认并提交；提交接口必须支持 idempotency key。
- `dry_run` 模式写入本地订单结果，不调用 Polymarket。
- `real` 模式调用 Polymarket CLOB SDK 下单。
- 记录订单状态。

注意：后端不能保存用户私钥。订单签名应通过用户钱包或安全的 CLOB 授权流程完成，具体实现必须在交易集成阶段单独核对 Polymarket 当前认证方式。

## 8. 风控规则

一期最小规则：

- 单笔金额必须大于等于市场最小下单金额。
- 单个脚本总金额不能超过用户可用现金。
- tokenId 必须属于当前 market。
- 市场必须 `active=true`、`closed=false`、`acceptingOrders=true`、`enableOrderBook=true`。
- 限价单价格必须符合 tick size。
- 市价单必须基于最新订单簿估算可成交数量、均价和滑点。
- 订单预览必须设置短 TTL，提交时过期则要求重新预览。
- 重复提交必须通过 `idempotencyKey` 返回首次结果，不能重复下单。
- 下单前必须刷新订单簿。
- 批量订单允许部分失败，但必须明确展示失败原因。

## 9. 审计

必须记录：

- 登录签名验证。
- 推演请求和缓存命中。
- AI 输出版本。
- 用户手动修改 outcome 选择。
- 订单预览。
- 订单提交。
- 订单失败原因。
- idempotency key 和 requestId。
