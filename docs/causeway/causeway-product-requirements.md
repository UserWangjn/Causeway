# Causeway 产品需求与开发口径

## 1. 产品定位

Causeway 是一个面向 Polymarket 的 AI 因果推演与交易辅助工具。用户从本地同步的 Polymarket 市场网络中选择一个根市场和根 outcome，Causeway 基于该假设生成最多 3 层的因果脚本，映射到真实可交易的 Polymarket outcome token，并允许用户审核、调整、单独下单或批量生成订单。

一期前端和后端协议必须支持完整下单闭环，但真实 CLOB 接入不作为前端并行开发的阻塞项。订单流程必须有预览、用户确认、风控结果和本地状态回写；真实 CLOB 能力可在实际开发阶段按 capability 状态接入。任何情况下都不允许 AI 绕过用户确认直接提交交易。

## 2. 已确认产品决策

- 产品名：Causeway。
- 前端：Next.js App Router，参考现有原型图，高仿 Polymarket 风格。
- 后端：TypeScript，基于当前 NestJS monorepo 方向继续开发。
- 登录：钱包登录，使用 RainbowKit + wagmi + viem。
- 市场首页：只展示本地数据库中的 Polymarket 市场，本地数据库由定时同步任务刷新。
- AI 推演：一期只基于 Polymarket 市场数据，不接入新闻、社交媒体、宏观外部信息源。
- 推演深度：一期最多 3 层。
- 交易：一期接口支持稳定的订单协议和前端下单体验，必须有订单预览、用户确认、风控校验、结果回写；真实 CLOB 能力未完全接通时使用 capability 状态降级到 `dry_run`，保证前后端协议一致可联调。
- 下单 UX：支持市价和限价；用户可以填写数量或金额；数量和价格支持步进按钮，例如 `+10`、`+100`、`-10`、`-100`，价格也支持加减调整，交互参考 Polymarket 官方下单面板。
- 资产组合：展示现金余额、持仓、未成交订单、历史订单、总盈亏。
- 推演缓存：短时间内完全相同的推演请求可以复用 AI 结果，避免重复消耗；但价格、订单簿、可交易状态必须实时刷新。

## 3. 核心概念

### 3.1 Event

Polymarket Event 是一组相关 Market 的集合。例如“2026 FIFA World Cup Winner”是一个 Event，内部可能有很多候选国家对应的 Market。

### 3.2 Market

Market 是 Causeway 的核心分析和交易单元。每个 Market 有一个 `conditionId`，并包含多个 outcome token。官方文档倾向将 Market 描述为二元市场，但真实 Gamma 数据和 CLOB token 模型要求我们不能把 outcome 文案写死为 `Yes/No`。

开发约束：任何交易选择都必须基于 `outcome + tokenId`，不能基于 `Yes/No` 字符串假设。

### 3.3 Outcome Token

Outcome token 是真实下单对象。Gamma API 中 `outcomes`、`outcomePrices`、`clobTokenIds` 按数组下标一一对应。CLOB 下单使用 token ID。

示例 outcome 类型：

- `Yes / No`：政治、宏观、普通事件判断。
- `Team A / Team B`：体育或电竞胜负。
- `Over / Under`：总分、击杀数、价格区间等大小盘。
- `Odd / Even`：奇偶盘。
- 多市场 Event：如冠军、候选人、价格区间，每个选项通常是一个 Market，各 Market 内仍有 outcome token。

### 3.4 根假设

用户进入推演前必须选择：

- 根 Event 或 Market。
- 根 Market。
- 根 outcome token。

示例：

```text
Event: 2028 Presidential Election Winner
Market: Will Donald Trump win the 2028 US Presidential Election?
Root outcome: Yes
```

或：

```text
Event: LoL: Hanwha Life Esports vs KT Rolster
Market: Match Winner
Root outcome: Hanwha Life Esports
```

后续所有 AI 推演都必须基于这个明确假设，而不是只基于市场标题。

## 4. 主用户流程

1. 用户连接钱包登录 Causeway。
2. 进入 `市场网络` 首页。
3. 浏览、搜索、筛选本地数据库中的 Polymarket 市场。
4. 点击市场进入 `市场详情`。
5. 在市场详情页选择根 outcome token。
6. 点击 `设定为推演根节点`。
7. 进入 `AI 推演设置`。
8. 设置推演层数、每层最大市场数、置信度阈值、时间范围、模型。
9. 系统生成推演请求指纹，检查是否命中推演缓存。
10. 未命中缓存时调用 AI；命中缓存时复用 AI 因果结果。
11. 后端刷新相关市场最新价格、订单簿、可交易状态。
12. 进入 `因果脚本` 页面。
13. 用户查看完整因果图、相关市场、每个市场的 outcome token、AI 默认选择。
14. 用户手动调整 outcome、订单模式、数量、金额、限价、是否参与。
15. 用户选择单独下单或批量生成订单。
16. 进入订单确认页，查看总成本、最大亏损、价格、滑点、订单类型、失败项。
17. 用户确认后按当前 execution mode 提交：`dry_run` 写入本地结果，`real` 在 CLOB 能力可用时提交 Polymarket。
18. 订单状态进入资产组合和脚本监控；真实能力不可用时仍能完整展示本地下单结果和 capability 原因。

## 5. 页面清单

### 5.1 市场网络

展示本地同步的 Polymarket 市场网络。节点基于 Event/Market 聚合，边基于标签、文本语义、历史价格相关性和 AI 推演结果生成。

核心操作：

- 搜索市场。
- 按分类、热度、成交量、到期时间筛选。
- 查看节点价格、成交量、趋势。
- 进入市场详情。

### 5.2 市场详情

展示单个 Event/Market 详情，重点新增 outcome 选择区。

必须展示：

- Event 标题和 Market 问题。
- outcome 列表。
- 每个 outcome 的价格、tokenId 后缀、best bid、best ask。
- 成交量、流动性、到期时间、规则、图标。
- `设定为推演根节点` 按钮。

### 5.3 AI 推演设置

展示根假设摘要，并配置推演参数。

字段：

- 根市场。
- 根 outcome token。
- 推演层数：1、2、3。
- 每层最大市场数。
- 置信度阈值。
- 时间范围。
- AI 模型。
- 是否允许使用缓存。

### 5.4 推演过程

展示任务进度：

1. 读取本地市场库。
2. 召回候选市场。
3. 构造 AI 输入。
4. AI 推演第 1 层。
5. AI 推演第 2/3 层。
6. 匹配真实 outcome token。
7. 刷新价格和订单簿。
8. 生成因果脚本。

### 5.5 因果脚本

这是一期最重要的页面。它不是单纯解释页，而是可执行交易脚本页。

必须展示：

- 因果图谱。
- 每个推演市场。
- 每个市场下的所有 outcome token。
- AI 推荐 outcome。
- AI 不推荐但仍可交易的 outcome。
- 置信度、影响方向、影响层级、理由。
- 用户选择状态：参与 / 不参与。
- 用户可编辑市价 / 限价模式、数量、金额、限价和订单类型。
- 单独下单和批量下单入口。
- `dry_run/real` 执行模式和真实交易能力状态。

### 5.6 订单确认

提交前的最后页面。

必须展示：

- 订单列表。
- tokenId、outcome、价格、数量、金额。
- 市价 / 限价模式。
- 限价价格输入和加减控制。
- 数量输入和快捷加减控制。
- 总成本。
- 最大亏损。
- 预估最大收益。
- 订单类型。
- 可用现金。
- 风控警告。
- 部分订单不可提交的原因。

### 5.7 资产组合

展示：

- Cash / 可用现金。
- Portfolio Value / 持仓总价值。
- Open Positions / 当前持仓。
- Open Orders / 未成交订单。
- Trade History / 历史订单。
- PnL / 盈亏。

### 5.8 监控追踪

展示保存后的因果脚本和下单组合，定时刷新市场价格、订单状态和推演结果是否过期。

## 6. 一期完成定义

- 可以完成钱包登录。
- 可以同步并展示 Polymarket 市场数据。
- 可以从市场详情选择根 outcome。
- 可以配置 1-3 层 AI 推演。
- 可以生成因果脚本和 outcome 级默认选择。
- 用户可以手动调整默认选择。
- 可以生成订单预览和用户确认订单。
- 可以在 `dry_run` 下完整回写本地订单状态；`real` 模式按 capability 接入真实 CLOB，不阻塞前端和后端协议联调。
- 可以查看资产组合、持仓、未成交订单、历史订单。
- 可以命中完全相同推演请求的短期缓存。

## 7. 暂不做

- 新闻、社交媒体、宏观外部数据源。
- 完全自动交易。
- 复杂策略回测。
- 移动端完整交易体验。一期只保证主流桌面浏览器体验。
- 自研钱包系统。
