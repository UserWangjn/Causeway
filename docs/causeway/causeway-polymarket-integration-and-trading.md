# Causeway Polymarket 接入与交易文档

## 1. 官方数据源

Causeway 一期使用三类 Polymarket 数据源：

- Gamma API：市场发现、Event/Market 主数据、图标、规则、outcomes、clobTokenIds。
- CLOB API/SDK：订单簿、价格、tick size、min order size、真实下单、订单状态。
- Data API：用户持仓、交易活动、资产组合数据。

参考：

- https://docs.polymarket.com/api-reference
- https://docs.polymarket.com/developers/gamma-markets-api/gamma-structure
- https://docs.polymarket.com/developers/CLOB/clients/methods-public
- https://docs.polymarket.com/trading/orders/create

## 2. 已验证的真实市场结构

通过 Gamma API 样本验证，截至 2026-05-17，真实市场 outcome 不能假设为固定 `Yes/No`。

样本类型：

```text
Yes | No
Over | Under
Odd | Even
Team A | Team B
Candidate Yes | Candidate No
Range Market Yes | Range Market No
```

因此 Causeway 数据模型必须用：

```text
market -> outcomes[] -> tokenId
```

而不是：

```text
market -> yesTokenId/noTokenId
```

## 3. Gamma API 字段映射

Gamma Market 常用字段：

```text
id
question
conditionId
slug
description
outcomes
outcomePrices
clobTokenIds
volume
liquidity
active
closed
enableOrderBook
acceptingOrders
negRisk
orderPriceMinTickSize
orderMinSize
bestBid
bestAsk
lastTradePrice
image
icon
rules
endDate
rawPayload
```

`outcomes`、`outcomePrices`、`clobTokenIds` 在 Gamma 返回中可能是 JSON 字符串，入库前必须 parse 并按 index 对齐。

## 4. CLOB SDK

官方 TypeScript 包：

```text
@polymarket/clob-client
@polymarket/clob-client-v2
```

2026-05-17 本地 npm 查询：

- `@polymarket/clob-client` latest：`5.8.1`
- `@polymarket/clob-client-v2` latest：`1.0.6`

公开读方法包括：

```text
getMarkets
getMarket
getOrderBook
getOrderBooks
getPrice
getPrices
getMidpoint
getSpread
getPricesHistory
getTickSize
getNegRisk
```

交易方法包括：

```text
createAndPostOrder
createAndPostMarketOrder
getOpenOrders
cancelOrder
```

注意：本地 SDK 可加载成功；当前环境中 SDK 访问 CLOB 主机曾出现超时，但 `https://clob.polymarket.com/ok` REST 健康检查可返回 OK。开发时需要对 SDK 超时做重试和降级。

## 5. 下单模型

Polymarket CLOB 下单对象是 token ID。

Causeway 前后端协议必须支持两种执行模式：

- `dry_run`：不提交 Polymarket，用于开发、演示、CLOB 不可用或真实签名方案未冻结时。
- `real`：提交 Polymarket CLOB。真实能力由后端 capability 状态决定。

Causeway 订单最小模型：

```ts
type CausewayOrder = {
  tokenId: string;
  side: "BUY";
  orderType: "GTC" | "GTD" | "FOK" | "FAK";
  limitPrice: number;
  size: number;
};
```

一期只做 BUY。SELL、平仓、赎回放到后续。

## 6. 订单类型

官方 CLOB 订单类型：

- `GTC`：限价挂单，直到成交或取消。
- `GTD`：限价挂单，到期自动失效。
- `FOK`：立即全部成交，否则取消。
- `FAK`：立即尽量成交，未成交部分取消。

一期建议：

- 默认用 `GTC`。
- 订单确认页允许用户选择 `FAK`。
- 不默认使用 FOK，避免小盘口频繁失败。

## 7. 订单预览

提交订单前必须：

1. 刷新 Market。
2. 刷新 outcome 对应 token 的 order book。
3. 校验 `acceptingOrders`。
4. 校验 `closed=false`。
5. 校验 `enableOrderBook=true`。
6. 校验 `amountUsd >= orderMinSize`。
7. 校验价格符合 `orderPriceMinTickSize`。
8. 校验用户现金余额足够。

## 8. 资产组合

资产组合数据来源：

- 现金余额：优先用 Polymarket 支持的账户/余额接口或链上抵押资产余额；具体实现阶段需再次核对当前官方认证与余额接口。未接通前接口返回 `cashAvailable=null` 和 `capability=unavailable`，不能返回伪余额。
- 持仓：Data API `/positions?user=address` 或 CLOB/官方组合接口。
- 未成交订单：CLOB authenticated open orders。
- 历史订单/交易：CLOB trades 或 Data API activity。

前端展示不直接读取 Polymarket，由后端聚合后返回。

## 9. 本地同步策略

### 9.1 全量同步

首次启动：

1. 拉取 active events。
2. 拉取 event 下 markets。
3. parse outcomes、prices、token IDs。
4. upsert events、markets、outcomes。
5. 写入 sync run。

### 9.2 增量同步

按 `updatedAt`、cursor 或分页定时拉取。

### 9.3 重点市场刷新

以下市场进入高频刷新：

- 市场网络首页热门市场。
- 用户正在查看的市场。
- 推演脚本中的所有市场。
- 用户持仓和未成交订单相关市场。

## 10. 图标与图片

优先使用 Gamma 返回的：

```text
icon
image
iconOptimized
imageOptimized
```

不要抓取 Polymarket 前端内部资源。官方 iframe embed 可以用于外部嵌入场景，但 Causeway 核心 UI 应使用 API 数据自行渲染。

## 11. 风险与限制

- Outcome label 不稳定，不应作为唯一标识；必须用 tokenId。
- Event 下多 Market 场景必须完整展示，不要只展示第一个 Market。
- Sports 市场有开赛清簿等特殊行为，下单前必须刷新。
- CLOB 超时或 order book 不可用时，不允许提交订单。
- 任何 AI 结果都不能直接自动下单。
- 所有真实下单必须由用户确认。
