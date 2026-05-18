-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "InferenceRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "InferenceStage" AS ENUM ('candidate_retrieval', 'ai_reasoning', 'outcome_mapping', 'market_refresh', 'script_generation');

-- CreateEnum
CREATE TYPE "ScriptStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ImpactDirection" AS ENUM ('supports', 'opposes', 'unclear');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('causes', 'supports', 'hedges', 'contradicts', 'correlates');

-- CreateEnum
CREATE TYPE "MarketNetworkRelationType" AS ENUM ('tag', 'event', 'semantic', 'price_correlation', 'ai');

-- CreateEnum
CREATE TYPE "AiSelectionAction" AS ENUM ('buy', 'avoid');

-- CreateEnum
CREATE TYPE "UserSelectionAction" AS ENUM ('buy', 'skip');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY');

-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('dry_run', 'real');

-- CreateEnum
CREATE TYPE "OrderMode" AS ENUM ('market', 'limit');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('GTC', 'GTD', 'FOK', 'FAK');

-- CreateEnum
CREATE TYPE "OrderIntentStatus" AS ENUM ('draft', 'preview_ready', 'user_confirming', 'dry_run_completed', 'submitted', 'partially_submitted', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "CausewayOrderStatus" AS ENUM ('preview_ready', 'dry_run_completed', 'submitted', 'partially_filled', 'filled', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "address" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "nonce" TEXT NOT NULL,
    "nonceExpiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "sessionTokenHash" TEXT,
    "sessionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolymarketEvent" (
    "id" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "icon" TEXT,
    "tags" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL,
    "closed" BOOLEAN NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "restricted" BOOLEAN,
    "endDate" TIMESTAMP(3),
    "volume" DECIMAL(65,30),
    "liquidity" DECIMAL(65,30),
    "openInterest" DECIMAL(65,30),
    "rawPayload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolymarketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolymarketMarket" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "externalMarketId" TEXT,
    "conditionId" TEXT,
    "questionId" TEXT,
    "slug" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT,
    "rules" TEXT,
    "image" TEXT,
    "icon" TEXT,
    "active" BOOLEAN NOT NULL,
    "closed" BOOLEAN NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "acceptingOrders" BOOLEAN NOT NULL DEFAULT false,
    "enableOrderBook" BOOLEAN NOT NULL DEFAULT false,
    "negRisk" BOOLEAN NOT NULL DEFAULT false,
    "orderMinSize" DECIMAL(65,30),
    "orderPriceMinTickSize" DECIMAL(65,30),
    "bestBid" DECIMAL(65,30),
    "bestAsk" DECIMAL(65,30),
    "lastTradePrice" DECIMAL(65,30),
    "spread" DECIMAL(65,30),
    "volume" DECIMAL(65,30),
    "volume24hr" DECIMAL(65,30),
    "liquidity" DECIMAL(65,30),
    "endDate" TIMESTAMP(3),
    "rawPayload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolymarketMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolymarketOutcome" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "clobTokenId" TEXT NOT NULL,
    "price" DECIMAL(65,30),
    "bestBid" DECIMAL(65,30),
    "bestAsk" DECIMAL(65,30),
    "lastTradePrice" DECIMAL(65,30),
    "rawPayload" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolymarketOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT,
    "price" DECIMAL(65,30),
    "bestBid" DECIMAL(65,30),
    "bestAsk" DECIMAL(65,30),
    "spread" DECIMAL(65,30),
    "liquidity" DECIMAL(65,30),
    "volume" DECIMAL(65,30),
    "snapshotAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketNetworkNode" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "score" DECIMAL(65,30) NOT NULL,
    "category" TEXT,
    "metadata" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketNetworkNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketNetworkEdge" (
    "id" TEXT NOT NULL,
    "sourceMarketId" TEXT NOT NULL,
    "targetMarketId" TEXT NOT NULL,
    "relationType" "MarketNetworkRelationType" NOT NULL,
    "weight" DECIMAL(65,30) NOT NULL,
    "metadata" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketNetworkEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InferenceRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rootEventId" TEXT,
    "rootMarketId" TEXT NOT NULL,
    "rootOutcomeId" TEXT NOT NULL,
    "rootClobTokenId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "maxMarketsPerLayer" INTEGER NOT NULL,
    "confidenceThreshold" DECIMAL(65,30) NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "outputSchemaVersion" TEXT NOT NULL,
    "cacheEnabled" BOOLEAN NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "status" "InferenceRunStatus" NOT NULL DEFAULT 'queued',
    "stage" "InferenceStage",
    "progress" INTEGER NOT NULL DEFAULT 0,
    "inputJson" JSONB NOT NULL,
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InferenceRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InferenceCacheEntry" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "outputSchemaVersion" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "outputHash" TEXT NOT NULL,
    "resultJson" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InferenceCacheEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CausalScript" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inferenceRunId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ScriptStatus" NOT NULL DEFAULT 'draft',
    "rootEventId" TEXT,
    "rootMarketId" TEXT NOT NULL,
    "rootOutcomeId" TEXT NOT NULL,
    "graphJson" JSONB NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CausalScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptMarket" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "parentScriptMarketId" TEXT,
    "layer" INTEGER NOT NULL,
    "impactDirection" "ImpactDirection" NOT NULL,
    "confidence" DECIMAL(65,30) NOT NULL,
    "reason" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScriptMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptOutcomeSelection" (
    "id" TEXT NOT NULL,
    "scriptMarketId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "aiAction" "AiSelectionAction" NOT NULL,
    "userAction" "UserSelectionAction" NOT NULL,
    "side" "OrderSide" NOT NULL DEFAULT 'BUY',
    "orderMode" "OrderMode" NOT NULL DEFAULT 'limit',
    "limitPrice" DECIMAL(65,30),
    "size" DECIMAL(65,30),
    "amountUsd" DECIMAL(65,30),
    "confidence" DECIMAL(65,30),
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptOutcomeSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "status" "OrderIntentStatus" NOT NULL DEFAULT 'draft',
    "executionMode" "ExecutionMode" NOT NULL DEFAULT 'dry_run',
    "totalAmountUsd" DECIMAL(65,30) NOT NULL,
    "cashAvailable" DECIMAL(65,30),
    "tradingCapability" TEXT,
    "tradingCapabilityReason" TEXT,
    "balanceCapability" TEXT,
    "balanceCapabilityReason" TEXT,
    "previewJson" JSONB NOT NULL,
    "riskJson" JSONB NOT NULL,
    "previewExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CausewayOrder" (
    "id" TEXT NOT NULL,
    "orderIntentId" TEXT NOT NULL,
    "selectionId" TEXT,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "clobTokenId" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "orderMode" "OrderMode" NOT NULL,
    "orderType" "OrderType",
    "limitPrice" DECIMAL(65,30),
    "estimatedFillPrice" DECIMAL(65,30),
    "size" DECIMAL(65,30) NOT NULL,
    "amountUsd" DECIMAL(65,30) NOT NULL,
    "externalOrderId" TEXT,
    "status" "CausewayOrderStatus" NOT NULL DEFAULT 'preview_ready',
    "submitPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CausewayOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderIntentId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "cashAvailable" DECIMAL(65,30),
    "portfolioValue" DECIMAL(65,30),
    "openPositionsValue" DECIMAL(65,30),
    "openOrdersValue" DECIMAL(65,30),
    "pnl" DECIMAL(65,30),
    "rawPayload" JSONB NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalPosition" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT,
    "outcomeId" TEXT,
    "clobTokenId" TEXT NOT NULL,
    "size" DECIMAL(65,30) NOT NULL,
    "avgPrice" DECIMAL(65,30),
    "currentPrice" DECIMAL(65,30),
    "currentValue" DECIMAL(65,30),
    "pnl" DECIMAL(65,30),
    "rawPayload" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "cursor" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "SyncRunStatus" NOT NULL,
    "fetchedCount" INTEGER NOT NULL DEFAULT 0,
    "upsertedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metadata" JSONB NOT NULL,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "requestId" TEXT,
    "actorType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "WalletSession_address_createdAt_idx" ON "WalletSession"("address", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WalletSession_address_chainId_nonce_key" ON "WalletSession"("address", "chainId", "nonce");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketEvent_externalEventId_key" ON "PolymarketEvent"("externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketEvent_slug_key" ON "PolymarketEvent"("slug");

-- CreateIndex
CREATE INDEX "PolymarketEvent_active_closed_idx" ON "PolymarketEvent"("active", "closed");

-- CreateIndex
CREATE INDEX "PolymarketEvent_volume_idx" ON "PolymarketEvent"("volume");

-- CreateIndex
CREATE INDEX "PolymarketEvent_syncedAt_idx" ON "PolymarketEvent"("syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketMarket_externalMarketId_key" ON "PolymarketMarket"("externalMarketId");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketMarket_conditionId_key" ON "PolymarketMarket"("conditionId");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketMarket_slug_key" ON "PolymarketMarket"("slug");

-- CreateIndex
CREATE INDEX "PolymarketMarket_active_closed_acceptingOrders_enableOrderB_idx" ON "PolymarketMarket"("active", "closed", "acceptingOrders", "enableOrderBook");

-- CreateIndex
CREATE INDEX "PolymarketMarket_volume24hr_idx" ON "PolymarketMarket"("volume24hr");

-- CreateIndex
CREATE INDEX "PolymarketMarket_endDate_idx" ON "PolymarketMarket"("endDate");

-- CreateIndex
CREATE INDEX "PolymarketMarket_syncedAt_idx" ON "PolymarketMarket"("syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketOutcome_clobTokenId_key" ON "PolymarketOutcome"("clobTokenId");

-- CreateIndex
CREATE INDEX "PolymarketOutcome_marketId_idx" ON "PolymarketOutcome"("marketId");

-- CreateIndex
CREATE INDEX "PolymarketOutcome_label_idx" ON "PolymarketOutcome"("label");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketOutcome_marketId_outcomeIndex_key" ON "PolymarketOutcome"("marketId", "outcomeIndex");

-- CreateIndex
CREATE INDEX "MarketSnapshot_marketId_snapshotAt_idx" ON "MarketSnapshot"("marketId", "snapshotAt" DESC);

-- CreateIndex
CREATE INDEX "MarketSnapshot_outcomeId_snapshotAt_idx" ON "MarketSnapshot"("outcomeId", "snapshotAt" DESC);

-- CreateIndex
CREATE INDEX "MarketNetworkNode_score_idx" ON "MarketNetworkNode"("score");

-- CreateIndex
CREATE UNIQUE INDEX "MarketNetworkNode_marketId_key" ON "MarketNetworkNode"("marketId");

-- CreateIndex
CREATE INDEX "MarketNetworkEdge_sourceMarketId_idx" ON "MarketNetworkEdge"("sourceMarketId");

-- CreateIndex
CREATE INDEX "MarketNetworkEdge_targetMarketId_idx" ON "MarketNetworkEdge"("targetMarketId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketNetworkEdge_sourceMarketId_targetMarketId_relationTyp_key" ON "MarketNetworkEdge"("sourceMarketId", "targetMarketId", "relationType");

-- CreateIndex
CREATE INDEX "InferenceRun_userId_createdAt_idx" ON "InferenceRun"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "InferenceRun_cacheKey_idx" ON "InferenceRun"("cacheKey");

-- CreateIndex
CREATE INDEX "InferenceRun_status_createdAt_idx" ON "InferenceRun"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "InferenceCacheEntry_cacheKey_key" ON "InferenceCacheEntry"("cacheKey");

-- CreateIndex
CREATE INDEX "InferenceCacheEntry_expiresAt_idx" ON "InferenceCacheEntry"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CausalScript_inferenceRunId_key" ON "CausalScript"("inferenceRunId");

-- CreateIndex
CREATE INDEX "CausalScript_userId_createdAt_idx" ON "CausalScript"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ScriptMarket_scriptId_layer_idx" ON "ScriptMarket"("scriptId", "layer");

-- CreateIndex
CREATE UNIQUE INDEX "ScriptMarket_scriptId_marketId_key" ON "ScriptMarket"("scriptId", "marketId");

-- CreateIndex
CREATE INDEX "ScriptOutcomeSelection_userAction_idx" ON "ScriptOutcomeSelection"("userAction");

-- CreateIndex
CREATE UNIQUE INDEX "ScriptOutcomeSelection_scriptMarketId_outcomeId_key" ON "ScriptOutcomeSelection"("scriptMarketId", "outcomeId");

-- CreateIndex
CREATE INDEX "OrderIntent_userId_createdAt_idx" ON "OrderIntent"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OrderIntent_scriptId_idx" ON "OrderIntent"("scriptId");

-- CreateIndex
CREATE INDEX "CausewayOrder_orderIntentId_idx" ON "CausewayOrder"("orderIntentId");

-- CreateIndex
CREATE INDEX "CausewayOrder_selectionId_idx" ON "CausewayOrder"("selectionId");

-- CreateIndex
CREATE INDEX "CausewayOrder_marketId_idx" ON "CausewayOrder"("marketId");

-- CreateIndex
CREATE INDEX "CausewayOrder_externalOrderId_idx" ON "CausewayOrder"("externalOrderId");

-- CreateIndex
CREATE INDEX "CausewayOrder_status_createdAt_idx" ON "CausewayOrder"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OrderSubmission_orderIntentId_createdAt_idx" ON "OrderSubmission"("orderIntentId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "OrderSubmission_userId_orderIntentId_idempotencyKey_key" ON "OrderSubmission"("userId", "orderIntentId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_userId_snapshotAt_idx" ON "PortfolioSnapshot"("userId", "snapshotAt" DESC);

-- CreateIndex
CREATE INDEX "ExternalPosition_userId_syncedAt_idx" ON "ExternalPosition"("userId", "syncedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalPosition_userId_clobTokenId_key" ON "ExternalPosition"("userId", "clobTokenId");

-- CreateIndex
CREATE INDEX "SyncRun_jobType_startedAt_idx" ON "SyncRun"("jobType", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "SyncRun_status_startedAt_idx" ON "SyncRun"("status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "AuditEvent_userId_createdAt_idx" ON "AuditEvent"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AuditEvent_requestId_idx" ON "AuditEvent"("requestId");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "WalletSession" ADD CONSTRAINT "WalletSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolymarketMarket" ADD CONSTRAINT "PolymarketMarket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PolymarketEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolymarketOutcome" ADD CONSTRAINT "PolymarketOutcome_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "PolymarketMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSnapshot" ADD CONSTRAINT "MarketSnapshot_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "PolymarketMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketSnapshot" ADD CONSTRAINT "MarketSnapshot_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "PolymarketOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketNetworkNode" ADD CONSTRAINT "MarketNetworkNode_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "PolymarketMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketNetworkEdge" ADD CONSTRAINT "MarketNetworkEdge_sourceMarketId_fkey" FOREIGN KEY ("sourceMarketId") REFERENCES "PolymarketMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketNetworkEdge" ADD CONSTRAINT "MarketNetworkEdge_targetMarketId_fkey" FOREIGN KEY ("targetMarketId") REFERENCES "PolymarketMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InferenceRun" ADD CONSTRAINT "InferenceRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CausalScript" ADD CONSTRAINT "CausalScript_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CausalScript" ADD CONSTRAINT "CausalScript_inferenceRunId_fkey" FOREIGN KEY ("inferenceRunId") REFERENCES "InferenceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptMarket" ADD CONSTRAINT "ScriptMarket_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "CausalScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptMarket" ADD CONSTRAINT "ScriptMarket_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "PolymarketMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptMarket" ADD CONSTRAINT "ScriptMarket_parentScriptMarketId_fkey" FOREIGN KEY ("parentScriptMarketId") REFERENCES "ScriptMarket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptOutcomeSelection" ADD CONSTRAINT "ScriptOutcomeSelection_scriptMarketId_fkey" FOREIGN KEY ("scriptMarketId") REFERENCES "ScriptMarket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptOutcomeSelection" ADD CONSTRAINT "ScriptOutcomeSelection_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "PolymarketOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderIntent" ADD CONSTRAINT "OrderIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderIntent" ADD CONSTRAINT "OrderIntent_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "CausalScript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CausewayOrder" ADD CONSTRAINT "CausewayOrder_orderIntentId_fkey" FOREIGN KEY ("orderIntentId") REFERENCES "OrderIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CausewayOrder" ADD CONSTRAINT "CausewayOrder_selectionId_fkey" FOREIGN KEY ("selectionId") REFERENCES "ScriptOutcomeSelection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CausewayOrder" ADD CONSTRAINT "CausewayOrder_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "PolymarketMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CausewayOrder" ADD CONSTRAINT "CausewayOrder_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "PolymarketOutcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSubmission" ADD CONSTRAINT "OrderSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderSubmission" ADD CONSTRAINT "OrderSubmission_orderIntentId_fkey" FOREIGN KEY ("orderIntentId") REFERENCES "OrderIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPosition" ADD CONSTRAINT "ExternalPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPosition" ADD CONSTRAINT "ExternalPosition_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "PolymarketMarket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalPosition" ADD CONSTRAINT "ExternalPosition_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "PolymarketOutcome"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
