-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'uploaded', 'analyzing', 'done', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('pending', 'uploaded');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'draft',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "contentType" TEXT NOT NULL,
    "expectedSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "finalKey" TEXT,
    "status" "PageStatus" NOT NULL DEFAULT 'pending',
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_userId_status_idx" ON "Document"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Document_userId_clientRequestId_key" ON "Document"("userId", "clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_finalKey_key" ON "Page"("finalKey");

-- CreateIndex
CREATE UNIQUE INDEX "Page_documentId_order_key" ON "Page"("documentId", "order");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

