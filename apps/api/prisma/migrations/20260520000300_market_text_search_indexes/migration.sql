CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "PolymarketMarket_question_trgm_idx"
ON "PolymarketMarket" USING GIN ("question" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "PolymarketMarket_description_trgm_idx"
ON "PolymarketMarket" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "PolymarketMarket_rules_trgm_idx"
ON "PolymarketMarket" USING GIN ("rules" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "PolymarketEvent_title_trgm_idx"
ON "PolymarketEvent" USING GIN ("title" gin_trgm_ops);
