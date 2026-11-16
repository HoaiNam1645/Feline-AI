CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'BLOCKED');
CREATE TYPE "AgentToolCallStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "AgentRun" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "capabilityId" TEXT NOT NULL,
  "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  "input" JSONB NOT NULL,
  "output" JSONB,
  "model" TEXT,
  "promptVersion" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "estimatedCostUsd" DECIMAL(12,6),
  "error" TEXT,
  "metricSnapshotId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentToolCall" (
  "id" TEXT NOT NULL,
  "agentRunId" TEXT NOT NULL,
  "toolId" TEXT NOT NULL,
  "status" "AgentToolCallStatus" NOT NULL DEFAULT 'RUNNING',
  "input" JSONB NOT NULL,
  "output" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentToolCall_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentRun_agentId_capabilityId_createdAt_idx"
  ON "AgentRun"("agentId", "capabilityId", "createdAt");
CREATE INDEX "AgentRun_metricSnapshotId_idx" ON "AgentRun"("metricSnapshotId");
CREATE INDEX "AgentToolCall_agentRunId_createdAt_idx"
  ON "AgentToolCall"("agentRunId", "createdAt");

ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_metricSnapshotId_fkey"
  FOREIGN KEY ("metricSnapshotId") REFERENCES "MetricSnapshot"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AgentToolCall" ADD CONSTRAINT "AgentToolCall_agentRunId_fkey"
  FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
