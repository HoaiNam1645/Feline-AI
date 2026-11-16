CREATE TABLE "CeoAnswerCache" (
  "id" TEXT NOT NULL,
  "exactHash" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "capabilityId" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "knowledgeFingerprint" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "normalizedQuestion" TEXT NOT NULL,
  "questionEmbedding" JSONB NOT NULL,
  "answer" JSONB NOT NULL,
  "hitCount" INTEGER NOT NULL DEFAULT 0,
  "lastHitAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CeoAnswerCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CeoAnswerCache_exactHash_key" ON "CeoAnswerCache"("exactHash");
CREATE INDEX "CeoAnswerCache_scope_lookup_idx" ON "CeoAnswerCache"("agentId", "capabilityId", "scopeKey", "knowledgeFingerprint", "promptVersion", "expiresAt");
CREATE INDEX "CeoAnswerCache_expiresAt_idx" ON "CeoAnswerCache"("expiresAt");
