DROP INDEX IF EXISTS "PolymarketMarket_event_open_volume24hr_idx";

CREATE INDEX IF NOT EXISTS "PolymarketMarket_event_open_volume24hr_idx"
ON "PolymarketMarket"(
  "eventId",
  "archived",
  "staleDetectedAt",
  "closed" ASC,
  "active" DESC,
  "acceptingOrders" DESC,
  "enableOrderBook" DESC,
  "volume24hr" DESC NULLS LAST,
  "volume" DESC NULLS LAST,
  "id" ASC
);

CREATE INDEX IF NOT EXISTS "MarketNetworkNode_category_score_idx"
ON "MarketNetworkNode"("category", "score");
