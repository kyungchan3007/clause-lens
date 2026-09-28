-- CreateEnum
CREATE TYPE "AnalysisJobStatus" AS ENUM ('queued', 'processing', 'done', 'partial', 'failed');

-- CreateEnum
CREATE TYPE "PageAnalysisStatus" AS ENUM ('pending', 'processing', 'done', 'failed');

-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'partial';

-- CreateTable
CREATE TABLE "AnalysisJob" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "AnalysisJobStatus" NOT NULL DEFAULT 'queued',
    "totalPages" INTEGER NOT NULL,
    "stateVersion" INTEGER NOT NULL DEFAULT 1,
    "dispatchedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageAnalysis" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "PageAnalysisStatus" NOT NULL DEFAULT 'pending',
    "errorCode" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalysisJob_documentId_status_idx" ON "AnalysisJob"("documentId", "status");

-- CreateIndex
CREATE INDEX "PageAnalysis_pageId_idx" ON "PageAnalysis"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "PageAnalysis_jobId_pageId_key" ON "PageAnalysis"("jobId", "pageId");

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageAnalysis" ADD CONSTRAINT "PageAnalysis_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AnalysisJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageAnalysis" ADD CONSTRAINT "PageAnalysis_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 활성 job(queued|processing) 문서당 1개 강제 — Prisma가 표현 못 하는 부분 유니크 인덱스(설계 0020 §③ 접수 유일성).
CREATE UNIQUE INDEX "AnalysisJob_active_documentId_key" ON "AnalysisJob"("documentId") WHERE "status" IN ('queued', 'processing');
