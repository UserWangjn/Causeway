# Causeway 后端运维与部署手册

## 1. 目标

本文定义 Causeway API 从本地开发到生产部署的最低可重复流程。它补齐 B9 生产就绪要求：环境矩阵、迁移流程、健康检查、限流、备份恢复、日志监控和发布门禁。

真实 CLOB 下单不属于本文的默认发布流程；在 Spike 验收前，生产环境应保持 `ENABLE_REAL_ORDERS=false`。

## 2. 环境矩阵

| 环境 | 配置文件 | 数据库 | Redis | 说明 |
| --- | --- | --- | --- | --- |
| local | `apps/api/.env.example` | `causeway` | 默认不需要 | 本地样例默认 `RATE_LIMIT_ENABLED=false`，新机器不需要先启动 Redis。 |
| test | `apps/api/.env.test.example` | `causeway_test` | 默认不需要 | integration/e2e 必须使用测试库，测试 helper 会拒绝清理非测试库。 |
| production | `apps/api/.env.production.example` | 托管 PostgreSQL | 必须配置 | `NODE_ENV=production` 且限流开启时必须提供 `REDIS_URL`，secret 必须是强随机值。 |

生产 secret 要求：

- `JWT_SECRET` 至少 32 字符，建议 64 字符以上随机值。
- `INTERNAL_API_TOKEN` 至少 32 字符，建议 64 字符以上随机值。
- 禁止使用 `change-me`、`replace-me`、`dev-local-*`、重复字符等占位或低熵值。
- 不在仓库、日志、错误响应或 issue 中粘贴真实 secret。

## 3. 本地启动

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env
npm run db:generate
npm run db:migrate
npm run dev:api
```

本地需要 Redis 限流时，显式设置：

```text
RATE_LIMIT_ENABLED=true
REDIS_URL=redis://127.0.0.1:6379
```

## 4. 发布门禁

普通后端改动至少执行：

```powershell
npm run quality:api
```

涉及数据库、HTTP 契约、auth、订单、portfolio、监控或生产配置时执行完整门禁：

```powershell
$env:TEST_DATABASE_URL="postgresql://causeway:causeway@127.0.0.1:5432/causeway_test?schema=public"
$env:DATABASE_URL=$env:TEST_DATABASE_URL
npm run quality:api:full
```

注意：不要把 `npm run db:generate` 和单测并行执行。Prisma Client 生成会写入 `node_modules/.prisma`，并行加载 `@prisma/client` 可能造成瞬时不一致。

外部 smoke checks 不进入默认门禁，必须显式 opt-in：

```powershell
$env:SMOKE_POLYMARKET_ENABLED="true"
npm run smoke:api:polymarket

$env:SMOKE_AI_ENABLED="true"
$env:AI_BASE_URL="https://provider.example.com/v1"
$env:AI_API_KEY="<provider-key>"
$env:AI_MODEL="<model>"
npm run smoke:api:ai
```

API 推演接口使用同一组 AI provider 配置。`AI_BASE_URL` 必须是纯 base URL，不得包含 credentials、query 参数或 fragment；生产环境必须使用 HTTPS，开发/测试环境只允许 localhost/loopback provider 使用 HTTP。非 mock `model` 必须等于 `AI_MODEL`，provider 调用使用 OpenAI-compatible `POST /chat/completions`，并由 `AI_HTTP_TIMEOUT_MS` 和 `AI_MAX_OUTPUT_TOKENS` 控制请求边界。

Portfolio position sync 默认通过 Polymarket Data API 拉取公开 positions。需要保持本地只读或外部 Data API 不可用时，将 `POLYMARKET_DATA_API_ENABLED=false`；此时持仓同步返回 `503 CAPABILITY_UNAVAILABLE`。Data API 上游错误响应只允许暴露脱敏后的 endpoint，不记录或返回钱包地址 query 参数。

`smoke:api:polymarket` 会读取真实 Gamma market，并使用一个 CLOB token id 检查只读 order book。可以通过 `SMOKE_CLOB_TOKEN_ID` 指定固定 token。`smoke:api:real-orders` 只保留安全边界；真实订单 Spike 通过前不会提交订单。

## 5. 生产部署流程

部署任务应按顺序执行：

```powershell
npm ci
npm run db:generate
npm run build:api
npm run db:deploy
npm --workspace @causeway/api run start
```

部署平台应配置：

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `INTERNAL_API_TOKEN`
- `REDIS_URL`
- `RATE_LIMIT_ENABLED=true`
- `API_TRUST_PROXY=true`，当 API 运行在负载均衡或反向代理后面时启用。

`db:deploy` 使用 Prisma migrate deploy，只执行已提交 migration；生产禁止使用 `prisma migrate dev`。

## 6. 健康检查

部署平台使用：

- `GET /api/v1/health`：liveness，不访问数据库，不参与限流。
- `GET /api/v1/health/ready`：readiness，检查数据库；限流开启时还检查限流存储。

readiness 失败统一返回 `503 READINESS_FAILED`，不得泄漏数据库连接串、Redis URL、密码或内部异常。

## 7. 数据备份与恢复

最低要求：

- 生产数据库启用自动备份，保留周期不少于 7 天。
- 每次 schema migration 前确认最近一次备份成功。
- 涉及破坏性迁移前先做一次人工备份，并在发布记录中写明备份时间。

推荐手工备份命令：

```powershell
pg_dump "$env:DATABASE_URL" --format=custom --file causeway-$(Get-Date -Format yyyyMMdd-HHmmss).dump
```

恢复演练使用非生产数据库：

```powershell
createdb causeway_restore_test
pg_restore --dbname "postgresql://causeway:causeway@127.0.0.1:5432/causeway_restore_test" causeway-YYYYMMDD-HHMMSS.dump
npm run db:deploy
```

恢复演练通过标准：

- `npm run db:generate` 通过。
- API 能启动。
- `GET /api/v1/health/ready` 返回 200。
- 关键只读接口能读取恢复后的市场数据。

## 8. 日志与监控

当前后端输出结构化日志，关键字段包括 `requestId`、`statusCode`、`code`、`method`、`path` 和错误摘要。生产日志平台至少配置以下告警：

- `READINESS_FAILED` 连续失败。
- `SERVER_ERROR` 或 5xx 错误率升高。
- `RATE_LIMITED` 激增。
- `POLYMARKET_API_ERROR` 激增。
- `ORDER_PREVIEW_EXPIRED` 异常升高。
- 内部 sync 或 monitor job 失败。

日志中不得记录 bearer token、internal token、数据库 URL、Redis URL、钱包私钥或签名原文。

## 9. 回滚原则

- 代码回滚可通过部署上一版本完成。
- 数据库 migration 默认只前进；如 migration 已修改数据，回滚前先评估是否需要从备份恢复。
- 未接通真实 CLOB 前，`real` 订单必须保持 capability-gated unavailable，不允许临时绕过。
