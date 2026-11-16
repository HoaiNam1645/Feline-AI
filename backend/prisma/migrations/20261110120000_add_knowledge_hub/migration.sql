-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeVersionStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "departmentCode" TEXT;

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL DEFAULT 'ceo-ai',
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "ownerDepartmentCode" TEXT NOT NULL,
    "ownerDepartmentName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersionNumber" INTEGER NOT NULL DEFAULT 0,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "KnowledgeVersionStatus" NOT NULL DEFAULT 'PROCESSING',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "originalFileName" TEXT,
    "mimeType" TEXT,
    "objectKey" TEXT,
    "checksumSha256" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "characterCount" INTEGER NOT NULL,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "embeddingModel" TEXT,
    "error" TEXT,
    "createdById" TEXT,
    "indexedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tokenEstimate" INTEGER NOT NULL,
    "embedding" JSONB NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocumentAccess" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeDocumentAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_slug_key" ON "KnowledgeDocument"("slug");
CREATE INDEX "KnowledgeDocument_agentId_status_updatedAt_idx" ON "KnowledgeDocument"("agentId", "status", "updatedAt");
CREATE INDEX "KnowledgeDocument_ownerDepartmentCode_status_idx" ON "KnowledgeDocument"("ownerDepartmentCode", "status");
CREATE INDEX "KnowledgeDocument_isMock_status_idx" ON "KnowledgeDocument"("isMock", "status");
CREATE UNIQUE INDEX "KnowledgeDocumentVersion_documentId_versionNumber_key" ON "KnowledgeDocumentVersion"("documentId", "versionNumber");
CREATE INDEX "KnowledgeDocumentVersion_documentId_status_createdAt_idx" ON "KnowledgeDocumentVersion"("documentId", "status", "createdAt");
CREATE INDEX "KnowledgeDocumentVersion_effectiveFrom_effectiveTo_idx" ON "KnowledgeDocumentVersion"("effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "KnowledgeChunk_versionId_chunkIndex_key" ON "KnowledgeChunk"("versionId", "chunkIndex");
CREATE INDEX "KnowledgeChunk_versionId_chunkIndex_idx" ON "KnowledgeChunk"("versionId", "chunkIndex");
CREATE UNIQUE INDEX "KnowledgeDocumentAccess_documentId_departmentCode_key" ON "KnowledgeDocumentAccess"("documentId", "departmentCode");
CREATE INDEX "KnowledgeDocumentAccess_departmentCode_canRead_idx" ON "KnowledgeDocumentAccess"("departmentCode", "canRead");
CREATE INDEX "User_departmentCode_status_idx" ON "User"("departmentCode", "status");

-- AddForeignKey
ALTER TABLE "KnowledgeDocumentVersion" ADD CONSTRAINT "KnowledgeDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgeDocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeDocumentAccess" ADD CONSTRAINT "KnowledgeDocumentAccess_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
