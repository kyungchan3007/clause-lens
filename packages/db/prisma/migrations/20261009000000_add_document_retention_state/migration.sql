-- 분석 결과 장기 보관 전환(저장하기, #163). analysis status와 직교한 보관 수명 축.
-- DELETING·취소는 #164가 추가. 기존 행은 기본 TEMPORARY(백필 불필요 — 과거 retainUntil 판정 그대로).

-- CreateEnum
CREATE TYPE "RetentionState" AS ENUM ('TEMPORARY', 'SAVED');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "retentionState" "RetentionState" NOT NULL DEFAULT 'TEMPORARY';
ALTER TABLE "Document" ADD COLUMN "savedAt" TIMESTAMPTZ(3);
