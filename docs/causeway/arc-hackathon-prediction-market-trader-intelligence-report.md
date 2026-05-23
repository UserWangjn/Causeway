# ARC 黑客松 Prediction Market Trader Intelligence 方向报告

日期：2026-05-23  
项目：Causeway  
目标：围绕 ARC 黑客松的 Prediction Market Trader Intelligence 方向，明确赛道理解、项目定位、最佳结合点、冲击第一名的产品策略与实施优先级。

## 1. 报告结论

Prediction Market Trader Intelligence 是本次 ARC 黑客松中最适合 Causeway 的方向。它要求项目不只是展示预测市场数据，也不只是用 AI 生成解释，而是让 AI 真正参与“发现机会、评估概率、判断风险、建议仓位、辅助执行、追踪结果”的完整交易智能流程。

Causeway 当前已经具备较好的基础：

- 已接入真实 Polymarket 市场数据。
- 已有市场网络和事件详情能力。
- 已有 AI 因果推演能力。
- 已有用户钱包登录和 Polymarket 下单链路。
- 已接入 Polymarket Builder Code，具备商业归因基础。
- 已有脚本保存、我的脚本、推演结果展示等产品模块。

最适合的黑客松定位是：

```text
Causeway: AI Prediction Market Intelligence & Execution Layer
```

也就是：

```text
全量市场数据 -> AI 概率推演 -> 价值机会识别 -> 风险和仓位建议 -> 用户确认交易 -> Builder Code 归因 -> 结果追踪
```

如果要冲击第一名，建议重点打造以下组合：

```text
AI 推演图 + Polymarket 真实交易 + Builder Code 归因 + Arc 可验证推演记录 + 信号绩效面板
```

这比单纯做一个 Polymarket 前端、AI 聊天助手或交易按钮更有竞争力。

## 2. 黑客松背景

本次活动是 Agora Agents Hackathon，由 Canteen、Circle、Arc 相关生态共同推动。活动主题聚焦 AI agents、市场、USDC 与 Arc。

核心方向是让 AI agent 可以在市场中执行更高级的行为，例如：

- 交易预测市场。
- 管理资金和仓位。
- 识别跨平台机会。
- 创建或参与新市场。
- 使用 USDC 和 Arc 完成低成本、高速度的结算或记录。

评审标准大致包括：

- Agentic Sophistication：AI 是否真的参与复杂决策，而不是简单自动化。
- Traction：是否有真实用户、真实交易、真实使用数据。
- Circle / Arc Tool Usage：是否有效使用 Circle、Arc、USDC、App Kit、Gateway、Contracts 等工具。
- Innovation：是否有新机制、新研究洞察或能产生真实市场价值的产品创新。

Causeway 最适合从 Prediction Market Trader Intelligence 切入，因为我们已经围绕 Polymarket、AI 推演、用户交易链路做了大量基础建设。

## 3. Prediction Market Trader Intelligence 是什么

Prediction Market Trader Intelligence 的核心不是“解释一个市场”，而是“帮助用户更聪明地交易预测市场”。

它应该完成以下任务：

- 扫描真实预测市场。
- 判断市场价格是否偏离真实概率。
- 识别可能存在正期望值的交易机会。
- 给出 AI 估计概率和市场隐含概率之间的差异。
- 判断流动性、价差、盘口深度、规则说明是否支持交易。
- 给出风险解释和仓位建议。
- 在用户确认后执行交易。
- 在交易后持续追踪订单、持仓、价格变化和最终结果。

一个成熟的输出不应该只是：

```text
建议买 Yes。
```

而应该是：

```text
Market odds: 42%
AI fair odds: 58%
Edge: +16%
Recommendation: Buy Yes
Suggested size: $12.50
Risk: Medium
Reason: 市场可能低估了某个关键因素
Exit condition: 当价格高于 0.66 或新信息推翻核心假设时重新评估
```

这类能力才符合 Trader Intelligence 的定位。

## 4. Causeway 的最佳产品定位

Causeway 不应该被包装成普通的预测市场浏览器。更强的定位是：

```text
面向预测市场的 AI 交易智能层。
```

用户进入 Causeway 后，不只是看到市场列表，而是看到：

- 哪些事件值得研究。
- 哪些市场可能被错误定价。
- AI 为什么认为这个市场有机会。
- 这个机会的风险在哪里。
- 应该买 Yes、买 No、观望还是避开。
- 如果交易，合理下单金额是多少。
- 交易后如何追踪表现。

这使 Causeway 从“信息展示工具”升级为“决策辅助和执行工具”。

## 5. 与当前项目的最佳结合点

### 5.1 全市场 AI 机会扫描器

基于我们已经同步的 Polymarket 市场，增加一个机会扫描层：

```text
marketProbability = 当前市场价格隐含概率
modelProbability = AI 估计真实概率
edge = modelProbability - marketProbability
```

前端新增类似 `AI Opportunities` 的入口，展示当前最值得研究或交易的市场。

每个机会卡片可以展示：

- 市场标题。
- 所属事件。
- 当前价格。
- AI 公允概率。
- Edge。
- 流动性状态。
- 推荐操作。
- 风险等级。

示例：

```text
Will X happen?
Market odds: 42%
AI fair odds: 58%
Edge: +16%
Action: Buy Yes
Suggested size: $12.50
Risk: Medium
```

这是最贴合 RFB 02 的能力。

### 5.2 AI 因果推演图作为核心差异化

很多团队会做“AI 推荐下注”，但 Causeway 已经有因果推演图，这是明显差异化。

建议把它包装成：

```text
Reasoning Graph for Prediction Markets
```

每个交易建议都应该对应一个结构化推演：

```text
Evidence -> Causal Factors -> Probability Shift -> Market Mispricing -> Trade Decision
```

这可以向评委证明：

- AI 不是只在生成文案。
- AI 有结构化推理过程。
- 用户可以理解每个交易建议背后的逻辑。
- 后续可以追踪 AI 推理是否正确。

### 5.3 多 Agent 决策流程

为了提高 Agentic Sophistication，建议将 AI 推演设计为多个角色协作，而不是单次 prompt 直接给结论。

推荐角色：

- Research Agent：收集市场、事件、规则和背景信息。
- Probability Agent：给出真实概率估计。
- Skeptic Agent：反驳交易理由，寻找漏洞。
- Risk Agent：判断流动性、价差、相关市场和最大损失。
- Execution Guard：判断是否允许进入下单流程。

最终输出应该是：

```text
BUY / WATCH / AVOID
```

并且很多市场应该返回 WATCH 或 AVOID。这会让系统显得更专业，而不是无脑推荐交易。

### 5.4 Kelly 或保守 Kelly 仓位建议

官方方向中提到了 Kelly Criterion。我们不需要做过度复杂的资金管理，但应该有一个保守版仓位模型。

可以设计为：

```text
rawKelly = (p * odds - (1 - p)) / odds
suggestedSize = min(rawKelly * bankroll * riskMultiplier, perMarketCap)
```

其中：

- `p` 是 AI 估计概率。
- `odds` 是市场赔率。
- `bankroll` 是用户设定的交易预算。
- `riskMultiplier` 根据 Conservative、Balanced、Aggressive 调整。
- `perMarketCap` 防止单一市场暴露过大。

前端展示：

```text
Suggested size: $12.50
Max loss: $12.50
Risk profile: Conservative
Reason: Edge is positive but confidence is medium.
```

### 5.5 事件维度组合风控

我们之前已经发现，预测市场很多时候应该按事件理解，而不是只按单个 market 理解。

例如：

```text
2026 FIFA World Cup Winner
- Will France win?
- Will Brazil win?
- Will Argentina win?
```

这些 market 互斥或高度相关。AI 不能孤立推荐多个 Yes。

建议增加事件维度风控：

- 标记同一事件下的互斥 outcome。
- 提醒用户多个仓位之间的相关性。
- 在 AI 推荐前检查用户是否已有相关暴露。
- 在事件详情里展示组合视角，而不是只展示单个市场视角。

这会显著提升产品成熟度。

### 5.6 AI Opportunities 排序

市场首页不应该只按 volume、liquidity 或 hot 排序。对黑客松来说，更有价值的是展示“值得 AI 研究和交易”的市场。

建议增加一个综合排序：

```text
score =
  liquidityScore
  + volumeScore
  + recencyScore
  + priceMovementScore
  + aiOpportunityScore
```

其中 `aiOpportunityScore` 来自：

- AI edge。
- confidence。
- 市场规则是否清晰。
- 盘口是否可交易。
- spread 是否合理。
- 是否有足够流动性。

最终首页可以优先展示：

```text
Hot
New
AI Opportunities
Sports
Crypto
Politics
...
```

也可以在黑客松 demo 中直接进入 `AI Opportunities`。

### 5.7 Builder Code 商业闭环

Polymarket Builder Code 是我们非常重要的商业化基础。

产品叙事可以是：

```text
AI agent 负责发现和解释机会。
用户保留钱包控制权，并亲自确认交易。
Causeway 只在真实交易发生时获得 Builder attribution。
```

这比订阅费更适合黑客松，因为它说明项目有真实商业闭环，而且和 prediction market 交易天然结合。

注意：Builder Code 不需要在前端对用户高调展示，但后端订单中必须稳定携带。

### 5.8 交易后追踪

下单成功不是结束。一个真正的 Trader Intelligence 产品必须追踪交易结果。

建议记录：

- 推荐时间。
- 推荐时市场价格。
- AI fair probability。
- 推荐方向。
- 推荐仓位。
- 用户实际下单价格。
- 当前价格。
- 是否成交。
- 未实现盈亏。
- 是否建议继续持有。
- 是否建议退出。
- 市场最终结果。
- AI 推荐是否正确。

这些数据可以形成：

```text
Signal Track Record
```

评委看到这个页面，会比只看 demo 更容易相信产品是真的。

### 5.9 AI 信号排行榜

建议新增公开或半公开的 AI 信号绩效页：

```text
Signal ID
Market
AI probability
Market probability
Edge
Recommendation
Executed volume
Current PnL
Resolved result
Accuracy
```

这可以成为 traction 和 performance 的证据。

如果短期没有足够多真实成交，也可以先展示：

- 已生成信号数量。
- 用户点击研究数量。
- 用户进入下单预览数量。
- 用户实际提交订单数量。
- 已成交订单数量。
- 已完成市场的预测准确率。

但要明确区分真实交易数据和内部模拟数据，不能混淆。

### 5.10 Arc 可验证推演记录

Arc 最适合的结合点不是强行替换 Polymarket 的交易链路，而是增强 AI 推演的可信度。

建议设计：

```text
每次 AI 生成交易建议时，保存完整 reasoning trace。
对 trace 生成 hash。
把 hash 写入 Arc testnet。
前端展示 Arc tx hash 或 proof hash。
```

产品叙事：

```text
Prediction market recommendations should be auditable.
Users can verify that Causeway did not rewrite historical reasoning after outcomes are known.
```

中文解释：

```text
预测市场推荐应该可审计。用户可以验证我们没有在结果出来后篡改历史推演。
```

这是一个非常适合 Arc 的使用场景，因为：

- 写入成本低。
- 速度快。
- 不影响现有 Polymarket 交易链路。
- 容易在 demo 中展示。
- 和 AI 推演可信度强相关。

### 5.11 USDC 微支付或高级信号解锁

如果时间允许，可以增加一个 Arc / Circle 的商业化 demo：

```text
基础市场推演免费。
高级 AI signal 或完整 reasoning trace 使用 USDC 小额支付解锁。
```

Arc 的低费用和 USDC 原生结算适合这种场景。

不过这不是第一优先级。短期更重要的是：

```text
真实市场 -> AI 推演 -> 用户交易 -> 结果追踪
```

### 5.12 信息源可信度系统

Prediction Market Trader Intelligence 不应该盲目相信所有信息。

建议 AI 输出 source reliability：

```text
Official data: High
Market movement: Medium
Social sentiment: Low
Rumor/news: Low
```

并且让不同信息源影响最终 confidence。

这可以减少 AI 被噪音带偏，也能让评委看到我们有严肃的交易风控思路。

### 5.13 What Would Change My Mind

每个交易建议都应该包含一个模块：

```text
What would change this recommendation?
```

示例：

```text
- 如果出现新的官方数据，概率需要重新评估。
- 如果价格高于 0.66，edge 会明显下降。
- 如果盘口流动性下降，不建议继续下单。
- 如果事件规则解释发生变化，当前推演失效。
```

这个模块会让 AI 更像一个专业交易员，而不是只会给出确定性结论的聊天机器人。

### 5.14 明确 No Trade 也是能力

成熟的交易智能系统不应该总是推荐交易。

应该明确支持：

```text
No trade recommended
```

常见原因：

- Edge 不够。
- 流动性太差。
- spread 太宽。
- 市场规则不清晰。
- 市场即将结束。
- 用户已有高度相关暴露。
- AI confidence 不足。

这会让产品更可信。

## 6. 黑客松 Demo 建议

建议 3 分钟 demo 按下面顺序展示：

1. 打开 Causeway，说明系统同步真实 Polymarket 市场。
2. 进入 AI Opportunities，系统自动筛选高价值市场。
3. 选择一个市场，展示事件、规则、价格、流动性。
4. 启动 AI 推演，展示因果推演图。
5. 展示 AI fair probability、market odds、edge、confidence。
6. 展示 Skeptic / Risk Agent 的反驳和风控结论。
7. 展示建议仓位和最大损失。
8. 用户钱包确认，提交 Polymarket 订单。
9. 展示订单状态、Builder attribution、open order 或成交结果。
10. 展示 reasoning trace hash 写入 Arc，证明推演记录可验证。
11. 展示 Signal Track Record，说明系统可以追踪准确率、PnL 和用户行为。

这个 demo 重点不是炫技，而是证明：

```text
AI 做了真实交易决策。
用户可以真实执行。
系统可以追踪结果。
Arc 增强了推演可信度。
Builder Code 形成商业闭环。
```

## 7. 实施优先级

### P0：必须完成

- AI 推演输出中增加 market odds、AI fair odds、edge、confidence。
- AI 输出必须支持 BUY / WATCH / AVOID，不允许无脑 BUY。
- 下单前展示明确的风险和仓位建议。
- Builder Code 稳定进入每笔订单。
- 下单成功、失败、拒签、取消都有清晰状态。
- 交易记录和 AI 推荐记录入库。
- Signal Track Record 基础页面。

### P1：强烈建议完成

- AI Opportunities 页面。
- 事件维度组合风控。
- 保守 Kelly 仓位建议。
- What Would Change My Mind。
- No Trade Recommended 原因展示。
- 已下单后的订单追踪和取消入口。

### P2：冲击第一名增强项

- 多 Agent 推演流程。
- Arc reasoning trace hash 上链。
- 公开信号绩效面板。
- 用户风险偏好设置。
- USDC 微支付解锁高级信号。

## 8. 风险与注意事项

### 8.1 不要让 AI 看起来像代替用户控制资金

产品必须明确：

- 用户自己连接钱包。
- 用户自己签名。
- 用户自己确认下单。
- Causeway 不能绕过用户签名私自下单。
- Causeway 不保管用户私钥。

这对正式上线和评审都很重要。

### 8.2 不要把模拟数据混成真实交易数据

如果展示 traction、PnL、信号准确率，必须明确：

- 哪些是真实订单。
- 哪些是 paper trading。
- 哪些是 AI signal，但用户未执行。
- 哪些是已成交交易。

透明性很重要。

### 8.3 不要只做 UI，不做交易闭环

这个赛道评审会更看重：

- 真实市场数据。
- 真实交易能力。
- 真实用户交互。
- 真实记录和追踪。

纯 UI demo 很难拿第一。

### 8.4 不要强行把 Arc 用在不适合的位置

Polymarket 下单链路仍然应该走 Polymarket 官方 Builder / CLOB / relayer 方式。

Arc 更适合用于：

- AI 推演记录 hash。
- 信号证明。
- USDC 小额支付。
- Agent 结算。
- 审计记录。

这样技术方向更稳。

## 9. 第一名策略

如果目标是第一名，建议把项目叙事压缩成一句话：

```text
Causeway turns prediction markets into an AI-readable, AI-reasoned, user-executed trading intelligence layer.
```

中文解释：

```text
Causeway 把预测市场变成一个 AI 可理解、AI 可推演、用户可执行的交易智能层。
```

最强卖点：

- AI 不是聊天助手，而是交易推理系统。
- 每个建议都有推演图、概率、风险和仓位。
- 用户可以真实下单。
- Builder Code 形成真实商业闭环。
- Arc 让 AI 推演记录可验证、不可事后篡改。
- Signal Track Record 可以持续证明 AI 是否真的有效。

## 10. 推荐下一步

建议立即按下面顺序推进：

1. 梳理当前 AI 推演输出结构，补齐 probability、edge、confidence、risk、position sizing。
2. 新增 AI Opportunities 页面或筛选入口。
3. 完成 AI signal 入库和交易后追踪。
4. 确认每笔 Polymarket 订单稳定携带 Builder Code。
5. 做一个适合 demo 的真实市场流程。
6. 接入 Arc testnet，把 reasoning trace hash 写入链上。
7. 准备 3 分钟 demo 视频和 public GitHub repo 说明。

## 11. 参考资料

- Agora Agents Hackathon：https://agora.thecanteenapp.com/
- Luma 活动页：https://luma.com/7i50p2r9
- ARC CLI 仓库：https://github.com/the-canteen-dev/ARC-cli
- Canteen Arc RPC 文档：https://arc-node.thecanteenapp.com/
- Arc 官方文档：https://docs.arc.io/
- Arc 连接文档：https://docs.arc.io/arc/references/connect-to-arc
- Polymarket Builder 文档：https://docs.polymarket.com/trading/clients/builder
