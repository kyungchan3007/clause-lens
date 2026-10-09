-- 보관 만료 실삭제 잡(#164). 무료(TEMPORARY) 만료 문서 물리 삭제 상태·감사 로그.
-- DELETING은 비가역(실삭제 진행). documentVisible default-deny로 상세/저장에서 자동 숨김.

-- AlterEnum
ALTER TYPE "RetentionState" ADD VALUE 'DELETING';

-- CreateTable: 삭제 감사 로그(append-only, FK 없음 — 대상 Document는 삭제됨)
CREATE TABLE "DeletionAudit" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "pageCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletionAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletionAudit_userId_createdAt_idx" ON "DeletionAudit"("userId", "createdAt");
