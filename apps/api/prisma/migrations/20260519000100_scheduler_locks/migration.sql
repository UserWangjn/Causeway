CREATE TABLE "SchedulerLock" (
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerLock_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "SchedulerLock_lockedUntil_idx" ON "SchedulerLock"("lockedUntil");
