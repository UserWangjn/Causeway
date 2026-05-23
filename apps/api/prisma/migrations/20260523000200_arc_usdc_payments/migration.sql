-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('premium');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "ArcPaymentIntentStatus" AS ENUM ('pending', 'confirmed', 'expired', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "ArcPaymentIntent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "amountMicroUsd" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "chainId" INTEGER NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "receiverAddress" TEXT NOT NULL,
    "status" "ArcPaymentIntentStatus" NOT NULL DEFAULT 'pending',
    "txHash" TEXT,
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArcPaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "MembershipTier" NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sourcePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArcPaymentIntent_txHash_key" ON "ArcPaymentIntent"("txHash");

-- CreateIndex
CREATE INDEX "ArcPaymentIntent_userId_createdAt_idx" ON "ArcPaymentIntent"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ArcPaymentIntent_status_expiresAt_idx" ON "ArcPaymentIntent"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ArcPaymentIntent_walletAddress_chainId_idx" ON "ArcPaymentIntent"("walletAddress", "chainId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipEntitlement_userId_tier_key" ON "MembershipEntitlement"("userId", "tier");

-- CreateIndex
CREATE INDEX "MembershipEntitlement_userId_status_expiresAt_idx" ON "MembershipEntitlement"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "MembershipEntitlement_expiresAt_idx" ON "MembershipEntitlement"("expiresAt");

-- AddForeignKey
ALTER TABLE "ArcPaymentIntent" ADD CONSTRAINT "ArcPaymentIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipEntitlement" ADD CONSTRAINT "MembershipEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
