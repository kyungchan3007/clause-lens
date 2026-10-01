-- 분석 기록 재열람(0030): 문서 보관 모델. 세션 TTL(expiresAt)과 분리된 재열람 기한.
-- completedAt = terminal(done|partial) 최초 확정 시각, retainUntil = completedAt + 7일.

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "completedAt" TIMESTAMPTZ(3);
ALTER TABLE "Document" ADD COLUMN "retainUntil" TIMESTAMPTZ(3);

-- CreateIndex: 재열람 목록(소유자 + 보관 유효 + 완료순)
CREATE INDEX "Document_userId_retainUntil_completedAt_idx"
  ON "Document" ("userId", "retainUntil", "completedAt");

-- 백필: 기존 done|partial 문서의 보관 기한을 소급 설정.
-- completedAt = 최신 성공 job(done|partial)의 updatedAt, 없으면 문서 createdAt.
-- retainUntil = completedAt + 7일 (이미 지난 건은 지난 값 그대로 → 접근 차단과 일관).
UPDATE "Document" d
SET "completedAt" = sub."completedAt",
    "retainUntil" = sub."completedAt" + interval '7 days'
FROM (
  SELECT d2."id" AS "docId",
         COALESCE(
           (SELECT max(j."updatedAt")
            FROM "AnalysisJob" j
            WHERE j."documentId" = d2."id" AND j."status" IN ('done', 'partial')),
           d2."createdAt"
         ) AS "completedAt"
  FROM "Document" d2
  WHERE d2."status" IN ('done', 'partial')
) sub
WHERE d."id" = sub."docId" AND d."completedAt" IS NULL;
