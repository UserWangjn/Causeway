-- CreateIndex
CREATE INDEX "MembershipEntitlement_sourcePaymentIntentId_idx" ON "MembershipEntitlement"("sourcePaymentIntentId");

-- AddForeignKey
ALTER TABLE "MembershipEntitlement" ADD CONSTRAINT "MembershipEntitlement_sourcePaymentIntentId_fkey" FOREIGN KEY ("sourcePaymentIntentId") REFERENCES "ArcPaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
