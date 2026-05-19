# Causeway 一期开发里程碑与任务拆分

## 1. 目标

本文件用于把 Causeway 一期拆成可执行开发任务。推荐按 P0 到 P5 顺序推进，每个阶段必须有可验收产物。

## 2. 阶段总览

```text
P0 项目重命名与基础设施
P1 钱包登录与 Polymarket 本地同步
P2 市场网络与市场详情
P3 AI 推演与因果脚本
P4 订单预览与下单闭环
P5 资产组合、监控和验收
```

## 3. P0 项目重命名与基础设施

目标：把代码和文档从 ScriptFlow 语义迁移到 Causeway 语义，建立开发基线。

任务：

- 更新 package 名称、页面品牌名、基础文案。
- 保留旧文档，但开发入口指向 `docs/causeway`。
- 确认 monorepo 命令：web、api、db migrate、seed。
- 新建 Causeway 版 Prisma schema 初稿。
- 增加 `.env.example` 中 Polymarket、钱包登录、AI 模型相关配置。

验收：

- `pnpm dev:web` 可启动前端。
- `pnpm dev:api` 可启动后端。
- 页面品牌显示 Causeway。
- 新数据库迁移可以在空库执行。

## 4. P1 钱包登录与 Polymarket 本地同步

目标：用户可以连接钱包，后端可以同步并标准化 Polymarket 市场。

前端任务：

- 集成 RainbowKit、wagmi、viem。
- 实现连接钱包按钮。
- 实现 Polygon 链检查。
- 实现签名登录流程。

后端任务：

- `POST /auth/nonce`
- `POST /auth/verify`
- `PolymarketSyncModule`
- Gamma Events / Markets 同步任务。
- outcomes、outcomePrices、clobTokenIds 解析入库。
- sync run 记录。

验收：

- 用户能用钱包登录。
- 数据库有 Event / Market / Outcome。
- 至少同步 1000 个 active markets。
- outcome token 与价格按 index 正确对应。

## 5. P2 市场网络与市场详情

目标：用户可以浏览本地市场库，并选择根 outcome。

前端任务：

- 市场网络首页。
- 搜索、分类筛选、热门筛选。
- 市场节点卡片。
- 市场详情页。
- outcome token 选择区。

后端任务：

- `GET /markets`
- `GET /markets/:marketId`
- `GET /markets/network`（`/market-network` 仅兼容旧版前端）
- 热门市场和网络边计算任务。
- 市场详情相关市场查询。

验收：

- 首页只读本地数据库，不直接打 Polymarket。
- 市场详情能展示非 Yes/No outcome，例如 Over/Under、Team A/Team B。
- 未选择 outcome 时不能开始推演。

## 6. P3 AI 推演与因果脚本

目标：用户可以基于根 outcome 发起最多 3 层 AI 推演，并得到可编辑因果脚本。

前端任务：

- AI 推演设置页。
- 推演过程页。
- 因果脚本页。
- 图谱展示。
- outcome 选择表格。
- 用户手动编辑 outcome、订单模式、数量、金额、限价、是否参与。

后端任务：

- `POST /inference-runs`
- `GET /inference-runs/:runId`
- 候选市场召回。
- AI prompt 构造。
- structured JSON 输出校验。
- 推演缓存。
- `GET /scripts/:scriptId`
- `PATCH /scripts/:scriptId/outcome-selections/:selectionId`

验收：

- 1 层、2 层、3 层都能生成结果。
- AI 输出只引用候选市场中存在的 market/outcome。
- 缓存命中时不重新调用 AI。
- 缓存命中后仍刷新市场价格和可交易状态。
- 用户修改会进入审计日志。

## 7. P4 订单预览与下单闭环

目标：用户可以把因果脚本中的 outcome 生成订单，完成市价/限价输入、订单预览、用户确认和状态回写。真实 CLOB 调通后接入 `real` 模式；未调通时不阻塞前端和 `dry_run` 闭环。

开发口径：P4 先保证 `dry_run/real` API 协议一致可用。真实 CLOB 能力如果尚未完全跑通，`real` 模式必须返回结构化 capability 错误，不能阻塞前端联调和订单确认页开发。

前端任务：

- 单个 outcome 下单入口。
- 批量生成订单入口。
- 订单确认页。
- 市价 / 限价切换。
- 数量、金额、限价输入。
- `+10`、`+100`、`-10`、`-100` 快捷数量调整。
- 价格加减控制。
- 金额输入和平均分配。
- 风险提示、失败项展示。

后端任务：

- `GET /markets/:marketId/orderbook`
- `POST /orders/preview`
- `POST /orders/prepare-signature`
- `POST /orders/submit`
- `GET /orders/intents/:intentId`
- CLOB SDK 接入，作为 `real` capability 增量能力。
- tick size 校验。
- min order size 校验。
- cash 校验。
- 预览过期和提交幂等。
- 订单状态持久化。

并行 Spike：

- 跑通最小真实下单链路。
- 明确签名流程。
- 明确 cash / positions 数据来源。

验收：

- 下单前一定刷新 order book。
- 无用户确认不能提交订单。
- `dry_run` 能完整生成订单、确认、回写本地状态。
- `real` 能力可用时，订单成功后保存 external order id。
- 部分失败时成功和失败都能展示。
- CLOB 不可用时 `real` 提交被禁止。
- 真实 CLOB 能力不可用时，`dry_run` 仍可完整跑通订单确认和本地订单状态。

## 8. P5 资产组合、监控和验收

目标：用户能看到交易后的资产和脚本状态。

前端任务：

- 资产组合页。
- 现金余额卡片。
- 当前持仓表。
- 未成交订单表。
- 历史交易表。
- 监控追踪页。

后端任务：

- `GET /portfolio/summary`
- `GET /portfolio/positions`
- `GET /portfolio/orders`
- `GET /portfolio/trades`
- 持仓同步任务。
- 订单状态刷新任务。
- 监控脚本市场价格变化。

验收：

- 真实下单后能在订单列表看到。
- 持仓或未成交订单能反映最新状态。
- 脚本相关市场价格变化能刷新。

## 9. 开发依赖关系

```text
P1 钱包登录 -> P4 订单确认和用户级订单状态
P1 市场同步 -> P2 市场网络 -> P3 AI 推演
P3 因果脚本 -> P4 订单预览
P4 下单闭环 -> P5 资产组合
```

不能跳过：

- 没有 `PolymarketOutcome` 表，不能做下单。
- 没有 order book 刷新或可用的降级 capability，不能做订单预览。
- 没有登录签名，不能做用户级脚本和订单。

## 10. 推荐开发顺序

1. 数据库迁移。
2. Polymarket 同步脚本。
3. 市场列表 API。
4. 钱包登录。
5. 市场网络首页。
6. 市场详情和根 outcome 选择。
7. AI 推演设置和任务状态。
8. AI 输出校验和因果脚本。
9. 订单输入和预览。
10. `dry_run` 下单闭环。
11. 真实下单 Spike 和 `real` capability 接入。
12. 资产组合。

## 11. 最小演示路径

一期 Demo 必须跑通：

```text
连接钱包
-> 市场网络
-> 市场详情
-> 选择 root outcome
-> AI 推演设置
-> 因果脚本
-> 调整 outcome
-> 订单预览
-> 用户确认
-> dry_run 下单或 real capability 可用时真实下单
-> 资产组合查看订单/持仓
```

## 12. 不进入一期的任务

- 新闻/社交媒体/宏观数据源。
- 自动交易。
- 卖出和平仓。
- 复杂资金分配策略。
- 移动端深度适配。
- 多账户团队协作。
