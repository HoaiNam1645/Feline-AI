CREATE TYPE "ReportRunStatus" AS ENUM (
  'SCHEDULED',
  'EXTRACTING',
  'VALIDATING',
  'SNAPSHOT_SAVED',
  'RENDERING',
  'READY_TO_SEND',
  'SENDING',
  'SENT',
  'RETRY_WAIT',
  'DEGRADED_READY',
  'SENT_DEGRADED',
  'FAILED_ALERTED'
);

CREATE TABLE "DailyReportRun" (
  "id" TEXT NOT NULL,
  "reportDate" DATE NOT NULL,
  "status" "ReportRunStatus" NOT NULL DEFAULT 'SCHEDULED',
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "correlationId" TEXT NOT NULL,
  "degraded" BOOLEAN NOT NULL DEFAULT false,
  "lastError" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyReportRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetricSnapshot" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "specVersion" TEXT NOT NULL,
  "windowStartUtc" TIMESTAMP(3) NOT NULL,
  "windowEndUtc" TIMESTAMP(3) NOT NULL,
  "sourceFreshness" JSONB NOT NULL,
  "metrics" JSONB NOT NULL,
  "validation" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportArtifact" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "promptVersion" TEXT,
  "model" TEXT,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "estimatedCostUsd" DECIMAL(12,6),
  "telegramMessageId" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportArtifact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "fromState" "ReportRunStatus",
  "toState" "ReportRunStatus" NOT NULL,
  "attempt" INTEGER NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyReportRun_reportDate_key" ON "DailyReportRun"("reportDate");
CREATE UNIQUE INDEX "DailyReportRun_correlationId_key" ON "DailyReportRun"("correlationId");
CREATE UNIQUE INDEX "MetricSnapshot_runId_key" ON "MetricSnapshot"("runId");
CREATE UNIQUE INDEX "ReportArtifact_runId_key" ON "ReportArtifact"("runId");
CREATE INDEX "AuditEvent_runId_createdAt_idx" ON "AuditEvent"("runId", "createdAt");

ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "DailyReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportArtifact" ADD CONSTRAINT "ReportArtifact_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "DailyReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "DailyReportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
