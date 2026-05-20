-- Add explicit reconciliation states for real-order submissions whose external CLOB result is unknown.
ALTER TYPE "OrderIntentStatus" ADD VALUE IF NOT EXISTS 'unknown';
ALTER TYPE "CausewayOrderStatus" ADD VALUE IF NOT EXISTS 'unknown';

-- Persist one-time Polymarket CLOB auth challenges so CLOB auth signatures cannot be replayed indefinitely.
CREATE TABLE "PolymarketAuthChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "timestamp" INTEGER NOT NULL,
    "nonce" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolymarketAuthChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PolymarketAuthChallenge_userId_walletAddress_chainId_timestamp_nonce_idx"
ON "PolymarketAuthChallenge"("userId", "walletAddress", "chainId", "timestamp", "nonce");

CREATE INDEX "PolymarketAuthChallenge_expiresAt_idx" ON "PolymarketAuthChallenge"("expiresAt");
CREATE INDEX "PolymarketAuthChallenge_usedAt_idx" ON "PolymarketAuthChallenge"("usedAt");

ALTER TABLE "PolymarketAuthChallenge"
ADD CONSTRAINT "PolymarketAuthChallenge_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
