# Causeway AI 推演设计

## 1. 一期原则

一期 AI 推演只使用 Polymarket 内部市场数据，不使用新闻、社交媒体、宏观数据库等外部信息源。

AI 的任务不是直接下单，而是：

1. 根据用户选择的根 outcome 生成因果影响路径。
2. 从候选市场中选择相关市场。
3. 为每个相关市场下的所有 outcome token 给出默认动作。
4. 给出 outcome 级影响方向、置信度、层级和理由。
5. 输出结构化 JSON，供后端生成因果脚本。

## 2. AI 输入数据

### 2.1 根假设

```json
{
  "root": {
    "eventTitle": "2028 Presidential Election Winner",
    "marketQuestion": "Will Donald Trump win the 2028 US Presidential Election?",
    "selectedOutcome": {
      "label": "Yes",
      "tokenId": "..."
    }
  }
}
```

### 2.2 推演参数

```json
{
  "depth": 3,
  "maxMarketsPerLayer": 8,
  "confidenceThreshold": 0.55
}
```

### 2.3 候选市场

候选市场由后端从本地数据库召回，不让 AI 自己发散到不存在的市场。

每个候选 Market 提供：

```json
{
  "marketId": "market_x",
  "eventTitle": "Fed decision in June",
  "question": "Will the Fed cut rates by 25 bps in June?",
  "description": "...",
  "rules": "...",
  "category": "macro",
  "tags": ["fed", "rates"],
  "active": true,
  "closed": false,
  "acceptingOrders": true,
  "volume": 123456.78,
  "liquidity": 23456.78,
  "outcomes": [
    {
      "outcomeId": "outcome_x",
      "label": "Yes",
      "price": 0.41,
      "tokenId": "..."
    },
    {
      "outcomeId": "outcome_y",
      "label": "No",
      "price": 0.59,
      "tokenId": "..."
    }
  ]
}
```

## 3. 候选市场召回

后端先召回，再交给 AI 排序和推演。

召回策略：

- 同 Event 或相关 Event。
- 标签重合。
- 标题和描述全文检索。
- embedding 语义相似。
- 市场价格历史相关性。
- 高流动性、高成交量优先。
- active、未 closed、可交易优先。

每层候选池建议：

- 第 1 层：最多 80 个候选。
- 第 2 层：每个父节点最多 40 个候选。
- 第 3 层：每个父节点最多 25 个候选。

AI 输出后再按 `maxMarketsPerLayer` 截断。

## 4. 推演层数定义

### 4.1 一层

只找根 outcome 的直接影响市场。

```text
Trump wins Yes -> Fed cut Yes
Trump wins Yes -> Gold up Yes
```

### 4.2 二层

基于第一层结果继续推演。

```text
Trump wins Yes -> Tech stocks up Yes -> Nvidia up Yes
```

### 4.3 三层

继续推演第三层，但必须严格过滤低置信度节点。

三层结果更容易噪声高，因此 UI 需要明确显示层级和置信度。

## 5. 输出结构

AI 必须输出 JSON，不允许只输出自然语言。

```ts
type AiInferenceOutput = {
  summary: string;
  nodes: AiMarketNode[];
  edges: AiEdge[];
  warnings: string[];
};

type AiMarketNode = {
  clientNodeId: string;
  marketId: string;
  layer: 0 | 1 | 2 | 3;
  confidence: number;
  impactDirection: "supports" | "opposes" | "unclear";
  reason: string;
  outcomes: AiOutcomeRecommendation[];
};

type AiOutcomeRecommendation = {
  outcomeId: string;
  outcomeLabel: string;
  aiAction: "buy" | "avoid";
  confidence: number;
  reason: string;
};

type AiEdge = {
  sourceClientNodeId: string;
  targetClientNodeId: string;
  sourceOutcomeId: string;
  targetOutcomeId: string;
  relation: "causes" | "supports" | "hedges" | "contradicts" | "correlates";
  confidence: number;
  reason: string;
};
```

说明：

- 图谱节点仍以 Market 为单位，便于前端展示。
- 因果边必须标明 source outcome 和 target outcome，避免把多 outcome market 误解成固定 `Yes/No`。
- 根节点的 `sourceOutcomeId` 必须等于用户选择的 root outcome。
- 若一个 market 中多个 outcome 都受到影响，应分别返回 outcome recommendation；edge 连接到最主要的 target outcome。

## 6. Outcome 选择规则

AI 不能只说“美联储降息”，必须对该 Market 下每个可交易 outcome 给出默认动作。

例如候选 Market outcomes 为：

```text
["Over", "Under"]
```

AI 必须返回 `outcomes[]`，其中每个 outcome 都有 `aiAction`。通常只有一个或少数 outcome 是 `buy`，其余是 `avoid`。后端会把 `aiAction=buy` 转成用户默认 `userAction=buy`，把 `aiAction=avoid` 转成用户默认 `userAction=skip`。

对于 Event 下多个 Market 的情况，后端会把每个 Market 都作为候选传入，AI 可以分别选择。

AI 的因果理由必须说明具体 outcome 之间的关系。例如：

```text
root outcome "Trump wins: Yes" -> target outcome "Fed cut in June: No"
```

不能只写：

```text
Trump wins -> Fed decision
```

## 7. Prompt 模板

### 7.1 System Prompt

```text
You are Causeway's prediction-market causal reasoning engine.

You analyze Polymarket markets only from the structured market data provided by the backend.
Do not invent markets, token IDs, prices, or external facts.
Do not use news, social media, or macro data unless it is explicitly included in the input.

The user has selected one root market and one root outcome token as a hypothetical condition.
Your job is to infer which candidate markets are causally or economically affected by that root outcome.

Return only valid JSON that matches the required schema.
Every selected market must use an existing marketId, and every outcome recommendation must use an existing outcomeId from that market in the input.
Do not assume outcomes are Yes/No. Outcomes may be Yes/No, team names, Over/Under, Odd/Even, ranges, or other labels.

Never provide financial advice language. Describe causal reasoning and uncertainty only.
```

### 7.2 User Prompt

```text
Root hypothesis:
{{root_market_question}}
Selected outcome:
{{root_outcome_label}}

Inference settings:
- depth: {{depth}}
- max markets per layer: {{max_markets_per_layer}}
- confidence threshold: {{confidence_threshold}}

Candidate markets:
{{candidate_markets_json}}

Tasks:
1. Build a causal graph up to the requested depth.
2. Pick only candidate markets that are meaningfully affected by the root outcome or by previous layer outcomes.
3. For each selected market, return one recommendation for every existing outcome token in that market.
4. Mark the strongest tradable outcome(s) as buy and the remaining outcomes as avoid.
5. For every edge, include sourceOutcomeId and targetOutcomeId.
6. Assign confidence from 0 to 1.
7. Explain briefly why each market and outcome action is connected.
8. Return valid JSON only.
```

## 8. 缓存设计

推演缓存只缓存 AI 因果结果，不缓存实时交易数据。

### 8.1 Cache Key

```text
sha256(
  rootMarketId +
  rootOutcomeId +
  depth +
  maxMarketsPerLayer +
  confidenceThreshold +
  candidateSetHash +
  model +
  promptVersion +
  outputSchemaVersion
)
```

### 8.2 TTL

- 默认 30 分钟。
- 高频市场 10 分钟。
- 低频市场 60 分钟。

### 8.3 强制刷新

用户点击 `重新推演` 时带：

```json
{
  "cacheEnabled": false
}
```

## 9. 校验

后端收到 AI 输出后必须校验：

- JSON schema 合法。
- marketId 存在于候选列表。
- 每个 outcome recommendation 的 outcomeId 属于对应 market。
- 每条 edge 的 sourceOutcomeId 属于 source market，targetOutcomeId 属于 target market。
- 根节点向外的 edge 必须使用用户选择的 rootOutcomeId 作为 sourceOutcomeId。
- layer 不超过用户设置。
- confidence 在 0 到 1。
- 没有重复 token。
- 每条 edge 的 source/target 都存在。

校验失败时：

- 可以重试一次。
- 重试失败则任务失败，并保存原始输出供审计。

## 10. 人工可编辑

AI 输出只是默认脚本。用户可以：

- 将某个 outcome 改为不参与。
- 改选同 market 下其他 outcome。
- 修改订单模式。
- 修改数量。
- 修改金额。
- 修改限价。
- 删除某个市场。

所有修改都必须进入审计日志。
