-- CreateEnum
CREATE TYPE "ChargeSource" AS ENUM ('FREE', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "SubscriptionPlatform" AS ENUM ('APP_STORE', 'PLAY', 'TEST');

-- CreateEnum
CREATE TYPE "SubscriptionPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'grace', 'expired');

-- AlterTable
ALTER TABLE "EntitlementCharge" ADD COLUMN     "source" "ChargeSource" NOT NULL DEFAULT 'FREE';

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "SubscriptionPlatform" NOT NULL,
    "productId" TEXT NOT NULL,
    "period" "SubscriptionPeriod" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "externalId" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMPTZ(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_platform_externalId_key" ON "Subscription"("platform", "externalId");

-- CreateIndex
CREATE INDEX "EntitlementCharge_userId_source_createdAt_idx" ON "EntitlementCharge"("userId", "source", "createdAt");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

