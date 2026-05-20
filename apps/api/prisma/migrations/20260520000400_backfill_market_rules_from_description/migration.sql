UPDATE "PolymarketMarket"
SET "rules" = "description"
WHERE ("rules" IS NULL OR btrim("rules") = '')
  AND "description" IS NOT NULL
  AND btrim("description") <> '';
