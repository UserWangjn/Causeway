# Causeway 真实下单技术 Spike

## 1. 目标

真实下单是一期最大技术风险。本 Spike 的目标是在正式开发订单模块前，用最小代码验证：

- RainbowKit 钱包登录能否满足 Polymarket CLOB 签名流程。
- TypeScript 后端如何安全地提交订单。
- 不保存用户私钥的情况下，如何生成或传递 Polymarket 所需签名。
- cash、positions、open orders 的实际数据来源。
- 最小订单能否成功提交、查询、取消。

Spike 完成前，不能冻结真实 CLOB 提交方案；但前后端订单协议必须先按 `preview -> prepare-signature -> submit` 实现，并支持 `dry_run` 降级。

## 2. 安全边界

必须遵守：

- 后端不保存用户私钥。
- 不允许 AI 自动提交订单。
- 所有真实订单必须由用户在前端确认。
- Spike 默认使用极小金额。
- Spike 必须提供 `DRY_RUN=true` 模式。
- 真实提交必须受 `ENABLE_REAL_ORDERS=true` 控制。
- 使用专门测试钱包，不使用主钱包。

## 3. 需要验证的官方能力

### 3.1 CLOB SDK

官方 TypeScript SDK：

```text
@polymarket/clob-client
```

需要验证：

- `getOrderBook(tokenId)`
- `getPrice(tokenId, side)`
- `getTickSize(tokenId)`
- `createAndPostOrder(...)`
- `getOpenOrders(...)`
- `cancelOrder(...)`

### 3.2 Gamma API

需要验证：

- Market 的 `outcomes/outcomePrices/clobTokenIds` 是否稳定按 index 对齐。
- Market 的 `orderPriceMinTickSize`、`orderMinSize`、`negRisk` 是否足够用于下单参数。
- `acceptingOrders`、`enableOrderBook`、`closed` 是否能可靠过滤不可交易市场。

### 3.3 Portfolio / Data API

需要验证：

- cash balance 的官方来源。
- positions 的官方来源。
- open orders 的官方来源。
- trades / activity 的官方来源。

## 4. 待选技术方案

### 4.1 方案 A：前端签名，后端提交

流程：

1. 后端生成订单预览。
2. 前端用 RainbowKit / viem 获取 wallet client。
3. 前端根据后端返回的订单参数完成签名。
4. 前端把签名后的 order payload 发送给后端。
5. 后端调用 CLOB 提交。
6. 后端记录 external order id 和响应。

优点：

- 后端不接触私钥。
- 后端仍保留审计和订单状态。

风险：

- 需要确认官方 SDK/order-utils 是否支持拆分“签名”和“提交”。
- 浏览器端依赖和 CORS 需要验证。

### 4.2 方案 B：前端直接提交 CLOB，后端只记录

流程：

1. 后端生成订单预览。
2. 前端用 SDK 创建并提交订单。
3. 前端把结果回传后端。

优点：

- 私钥和签名都留在前端。

风险：

- 后端审计不完整。
- 用户可能绕过后端风控。
- 前端暴露更多交易逻辑。

### 4.3 方案 C：用户授权后端代理

流程：

1. 用户显式授权 API key 或 delegated signer。
2. 后端保存受限凭证。
3. 后端代为创建和提交订单。

优点：

- 后端实现最简单。
- 批量下单体验好。

风险：

- 凭证安全要求高。
- 一期不建议默认采用，除非官方推荐流程明确支持且权限边界清晰。

## 5. 推荐 Spike 顺序

### Step 1：只读 CLOB 验证

输入一个真实 `clobTokenId`，验证：

- order book 可读取。
- price 可读取。
- tick size 可读取。
- min size 可从 Gamma 读取。

输出：

```json
{
  "tokenId": "...",
  "tickSize": "0.01",
  "minSize": "5",
  "bestBid": "0.42",
  "bestAsk": "0.43"
}
```

### Step 2：钱包登录验证

验证：

- RainbowKit 连接钱包。
- 后端 nonce。
- 用户签名。
- 后端恢复地址并创建 session。

输出：

```json
{
  "address": "0x...",
  "chainId": 137,
  "authenticated": true
}
```

### Step 3：订单预览验证

选择一个高流动性、最小下单金额低的市场，生成预览：

```json
{
  "tokenId": "...",
  "side": "BUY",
  "limitPrice": 0.01,
  "amountUsd": 5,
  "size": 500
}
```

校验：

- 价格符合 tick size。
- 金额大于最小下单金额。
- 用户 cash 足够。
- 市场可交易。

### Step 4：签名流程验证

分别验证方案 A/B/C 中至少一种能完整签名订单。

必须记录：

- 使用的 SDK 包名和版本。
- 是否需要 CLOB API key。
- 是否需要 funder address。
- signature type。
- 签名发生在前端还是后端。
- 后端是否保存任何敏感凭证。

### Step 5：真实小额下单

前置条件：

- `DRY_RUN=false`
- `ENABLE_REAL_ORDERS=true`
- 用户二次确认。
- 测试钱包有足够余额。
- 选择高流动性市场。

验证：

- 订单成功提交。
- 返回 external order id。
- 可以查询 open order。
- 可以取消订单。
- 数据库记录状态变化。

## 6. Spike 验收标准

必须产出：

- 一份实际运行记录。
- 最小下单代码路径。
- 订单签名方案结论。
- cash / positions / orders 数据来源结论。
- 失败场景和错误码列表。
- 是否采用方案 A/B/C 的明确建议。
- 若真实能力仍不可用，必须给出前后端 capability 返回值和用户可见降级文案。

验收结果要回写到：

- `causeway-polymarket-integration-and-trading.md`
- `causeway-backend-development.md`
- `causeway-api-contract.md`

## 7. 失败场景清单

必须覆盖：

- CLOB 网络超时。
- order book 不存在。
- market closed。
- acceptingOrders=false。
- tick size 不合法。
- 低于 min order size。
- cash 不足。
- 用户拒签。
- 签名过期。
- 部分订单提交成功，部分失败。
- 订单提交成功但状态查询失败。

## 8. 日志要求

日志必须包含：

- requestId。
- userId。
- walletAddress。
- marketId。
- outcomeId。
- clobTokenId。
- order preview。
- submit response。
- error code。

日志不能包含：

- 私钥。
- seed phrase。
- 未加密敏感凭证。

## 9. Spike 后决策

完成 Spike 后需要冻结：

- CLOB SDK 版本。
- 订单签名架构。
- 订单提交由前端还是后端执行。
- cash balance 数据来源。
- positions 数据来源。
- 是否支持取消订单。
- 一期支持的 order type。

冻结前不要做大规模订单 UI 和资产组合开发。
