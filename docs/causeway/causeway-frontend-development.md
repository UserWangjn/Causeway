# Causeway 前端开发文档

## 1. 技术栈

- Framework：Next.js App Router。
- Language：TypeScript。
- Wallet：RainbowKit + wagmi + viem。
- Data Fetching：TanStack Query。
- Local State：Zustand。
- Chart：ECharts。
- Graph：优先复用当前仓库已有 G6/X6 依赖。
- Icons：lucide-react；市场图标优先使用 Polymarket API 返回的 `icon/image`。
- Styling：Tailwind CSS，视觉参考 Polymarket，保留 Causeway 品牌名。

## 2. 导航结构

建议主导航：

- `市场`
- `发现`
- `推演脚本`
- `监控`
- `资产组合`

右上角：

- 搜索入口。
- 通知。
- `Cash $xx.xx`。
- 钱包连接/头像。

## 3. 路由设计

```text
/                         市场网络首页
/markets/:marketSlug       市场详情
/infer/new                 AI 推演设置
/infer/:runId/progress     推演过程
/scripts/:scriptId         因果脚本
/scripts/:scriptId/orders  订单确认
/portfolio                 资产组合
/monitor                   监控追踪
/settings                  设置
```

`/infer/new` 必须通过 query 或本地状态携带根 market 与 root token：

```text
/infer/new?marketId=xxx&tokenId=yyy
```

如果缺少 tokenId，必须回到市场详情选择 outcome。

## 4. 钱包登录

使用 RainbowKit 官方 Next.js App Router 方案。

前端职责：

- 提供钱包连接按钮。
- 获取 `address`、`chainId`、连接状态。
- 要求切换到 Polygon。
- 调后端创建登录 nonce。
- 用户签名 nonce。
- 后端验证签名后返回会话 token。

最低依赖：

```text
@rainbow-me/rainbowkit
wagmi
viem
@tanstack/react-query
```

注意：RainbowKit 只解决连接钱包体验，不等同于后端会话。后端仍要验证签名并维护 session/JWT。

## 5. 市场详情 outcome 选择

前端不能写死 `Yes/No`。

每个 Market 的 outcome 列表来自后端标准化后的：

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

UI 行为：

- 默认不选中任何 outcome。
- 用户必须选中一个 outcome 才能设为推演根节点。
- 展示 outcome label，例如 `Yes`、`No`、`Over`、`Under`、球队名称等。
- 选中后底部主按钮文案：`以该结果开始推演`。

## 6. AI 推演设置页

字段：

- 根 Event。
- 根 Market。
- 根 outcome。
- 推演层数：分段控件，1 / 2 / 3。
- 每层最大市场数：默认 8。
- 置信度阈值：默认 0.55。
- 时间范围：默认 30D，可选 7D / 30D / 90D。
- 使用缓存：默认开启。

说明：

- `推演层数` 替代原型中的 `推演强度` 作为主配置。
- 可以保留“更快/更全面”的提示，但不能把核心逻辑写成模糊百分比。

## 7. 推演过程页

状态来自后端 `GET /api/v1/inference-runs/:runId`。

阶段枚举：

```ts
type InferenceStage =
  | "queued"
  | "candidate_retrieval"
  | "ai_reasoning"
  | "outcome_mapping"
  | "market_refresh"
  | "script_generation"
  | "completed"
  | "failed";
```

若命中缓存，页面应展示：

```text
已复用近期推演结果，正在刷新最新市场价格和可交易状态
```

## 8. 因果脚本页

页面需要同时支持图谱浏览和交易编辑。

建议布局：

- 左侧/主区域：因果图。
- 右侧：选中节点详情。
- 下方或列表视图：所有可交易市场和 outcome 选择表。

### 8.1 图谱节点

节点字段：

```ts
type ScriptNode = {
  nodeId: string;
  marketId: string;
  title: string;
  layer: 0 | 1 | 2 | 3;
  recommendedOutcomes: {
    label: string;
    tokenId: string;
  }[];
  confidence: number;
  direction: "supports" | "opposes" | "unclear";
  price: number | null;
};
```

### 8.2 Outcome 表格

每个 Market 展示所有 outcome：

```ts
type ScriptOutcomeRow = {
  outcomeId: string;
  label: string;
  tokenId: string;
  aiAction: "buy" | "avoid";
  userAction: "buy" | "skip";
  side: "BUY";
  limitPrice: number | null;
  amountUsd: number | null;
  confidence: number | null;
  reason: string;
};
```

一期只做买入，不做卖出或平仓；卖出可以在资产组合里作为后续功能。

AI 输出会覆盖每个 Market 下的所有 outcome。前端默认把 `aiAction=buy` 显示为参与，把 `aiAction=avoid` 显示为不参与，用户可以手动切换为 `buy` 或 `skip`。

## 9. 下单 UX

下单入口：

- 单个 outcome 行：`下单`。
- 脚本级：`批量生成订单`。

批量下单流程：

1. 用户在因果脚本中选择多个 outcome。
2. 设置每个 outcome 的金额，或使用批量金额分配。
3. 点击 `生成订单`。
4. 进入订单确认页。
5. 后端返回预览、失败原因、风控提示。
6. 前端调用 `prepare-signature`。
7. `dry_run` 模式无需签名；`real` 模式按返回协议请求钱包签名。
8. 用户确认并提交订单。

金额分配一期建议：

- 默认每个被选 outcome 手动输入。
- 可提供 `平均分配` 快捷按钮。
- `按置信度分配` 放到二期。

## 10. 资产组合页

模块：

- Summary：现金、持仓价值、总价值、未实现盈亏。
- Positions：市场、outcome、数量、均价、当前价、当前价值、PnL。
- Open Orders：市场、outcome、方向、价格、数量、状态、取消操作。
- Trade History：时间、市场、outcome、方向、成交价、数量、费用。

## 11. 空态与错误态

- 未连接钱包：展示连接钱包按钮。
- 钱包链错误：提示切换 Polygon。
- 市场数据过期：展示 `数据正在刷新`。
- CLOB 不可用：允许浏览脚本，不允许提交订单。
- 订单部分失败：成功和失败分区展示。
- 推演缓存命中：明确标注结果来源时间。
- 真实下单能力不可用：订单确认页仍可展示 `dry_run` 结果，但 `real` 提交按钮置灰并展示后端返回的 capability 原因。
