# Causeway 数据库 Schema 文档

## 1. 目标

本文件定义 Causeway 一期开发所需的数据库模型。目标是支撑：

- 钱包登录与用户会话。
- Polymarket Event / Market / Outcome 本地同步。
- 市场网络展示。
- AI 推演任务、推演缓存和因果脚本。
- 用户手动调整 outcome 选择。
- 订单预览、真实下单、订单状态回写。
- 资产组合、持仓、未成交订单、交易历史。
- 审计日志。

当前仓库已有 ScriptFlow 版 Prisma schema，后续实现时应迁移到 Causeway 语义，不建议在旧 `Scenario / WatchBasket` 命名上继续扩展。

## 2. 命名原则

- Polymarket 官方字段保留 `external*` 或官方命名，例如 `conditionId`、`questionId`、`clobTokenId`。
- 内部主键统一使用 `String @id @default(uuid())`。
- 金额、价格、概率使用 `Decimal`。
- 原始官方 payload 必须保留在 `rawPayload Json`，便于排查字段变化。
- 所有交易相关表必须有 `createdAt`、`updatedAt`。
- Outcome 是一等表，不允许只存 JSON。

## 3. 枚举

```prisma
enum InferenceRunStatus {
  queued
  running
  completed
  failed
  cancelled
}

enum InferenceStage {
  candidate_retrieval
  ai_reasoning
  outcome_mapping
  market_refresh
  script_generation
}

enum ScriptStatus {
  draft
  active
  archived
}

enum ImpactDirection {
  supports
  opposes
  unclear
}

enum RelationType {
  causes
  supports
  hedges
  contradicts
  correlates
}

enum AiSelectionAction {
  buy
  avoid
}

enum UserSelectionAction {
  buy
  skip
}

enum OrderSide {
  BUY
}

enum ExecutionMode {
  dry_run
  real
}

enum OrderMode {
  market
  limit
}

enum OrderType {
  GTC
  GTD
  FOK
  FAK
}

enum OrderIntentStatus {
  draft
  preview_ready
  user_confirming
  dry_run_completed
  submitted
  partially_submitted
  failed
  cancelled
}

enum CausewayOrderStatus {
  preview_ready
  dry_run_completed
  submitted
  partially_filled
  filled
  cancelled
  failed
}

enum SyncRunStatus {
  running
  completed
  failed
}
```

## 4. 用户与登录

### 4.1 `User`

```prisma
model User {
  id            String          @id @default(uuid())
  walletAddress String          @unique
  displayName   String?
  avatarUrl      String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  sessions       WalletSession[]
  inferenceRuns  InferenceRun[]
  scripts        CausalScript[]
  orderIntents   OrderIntent[]
  orderSubmissions OrderSubmission[]
  auditEvents    AuditEvent[]
}
```

### 4.2 `WalletSession`

```prisma
model WalletSession {
  id            String   @id @default(uuid())
  userId        String?
  address       String
  chainId       Int
  nonce         String
  nonceExpiresAt DateTime
  verifiedAt    DateTime?
  sessionTokenHash String?
  sessionExpiresAt DateTime?
  createdAt     DateTime @default(now())
  user          User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([address, createdAt(sort: Desc)])
}
```

## 5. Polymarket 主数据

### 5.1 `PolymarketEvent`

```prisma
model PolymarketEvent {
  id              String              @id @default(uuid())
  externalEventId String              @unique
  slug            String?             @unique
  title           String
  description     String?
  image           String?
  icon            String?
  tags            Json
  active          Boolean
  closed          Boolean
  archived        Boolean             @default(false)
  restricted      Boolean?
  endDate         DateTime?
  volume          Decimal?
  liquidity       Decimal?
  openInterest    Decimal?
  rawPayload      Json
  syncedAt        DateTime
  markets         PolymarketMarket[]

  @@index([active, closed])
  @@index([volume])
  @@index([syncedAt])
}
```

### 5.2 `PolymarketMarket`

```prisma
model PolymarketMarket {
  id                    String              @id @default(uuid())
  eventId               String?
  externalMarketId      String?             @unique
  conditionId           String?             @unique
  questionId            String?
  slug                  String              @unique
  question              String
  description           String?
  rules                 String?
  image                 String?
  icon                  String?
  active                Boolean
  closed                Boolean
  archived              Boolean             @default(false)
  acceptingOrders       Boolean             @default(false)
  enableOrderBook       Boolean             @default(false)
  negRisk               Boolean             @default(false)
  orderMinSize          Decimal?
  orderPriceMinTickSize Decimal?
  bestBid               Decimal?
  bestAsk               Decimal?
  lastTradePrice        Decimal?
  spread                Decimal?
  volume                Decimal?
  volume24hr            Decimal?
  liquidity             Decimal?
  endDate               DateTime?
  rawPayload            Json
  discoveredAt          DateTime            @default(now())
  syncedAt              DateTime
  lastSeenAt            DateTime?
  staleDetectedAt       DateTime?
  staleReason           String?
  event                 PolymarketEvent?    @relation(fields: [eventId], references: [id], onDelete: SetNull)
  outcomes              PolymarketOutcome[]
  snapshots             MarketSnapshot[]
  scriptMarkets         ScriptMarket[]
  networkNodes          MarketNetworkNode[]
  orders                CausewayOrder[]

  @@index([active, closed, acceptingOrders, enableOrderBook])
  @@index([active, closed, archived, staleDetectedAt])
  @@index([volume24hr])
  @@index([endDate])
  @@index([discoveredAt])
  @@index([syncedAt])
  @@index([lastSeenAt])
  @@index([staleDetectedAt])
}
```

`rules` 存储前端可展示的规则/结算说明。Polymarket Gamma 当前大量市场没有独立 `rules` 字段，入库时会优先使用显式规则字段，没有时回填 `description`，并保留完整 `rawPayload` 便于后续字段升级。

### 5.3 `PolymarketOutcome`

`outcomeIndex` 必须对应 Gamma 返回的 `outcomes/outcomePrices/clobTokenIds` 数组下标。

```prisma
model PolymarketOutcome {
  id             String           @id @default(uuid())
  marketId       String
  outcomeIndex   Int
  label          String
  clobTokenId    String           @unique
  price          Decimal?
  bestBid        Decimal?
  bestAsk        Decimal?
  lastTradePrice Decimal?
  rawPayload     Json?
  syncedAt       DateTime
  market         PolymarketMarket @relation(fields: [marketId], references: [id], onDelete: Cascade)
  selections     ScriptOutcomeSelection[]
  orders         CausewayOrder[]
  snapshots      MarketSnapshot[]

  @@unique([marketId, outcomeIndex])
  @@index([marketId])
  @@index([label])
}
```

### 5.4 `MarketSnapshot`

```prisma
model MarketSnapshot {
  id             String           @id @default(uuid())
  marketId       String
  outcomeId      String?
  price          Decimal?
  bestBid        Decimal?
  bestAsk        Decimal?
  spread         Decimal?
  liquidity      Decimal?
  volume         Decimal?
  snapshotAt     DateTime
  market         PolymarketMarket @relation(fields: [marketId], references: [id], onDelete: Cascade)
  outcome        PolymarketOutcome? @relation(fields: [outcomeId], references: [id], onDelete: Cascade)

  @@index([marketId, snapshotAt(sort: Desc)])
  @@index([outcomeId, snapshotAt(sort: Desc)])
}
```

## 6. 市场网络

### 6.1 `MarketNetworkNode`

```prisma
model MarketNetworkNode {
  id          String           @id @default(uuid())
  marketId    String
  score       Decimal
  category    String?
  metadata    Json
  computedAt  DateTime
  market      PolymarketMarket @relation(fields: [marketId], references: [id], onDelete: Cascade)

  @@unique([marketId])
  @@index([score])
}
```

### 6.2 `MarketNetworkEdge`

```prisma
model MarketNetworkEdge {
  id             String   @id @default(uuid())
  sourceMarketId String
  targetMarketId String
  relationType   String
  weight         Decimal
  metadata       Json
  computedAt     DateTime

  @@unique([sourceMarketId, targetMarketId, relationType])
  @@index([sourceMarketId])
  @@index([targetMarketId])
}
```

## 7. AI 推演与缓存

### 7.1 `InferenceRun`

```prisma
model InferenceRun {
  id                  String             @id @default(uuid())
  userId              String
  rootEventId         String?
  rootMarketId        String
  rootOutcomeId       String
  rootClobTokenId     String
  depth               Int
  maxMarketsPerLayer  Int
  confidenceThreshold Decimal
  model               String
  promptVersion       String
  outputSchemaVersion String
  cacheEnabled        Boolean
  cacheKey            String
  cacheHit            Boolean            @default(false)
  status              InferenceRunStatus @default(queued)
  stage               InferenceStage?
  progress            Int                @default(0)
  inputJson           Json
  outputJson          Json?
  errorMessage        String?
  createdAt           DateTime           @default(now())
  completedAt         DateTime?
  user                User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  script              CausalScript?

  @@index([userId, createdAt(sort: Desc)])
  @@index([cacheKey])
  @@index([status, createdAt(sort: Desc)])
}
```

### 7.2 `InferenceCacheEntry`

```prisma
model InferenceCacheEntry {
  id                  String   @id @default(uuid())
  cacheKey            String   @unique
  model               String
  promptVersion       String
  outputSchemaVersion String
  inputHash           String
  outputHash          String
  resultJson          Json
  expiresAt           DateTime
  createdAt           DateTime @default(now())
  lastUsedAt          DateTime?
  useCount            Int      @default(0)

  @@index([expiresAt])
}
```

## 8. 因果脚本

### 8.1 `CausalScript`

```prisma
model CausalScript {
  id              String          @id @default(uuid())
  userId          String
  inferenceRunId  String          @unique
  title           String
  status          ScriptStatus    @default(draft)
  rootEventId     String?
  rootMarketId    String
  rootOutcomeId   String
  graphJson       Json
  summary         String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  user            User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  inferenceRun    InferenceRun    @relation(fields: [inferenceRunId], references: [id], onDelete: Cascade)
  markets         ScriptMarket[]
  orderIntents    OrderIntent[]

  @@index([userId, createdAt(sort: Desc)])
}
```

### 8.2 `ScriptMarket`

```prisma
model ScriptMarket {
  id                   String              @id @default(uuid())
  scriptId             String
  marketId             String
  parentScriptMarketId String?
  layer                Int
  impactDirection      ImpactDirection
  confidence           Decimal
  reason               String
  metadata             Json
  createdAt            DateTime            @default(now())
  script               CausalScript        @relation(fields: [scriptId], references: [id], onDelete: Cascade)
  market               PolymarketMarket    @relation(fields: [marketId], references: [id], onDelete: Cascade)
  selections           ScriptOutcomeSelection[]

  @@unique([scriptId, marketId])
  @@index([scriptId, layer])
}
```

### 8.3 `ScriptOutcomeSelection`

```prisma
model ScriptOutcomeSelection {
  id             String             @id @default(uuid())
  scriptMarketId String
  outcomeId      String
  aiAction       AiSelectionAction
  userAction     UserSelectionAction
  side           OrderSide          @default(BUY)
  orderMode      OrderMode          @default(limit)
  limitPrice     Decimal?
  size           Decimal?
  amountUsd      Decimal?
  confidence     Decimal?
  reason         String?
  updatedAt      DateTime           @updatedAt
  scriptMarket   ScriptMarket       @relation(fields: [scriptMarketId], references: [id], onDelete: Cascade)
  outcome        PolymarketOutcome  @relation(fields: [outcomeId], references: [id], onDelete: Cascade)
  orders         CausewayOrder[]

  @@unique([scriptMarketId, outcomeId])
  @@index([userAction])
}
```

## 9. 订单与资产

### 9.1 `OrderIntent`

```prisma
model OrderIntent {
  id             String            @id @default(uuid())
  userId         String
  scriptId       String
  status         OrderIntentStatus @default(draft)
  executionMode  ExecutionMode     @default(dry_run)
  totalAmountUsd Decimal
  cashAvailable  Decimal?
  tradingCapability String?
  tradingCapabilityReason String?
  balanceCapability String?
  balanceCapabilityReason String?
  previewJson    Json
  riskJson       Json
  previewExpiresAt DateTime?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  user           User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  script         CausalScript      @relation(fields: [scriptId], references: [id], onDelete: Cascade)
  orders         CausewayOrder[]
  submissions    OrderSubmission[]

  @@index([userId, createdAt(sort: Desc)])
  @@index([scriptId])
}
```

### 9.2 `CausewayOrder`

```prisma
model CausewayOrder {
  id               String              @id @default(uuid())
  orderIntentId    String
  selectionId      String?
  marketId         String
  outcomeId        String
  clobTokenId      String
  side             OrderSide
  orderMode        OrderMode
  orderType        OrderType?
  limitPrice       Decimal?
  estimatedFillPrice Decimal?
  size             Decimal
  amountUsd        Decimal
  externalOrderId  String?
  status           CausewayOrderStatus @default(preview_ready)
  submitPayload    Json?
  responsePayload  Json?
  errorMessage     String?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
  orderIntent      OrderIntent         @relation(fields: [orderIntentId], references: [id], onDelete: Cascade)
  selection        ScriptOutcomeSelection? @relation(fields: [selectionId], references: [id], onDelete: SetNull)
  market           PolymarketMarket    @relation(fields: [marketId], references: [id], onDelete: Restrict)
  outcome          PolymarketOutcome   @relation(fields: [outcomeId], references: [id], onDelete: Cascade)

  @@index([orderIntentId])
  @@index([selectionId])
  @@index([marketId])
  @@index([externalOrderId])
  @@index([status, createdAt(sort: Desc)])
}
```

### 9.3 `OrderSubmission`

用于实现 `POST /orders/submit` 的幂等。相同用户、相同订单意图、相同 `idempotencyKey` 必须返回第一次提交结果。

```prisma
model OrderSubmission {
  id             String        @id @default(uuid())
  userId         String
  orderIntentId  String
  idempotencyKey String
  requestHash    String
  status         String
  responseJson   Json?
  errorMessage   String?
  createdAt      DateTime      @default(now())
  user           User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  orderIntent    OrderIntent   @relation(fields: [orderIntentId], references: [id], onDelete: Cascade)

  @@unique([userId, orderIntentId, idempotencyKey])
  @@index([orderIntentId, createdAt(sort: Desc)])
}
```

### 9.4 `PortfolioSnapshot`

```prisma
model PortfolioSnapshot {
  id                  String   @id @default(uuid())
  userId              String
  walletAddress       String
  cashAvailable       Decimal?
  portfolioValue      Decimal?
  openPositionsValue  Decimal?
  openOrdersValue     Decimal?
  pnl                 Decimal?
  rawPayload          Json
  snapshotAt          DateTime

  @@index([userId, snapshotAt(sort: Desc)])
}
```

### 9.5 `ExternalPosition`

```prisma
model ExternalPosition {
  id             String   @id @default(uuid())
  userId         String
  marketId       String?
  outcomeId      String?
  clobTokenId    String
  size           Decimal
  avgPrice       Decimal?
  currentPrice   Decimal?
  currentValue   Decimal?
  pnl            Decimal?
  rawPayload     Json
  syncedAt       DateTime

  @@unique([userId, clobTokenId])
  @@index([userId, syncedAt(sort: Desc)])
}
```

## 10. 同步与审计

### 10.1 `SyncRun`

```prisma
model SyncRun {
  id            String        @id @default(uuid())
  jobType       String
  scope         String
  cursor        String?
  startedAt     DateTime      @default(now())
  finishedAt    DateTime?
  status        SyncRunStatus
  fetchedCount  Int           @default(0)
  upsertedCount Int           @default(0)
  error         String?
  metadata      Json

  @@index([jobType, startedAt(sort: Desc)])
  @@index([status, startedAt(sort: Desc)])
}
```

### 10.2 `SchedulerLock`

Used by default-disabled scheduled jobs to coordinate across multiple API instances.

```prisma
model SchedulerLock {
  name        String   @id
  ownerId     String
  lockedUntil DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([lockedUntil])
}
```

### 10.3 `AuditEvent`

```prisma
model AuditEvent {
  id         String   @id @default(uuid())
  userId     String?
  requestId  String?
  actorType  String
  entityType String
  entityId   String
  action     String
  before     Json?
  after      Json?
  reason     String?
  createdAt  DateTime @default(now())
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId, createdAt(sort: Desc)])
  @@index([requestId])
  @@index([entityType, entityId, createdAt(sort: Desc)])
}
```

## 11. 迁移步骤

建议分 5 个迁移提交：

1. 用户、钱包会话、审计表。
2. Polymarket Event / Market / Outcome / Snapshot 表。
3. 推演任务、缓存、因果脚本表。
4. 订单、资产组合、外部持仓表。
5. 市场网络节点和边表。

每一步迁移后都要更新 seed 数据和最小 API 验证。

## 12. 索引和性能要求

- 首页市场网络不得扫全表，应通过 `MarketNetworkNode` 和热门市场索引读取。
- `PolymarketOutcome.clobTokenId` 必须唯一。
- 订单提交前按 `clobTokenId` 查 outcome 必须是 O(log n)。
- 推演缓存按 `cacheKey` 命中，必须唯一索引。
- 高频快照表后续可按月分区，一期先普通索引。

## 13. 未决实现细节

- Portfolio 现金余额最终字段来源要在真实下单 Spike 中确认。
- Polymarket Data API 返回的 position 字段需要在接入时固化到 `ExternalPosition.rawPayload` 到结构字段的映射。
- 如果采用客户端签名、后端提交订单，需要新增 `SignedOrderPayload` 表或把签名 payload 放入 `CausewayOrder.submitPayload`。
- `CausewayOrder.clobTokenId` 是为了审计和查询冗余保存，创建订单时必须校验它等于 `PolymarketOutcome.clobTokenId`，且 `marketId` 等于 outcome 所属 market。
