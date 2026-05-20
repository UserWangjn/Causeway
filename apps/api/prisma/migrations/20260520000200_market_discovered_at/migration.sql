ALTER TABLE "PolymarketMarket"
ADD COLUMN "discoveredAt" TIMESTAMP(3);

UPDATE "PolymarketMarket"
SET "discoveredAt" = COALESCE(
  CASE
    WHEN "rawPayload"->>'createdAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      THEN (("rawPayload"->>'createdAt')::timestamptz AT TIME ZONE 'UTC')
  END,
  CASE
    WHEN "rawPayload"->>'created_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      THEN (("rawPayload"->>'created_at')::timestamptz AT TIME ZONE 'UTC')
  END,
  CASE
    WHEN "rawPayload"->>'createdDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      THEN (("rawPayload"->>'createdDate')::timestamptz AT TIME ZONE 'UTC')
  END,
  CASE
    WHEN "rawPayload"->>'startDate' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      THEN (("rawPayload"->>'startDate')::timestamptz AT TIME ZONE 'UTC')
  END,
  "lastSeenAt",
  "syncedAt",
  CURRENT_TIMESTAMP
)
WHERE "discoveredAt" IS NULL;

ALTER TABLE "PolymarketMarket"
ALTER COLUMN "discoveredAt" SET NOT NULL,
ALTER COLUMN "discoveredAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "PolymarketMarket_discoveredAt_idx" ON "PolymarketMarket"("discoveredAt");
