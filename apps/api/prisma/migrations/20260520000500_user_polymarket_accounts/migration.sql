CREATE TABLE "UserPolymarketAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "signatureType" INTEGER NOT NULL DEFAULT 3,
    "clobApiKeyCiphertext" TEXT,
    "clobApiSecretCiphertext" TEXT,
    "clobApiPassphraseCiphertext" TEXT,
    "clobApiKeyPreview" TEXT,
    "clobApiCreatedAt" TIMESTAMP(3),
    "depositWalletAddress" TEXT,
    "depositWalletDeployed" BOOLEAN NOT NULL DEFAULT false,
    "depositWalletTxId" TEXT,
    "depositWalletTxState" TEXT,
    "balanceRaw" TEXT,
    "allowanceJson" JSONB,
    "readinessStatus" TEXT NOT NULL DEFAULT 'not_ready',
    "readinessReason" TEXT,
    "lastReadinessCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPolymarketAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserPolymarketAccount_userId_key" ON "UserPolymarketAccount"("userId");
CREATE INDEX "UserPolymarketAccount_walletAddress_chainId_idx" ON "UserPolymarketAccount"("walletAddress", "chainId");
CREATE INDEX "UserPolymarketAccount_readinessStatus_updatedAt_idx" ON "UserPolymarketAccount"("readinessStatus", "updatedAt" DESC);

ALTER TABLE "UserPolymarketAccount"
ADD CONSTRAINT "UserPolymarketAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
