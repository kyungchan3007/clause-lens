-- CreateEnum
CREATE TYPE "EntitlementChargeStatus" AS ENUM ('reserved', 'consumed', 'released');

-- CreateTable
CREATE TABLE "Entitlement" (
    "userId" TEXT NOT NULL,
    "freeGranted" INTEGER NOT NULL DEFAULT 3,
    "freeConsumed" INTEGER NOT NULL DEFAULT 0,
    "freeReserved" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("userId")
);

-- 무결성(코덱스 리뷰): 카운터 음수·부여 초과 방지 — 원장↔카운터 드리프트를 DB가 거부(차감 버그 시 커밋 차단).
-- Prisma 스키마로 표현 불가(복합 CHECK) → 마이그레이션 SQL로만(활성 유니크 인덱스와 동일 패턴).
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_counters_check"
  CHECK ("freeConsumed" >= 0 AND "freeReserved" >= 0 AND "freeConsumed" + "freeReserved" <= "freeGranted");

-- CreateTable
CREATE TABLE "EntitlementCharge" (
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EntitlementChargeStatus" NOT NULL DEFAULT 'reserved',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMPTZ(3),

    CONSTRAINT "EntitlementCharge_pkey" PRIMARY KEY ("jobId")
);

-- CreateIndex
CREATE INDEX "EntitlementCharge_userId_status_idx" ON "EntitlementCharge"("userId", "status");

-- AddForeignKey
ALTER TABLE "Entitlement" ADD CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementCharge" ADD CONSTRAINT "EntitlementCharge_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementCharge" ADD CONSTRAINT "EntitlementCharge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
