ALTER TABLE "PolymarketEvent"
ADD COLUMN "lastSeenAt" TIMESTAMP(3),
ADD COLUMN "staleDetectedAt" TIMESTAMP(3),
ADD COLUMN "staleReason" TEXT;

ALTER TABLE "PolymarketMarket"
ADD COLUMN "lastSeenAt" TIMESTAMP(3),
ADD COLUMN "staleDetectedAt" TIMESTAMP(3),
ADD COLUMN "staleReason" TEXT;

UPDATE "PolymarketEvent"
SET "lastSeenAt" = "syncedAt"
WHERE "lastSeenAt" IS NULL;

UPDATE "PolymarketMarket"
SET "lastSeenAt" = "syncedAt"
WHERE "lastSeenAt" IS NULL;

CREATE INDEX "PolymarketEvent_lastSeenAt_idx" ON "PolymarketEvent"("lastSeenAt");
CREATE INDEX "PolymarketEvent_staleDetectedAt_idx" ON "PolymarketEvent"("staleDetectedAt");
CREATE INDEX "PolymarketMarket_active_closed_archived_staleDetectedAt_idx" ON "PolymarketMarket"("active", "closed", "archived", "staleDetectedAt");
CREATE INDEX "PolymarketMarket_lastSeenAt_idx" ON "PolymarketMarket"("lastSeenAt");
CREATE INDEX "PolymarketMarket_staleDetectedAt_idx" ON "PolymarketMarket"("staleDetectedAt");
