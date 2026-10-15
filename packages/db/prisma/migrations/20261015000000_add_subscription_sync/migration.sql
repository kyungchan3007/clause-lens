-- AlterTable (#165 Slice 1: grace 유예 종료 기한)
ALTER TABLE "Subscription" ADD COLUMN     "gracePeriodEnd" TIMESTAMPTZ(3);

-- CreateEnum
CREATE TYPE "BillingProvider" AS ENUM ('REVENUECAT');

-- CreateEnum
CREATE TYPE "SubscriptionEventStatus" AS ENUM ('received', 'processing', 'processed', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "projectId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SubscriptionEventStatus" NOT NULL DEFAULT 'received',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMPTZ(3),
    "errorCode" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMPTZ(3),

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingCustomer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEvent_provider_projectId_eventId_key" ON "SubscriptionEvent"("provider", "projectId", "eventId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_status_nextRetryAt_idx" ON "SubscriptionEvent"("status", "nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingCustomer_provider_customerId_key" ON "BillingCustomer"("provider", "customerId");

-- CreateIndex
CREATE INDEX "BillingCustomer_userId_idx" ON "BillingCustomer"("userId");

-- AddForeignKey
ALTER TABLE "BillingCustomer" ADD CONSTRAINT "BillingCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
