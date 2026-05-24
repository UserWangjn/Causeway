DROP INDEX IF EXISTS "PolymarketMarket_event_open_volume24hr_idx";

CREATE INDEX "PolymarketMarket_event_open_volume24hr_idx"
ON "PolymarketMarket"("eventId", "archived", "staleDetectedAt", "closed", "active", "acceptingOrders", "enableOrderBook", "volume24hr", "volume", "id");

CREATE INDEX IF NOT EXISTS "MarketNetworkNode_category_score_idx"
ON "MarketNetworkNode"("category", "score");
