# Causeway 后端实现与测试计划

## 1. 目标

本计划用于指导当前 NestJS 后端基础之后的开发。后续后端开发应按测试门槛推进，而不是依赖手动验证或临时接口。

后端最终目标：

- 为前端提供稳定 API 契约。
- 所有已暴露产品接口都必须有数据库支撑。
- 未完成的外部能力必须返回明确 capability 状态，不能伪造成功。
- 订单链路必须支持用户确认、预览过期、幂等提交和审计。
- 本地和 CI 都能重复执行安装、迁移、构建、测试和安全检查。

## 2. 当前基线

当前 `feature/backend-v1` 已建立：

- `apps/api` NestJS 后端工程。
- Prisma 领域模型。
- 根目录 npm workspace 和 web/api 脚本。
- 钱包 nonce/signature 登录、JWT guard、internal token guard。
- Polymarket Gamma 同步基础。
- DB-backed markets、scripts、orders、portfolio、sync 服务边界。
- `dry_run` 订单预览、提交和幂等基础。
- AI、CLOB orderbook、real trading 的明确 unavailable capability。
- API build、lint、test、audit 验证。

任何后续任务开始前，基线必须保持绿色：

```powershell
npm run db:generate
npm run build:api
npm run lint:api
npm run test:api
npm audit --omit=dev
```

## 3. 开发规则

每个后端任务按以下顺序执行：

1. 先写或更新测试，定义目标行为。
2. 实现最小但生产级的代码改动。
3. 运行相关聚焦测试。
4. 运行完整后端门禁。
5. 如果 API 对外契约变化，同步更新接口文档和契约测试。

禁止合入以下代码：

- 未完成能力返回假成功。
- 需要手动改数据库才能通过测试。
- 改变响应结构但不更新契约测试。
- 默认测试直接调用真实 Polymarket、AI 或 CLOB。
- 用户级接口绕过鉴权或所有权校验。
- 订单提交没有幂等和所有权保护。

## 4. 测试分层

### 4.1 Unit Tests

覆盖范围：

- 纯函数。
- DTO 校验辅助逻辑。
- normalizer、mapper。
- 订单预览计算。
- 幂等 hash。
- capability 决策。

要求：

- 不访问网络。
- 不访问真实数据库。
- 足够快，适合每次改动都运行。

当前命令：

```powershell
npm run test:api
```

后续可拆分：

```powershell
npm run test:api:unit
```

### 4.2 Integration Tests

覆盖范围：

- Prisma service/repository。
- 事务行为。
- 唯一约束和幂等约束。
- migration 兼容性。
- sync upsert 行为。

要求：

- 使用专用 test database，不能使用开发库或生产库。
- 使用确定性 fixture seed。
- 每个测试之间必须清理数据。

后续命令：

```powershell
npm run test:api:integration
```

### 4.3 API E2E Tests

覆盖范围：

- Nest HTTP route。
- public/protected/internal 路由边界。
- `data/error + requestId` 响应 envelope。
- 前端依赖的 API 契约。
- 用户所有权隔离。

要求：

- 使用 Supertest 启动 Nest app。
- 外部 client 必须 mock。
- 断言 status code、响应 envelope、错误码和关键字段。

后续命令：

```powershell
npm run test:api:e2e
```

### 4.4 Contract Tests

覆盖范围：

- `causeway-api-contract.md` 中的稳定请求/响应。
- market list/detail。
- inference run。
- script。
- order preview/submit。
- portfolio。

要求：

- 响应结构变化必须同一 PR 更新接口文档和契约测试。
- fixture 要小而真实，覆盖二元市场和多 outcome 市场。

### 4.5 External Smoke Tests

覆盖范围：

- 真实 Polymarket Gamma read。
- 真实 CLOB health/orderbook read。
- AI provider availability。
- 真实下单 Spike。

要求：

- 不进入默认 unit/e2e 命令。
- 必须通过显式环境变量 opt-in。
- 真实下单只能使用专用测试钱包。

后续命令：

```powershell
npm run smoke:api:polymarket
npm run smoke:api:ai
npm run smoke:api:real-orders
```

## 5. 全局完成标准

每个阶段完成前必须满足：

- `npm run build:api` 通过。
- `npm run lint:api` 通过。
- 相关 unit/integration/e2e 测试通过。
- `npm audit --omit=dev` 没有生产依赖漏洞；如有例外，必须记录原因和缓解方案。
- 公开 API 行为已同步到文档。
- 错误响应使用结构化错误码。
- 用户级数据必须经过 auth 和 ownership 校验。

## 6. 阶段计划

### B0：后端基线加固

状态：当前分支基本完成。

交付物：

- workspace 脚本。
- API build/lint/test/audit pipeline。
- Prisma client generation。
- 全局 auth、internal auth、request id、error envelope。
- 关键纯函数单测。

退出门槛：

```powershell
npm install
npm run db:generate
npm run build:api
npm run lint:api
npm run test:api
npm audit --omit=dev
```

### B1：数据库迁移与测试基础设施

目标：把 Prisma schema 变成可执行 migration，并建立可靠测试基础。

交付物：

- 初始 Prisma migration。
- test database 配置说明。
- User、Event、Market、Outcome、Script、Selection seed fixture。
- Prisma integration test helper。
- Nest e2e test helper。

先写测试：

- 空库可以成功 migrate。
- seed 可以创建完整最小业务数据。
- duplicate wallet session、outcome token、idempotency key 被约束拒绝。
- Prisma service 可以正常 connect/disconnect。

退出门槛：

- `npm run db:migrate` 可在本地空库执行。
- integration tests 能创建并清理确定性数据。

### B2：认证与会话完善

目标：钱包登录达到生产可用标准。

交付物：

- nonce 创建、过期、一次性消费。
- 钱包签名校验。
- JWT 签发和校验。
- supported chain 校验。
- protected route 注入 `CurrentUser`。
- auth audit event。

先写测试：

- `POST /auth/nonce` 写入 nonce 和过期时间。
- `POST /auth/verify` 拒绝过期 nonce。
- `POST /auth/verify` 拒绝复用 nonce。
- `POST /auth/verify` 拒绝错误签名。
- protected route 拒绝缺失/无效/过期 JWT。
- internal route 拒绝缺失/错误 internal token。

退出门槛：

- 所有用户级接口默认受保护。
- public route 必须显式标记。

### B3：Polymarket 市场同步

目标：把 Polymarket 市场数据同步到本地标准化表。

交付物：

- Gamma pagination。
- timeout/retry。
- Event/Market/Outcome 标准化。
- 按稳定 external id upsert。
- SyncRun 进度和失败记录。
- fixture-based sync tests。

先写测试：

- `outcomes/outcomePrices/clobTokenIds` 按 index 对齐。
- 已存在 market 更新时不重复创建 outcome。
- sync 失败会写入 `SyncRun.failed`。
- 429/5xx retry 次数有上限。
- 异常 payload 被跳过或返回结构化失败原因。

退出门槛：

- 本地可同步至少 1000 个 active markets。
- market/outcome API 只读取本地数据库。

### B4：Market API 与市场网络

目标：支撑前端市场首页和详情页。

交付物：

- `GET /markets` 搜索、筛选、排序、cursor pagination。
- `GET /markets/:marketId`。
- `GET /markets/by-slug/:slug`。
- `GET /market-network`。
- 网络节点/边生成任务或确定性本地生成策略。

先写测试：

- market list 支持 `active`、`closed`、`limit`、`cursor`、`sort`。
- `q` 匹配 question/slug/description。
- market detail 包含所有 outcome，包括非 Yes/No 市场。
- 缺失 market 返回 `MARKET_NOT_FOUND`。
- market network 返回稳定 shape。

退出门槛：

- 前端市场首页和详情页不直接调用 Polymarket。

### B5：AI 推演与因果脚本

目标：实现 inference run 生命周期并生成可编辑脚本。

交付物：

- candidate market retrieval。
- prompt input builder。
- AI client adapter。
- structured output validation。
- inference cache。
- `InferenceRun` 状态流转。
- `CausalScript`、`ScriptMarket`、`ScriptOutcomeSelection` 持久化。
- script retrieve/edit。

先写测试：

- candidate retrieval 不返回不存在的 outcome。
- AI 输出引用未知 market/outcome 会被拒绝。
- 相同输入生成稳定 cache key。
- cache hit 后仍刷新价格和可交易状态。
- AI 失败会记录 `InferenceRun.failed`。
- script retrieval 校验用户所有权。
- selection patch 写入 audit event。

退出门槛：

- mocked AI response 可以生成完整可编辑脚本。

### B6：Dry-run 订单闭环

目标：为前端下单体验提供完整可靠的 dry-run 后端闭环。

交付物：

- script selection 所有权校验。
- market/limit order 校验。
- amount/size 计算。
- tick size 和 min order size 校验。
- preview TTL。
- dry-run submit。
- idempotency conflict。
- order intent detail。
- portfolio local order visibility。

先写测试：

- preview 拒绝非用户脚本中的 selection。
- limit order 必须有合法 limit price。
- market order 缺少 orderbook/price 返回 `ORDERBOOK_UNAVAILABLE`。
- 低于 min size 返回 `BELOW_MIN_ORDER_SIZE`。
- preview 写入 `OrderIntent` 和 `CausewayOrder`。
- preview 过期后 submit 返回 `ORDER_PREVIEW_EXPIRED`。
- 同一 `idempotencyKey` 重复提交返回第一次结果。
- 同一 `idempotencyKey` 但请求体不同返回 `IDEMPOTENCY_CONFLICT`。
- dry-run order 出现在 portfolio orders。

退出门槛：

- 前端可以完成 `preview -> confirm -> dry_run submit -> portfolio order`。

### B7：Portfolio 与监控

目标：提供用户级订单、持仓和监控视图。

交付物：

- portfolio summary。
- local orders list。
- external positions sync adapter。
- trades/history capability state。
- order status refresh job boundary。
- script monitoring refresh boundary。

先写测试：

- portfolio endpoints 必须登录。
- summary 只统计当前用户数据。
- orders status filter 正确。
- positions 可以从外部 payload 映射到标准字段。
- 未接通数据源返回 capability state，不返回假数值。

退出门槛：

- 用户可以查看本地 dry-run 订单和已同步外部持仓，无跨用户泄漏。

### B8：真实下单 Spike 与 capability 升级

目标：dry-run 协议稳定后，再验证并接入真实 CLOB 下单。

交付物：

- 官方 SDK/API 版本和方案结论。
- 前端签名或其他批准的签名架构。
- orderbook read。
- real `prepare-signature` payload。
- real submit。
- external order id 持久化。
- open order/status refresh。
- 是否支持 cancel order 的结论。

先写测试：

- capability unavailable 时 real order 被阻断。
- capability available 时 `prepare-signature` 返回确定 payload shape。
- submit 可以记录部分失败。
- external order id 被持久化。
- status refresh 更新本地订单状态。

Smoke 测试要求：

- 只使用专用测试钱包。
- 使用最小安全订单金额。
- 必须人工确认。
- 默认 CI 不执行。

退出门槛：

- 真实下单 Spike 结论已记录。
- `real` 模式只能在环境变量和依赖能力完整时开启。

### B9：生产就绪

目标：让后端具备部署和运行条件。

交付物：

- CI pipeline。
- 环境矩阵。
- structured logging。
- request audit coverage。
- rate limits。
- health/readiness endpoints。
- DB migration deployment procedure。
- backup/restore expectation。
- error monitoring integration。

先写测试：

- health endpoint public。
- DB 不可用时 readiness fail。
- rate limit 返回 `RATE_LIMITED`。
- error envelope 不泄漏敏感值。
- production env validation 拒绝弱 secret。

退出门槛：

- 新机器可以按文档完成 install、migrate、test、build、run。

## 7. 推荐开发顺序

1. B1 数据库迁移与测试基础设施。
2. B2 auth/session integration tests。
3. B3 Polymarket sync fixtures。
4. B4 market APIs 和 pagination。
5. B5 inference run 与 script persistence。
6. B6 dry-run order lifecycle e2e。
7. B7 portfolio 与 monitoring reads。
8. B8 real order Spike。
9. B9 production hardening。

## 8. PR 检查清单

每个后端 PR 必须回答：

- 改了什么 API 行为？
- 哪些测试证明行为正确？
- 是否涉及 auth、ownership、order idempotency 或资金相关字段？
- 新增外部调用是否已在默认测试中 mock？
- 是否改变 public response shape？
- Prisma schema 是否变化，是否有 migration？
- 未完成集成是否返回明确 capability？

review 前必须执行：

```powershell
npm run db:generate
npm run build:api
npm run lint:api
npm run test:api
npm audit --omit=dev
```

integration/e2e 命令补齐后，受影响阶段必须执行对应命令。

## 9. 测试数据策略

使用确定性 fixture：

- `user_1`：已登录钱包用户。
- `user_2`：跨用户隔离检查。
- `event_election`：包含多个相关市场的 event。
- `market_binary`：Yes/No 市场。
- `market_multi_outcome`：非 Yes/No 市场。
- `market_closed`：已关闭市场。
- `market_not_tradable`：active 但不可下单市场。
- `script_1`：用户拥有的因果脚本，含两个 selections。
- `intent_1`：preview-ready dry-run intent。

fixture 必须由 seed helper 创建，不能手工复制到测试里。

## 10. 安全底线

- AI 永远不能提交订单。
- 任何 submit 前必须有用户确认。
- real order 默认关闭，除非 capability 明确 available。
- 后端永远不保存用户私钥。
- `orders/submit` 必须有 idempotency key。
- 跨用户访问必须返回 not found 或 auth failure。
- 外部未知字段可以保存到 `rawPayload`，但不能未经校验直接信任。
- 生产环境启动必须校验 secret 强度和必要配置。
