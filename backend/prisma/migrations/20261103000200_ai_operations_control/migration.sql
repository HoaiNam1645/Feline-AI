CREATE TYPE "AiUsageScopeType" AS ENUM ('USER', 'AGENT');
CREATE TYPE "AiOperationStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED', 'CANCELED', 'REJECTED');

ALTER TABLE "AgentRun"
  ADD COLUMN "actorUserId" TEXT,
  ADD COLUMN "conversationId" TEXT,
  ADD COLUMN "operationAuditId" TEXT;

CREATE UNIQUE INDEX "AgentRun_operationAuditId_key" ON "AgentRun"("operationAuditId");
CREATE INDEX "AgentRun_actorUserId_createdAt_idx" ON "AgentRun"("actorUserId", "createdAt");
CREATE INDEX "AgentRun_conversationId_createdAt_idx" ON "AgentRun"("conversationId", "createdAt");

CREATE TABLE "AiRateLimitBucket" (
  "key" TEXT NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiRateLimitBucket_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "AiUsagePolicy" (
  "id" TEXT NOT NULL,
  "scopeType" "AiUsageScopeType" NOT NULL,
  "scopeId" TEXT NOT NULL,
  "dailyTokenLimit" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiUsagePolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiUsagePolicy_scopeType_scopeId_key" ON "AiUsagePolicy"("scopeType", "scopeId");
CREATE INDEX "AiUsagePolicy_scopeType_isActive_idx" ON "AiUsagePolicy"("scopeType", "isActive");

CREATE TABLE "AiDailyUsage" (
  "id" TEXT NOT NULL,
  "usageDate" DATE NOT NULL,
  "scopeType" "AiUsageScopeType" NOT NULL,
  "scopeId" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "reservedTokens" INTEGER NOT NULL DEFAULT 0,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(14,6) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiDailyUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiDailyUsage_usageDate_scopeType_scopeId_key" ON "AiDailyUsage"("usageDate", "scopeType", "scopeId");
CREATE INDEX "AiDailyUsage_scopeType_scopeId_usageDate_idx" ON "AiDailyUsage"("scopeType", "scopeId", "usageDate");

CREATE TABLE "AiOperationAudit" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "agentId" TEXT NOT NULL,
  "capabilityId" TEXT NOT NULL,
  "conversationId" TEXT,
  "userMessageId" TEXT,
  "assistantMessageId" TEXT,
  "agentRunId" TEXT,
  "status" "AiOperationStatus" NOT NULL DEFAULT 'STARTED',
  "question" TEXT NOT NULL,
  "model" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "estimatedCostUsd" DECIMAL(14,6),
  "toolCalls" JSONB,
  "errorCode" TEXT,
  "error" TEXT,
  "metadata" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiOperationAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiOperationAudit_userId_createdAt_idx" ON "AiOperationAudit"("userId", "createdAt");
CREATE INDEX "AiOperationAudit_agentId_createdAt_idx" ON "AiOperationAudit"("agentId", "createdAt");
CREATE INDEX "AiOperationAudit_conversationId_createdAt_idx" ON "AiOperationAudit"("conversationId", "createdAt");
CREATE INDEX "AiOperationAudit_status_createdAt_idx" ON "AiOperationAudit"("status", "createdAt");

ALTER TABLE "AiOperationAudit" ADD CONSTRAINT "AiOperationAudit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The database, not a single API process, enforces one in-flight answer per conversation.
CREATE UNIQUE INDEX "ChatMessage_one_pending_assistant_per_conversation"
  ON "ChatMessage"("conversationId")
  WHERE "role" = 'ASSISTANT' AND "status" = 'PENDING';
