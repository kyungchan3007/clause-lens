-- CreateEnum
CREATE TYPE "ClauseRiskLevel" AS ENUM ('high', 'medium', 'low');

-- CreateTable
CREATE TABLE "PageOcr" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "engine" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "orientation" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "blocks" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageOcr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageAnalysisResult" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageAnalysisResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clause" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "riskLevel" "ClauseRiskLevel" NOT NULL,
    "sourceText" TEXT NOT NULL,
    "boxes" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clause_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PageOcr_pageId_revision_key" ON "PageOcr"("pageId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "PageAnalysisResult_pageId_revision_key" ON "PageAnalysisResult"("pageId", "revision");

-- CreateIndex
CREATE INDEX "Clause_pageId_revision_idx" ON "Clause"("pageId", "revision");

-- AddForeignKey
ALTER TABLE "PageOcr" ADD CONSTRAINT "PageOcr_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageAnalysisResult" ADD CONSTRAINT "PageAnalysisResult_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clause" ADD CONSTRAINT "Clause_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "PageAnalysisResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
