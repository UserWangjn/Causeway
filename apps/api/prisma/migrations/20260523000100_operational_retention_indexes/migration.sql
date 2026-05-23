CREATE INDEX "WalletSession_nonceExpiresAt_idx" ON "WalletSession"("nonceExpiresAt");
CREATE INDEX "WalletSession_sessionExpiresAt_idx" ON "WalletSession"("sessionExpiresAt");
CREATE INDEX "OrderIntent_status_previewExpiresAt_idx" ON "OrderIntent"("status", "previewExpiresAt");
CREATE INDEX "OrderIntent_status_updatedAt_idx" ON "OrderIntent"("status", "updatedAt");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
