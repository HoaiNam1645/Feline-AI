CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'USER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DataScope" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "definition" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataScope_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentAccessGrant" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "capabilityIds" JSONB NOT NULL,
  "dataScopeIds" JSONB NOT NULL,
  "actions" JSONB NOT NULL,
  "grantedById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessAuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "eventType" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE INDEX "Session_expiresAt_revokedAt_idx" ON "Session"("expiresAt", "revokedAt");
CREATE INDEX "DataScope_agentId_isActive_idx" ON "DataScope"("agentId", "isActive");
CREATE INDEX "AgentAccessGrant_userId_agentId_revokedAt_idx" ON "AgentAccessGrant"("userId", "agentId", "revokedAt");
CREATE INDEX "AgentAccessGrant_grantedById_createdAt_idx" ON "AgentAccessGrant"("grantedById", "createdAt");
CREATE INDEX "AccessAuditEvent_actorUserId_createdAt_idx" ON "AccessAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "AccessAuditEvent_eventType_createdAt_idx" ON "AccessAuditEvent"("eventType", "createdAt");
CREATE INDEX "AccessAuditEvent_targetType_targetId_createdAt_idx" ON "AccessAuditEvent"("targetType", "targetId", "createdAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentAccessGrant" ADD CONSTRAINT "AgentAccessGrant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentAccessGrant" ADD CONSTRAINT "AgentAccessGrant_grantedById_fkey"
  FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccessAuditEvent" ADD CONSTRAINT "AccessAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "DataScope" ("id", "agentId", "name", "description", "definition", "updatedAt") VALUES
  ('lemiex.operations.basic', 'lemiex-ai', 'Vận hành cơ bản', 'Đơn, item, workflow, shipout, backlog, remake và chất lượng dữ liệu.', '{"datasets":["orders","items","workflow","shipout","backlog","remakes","data-quality"],"pii":false}'::jsonb, CURRENT_TIMESTAMP),
  ('lemiex.operations.costs', 'lemiex-ai', 'Chi phí vận hành', 'Chi phí fulfillment đã được nghiệp vụ duyệt.', '{"datasets":["fulfillment-costs"],"pii":false,"sensitive":true}'::jsonb, CURRENT_TIMESTAMP),
  ('lemiex.operations.detail', 'lemiex-ai', 'Chi tiết vận hành', 'Chi tiết theo đơn qua view đã loại PII.', '{"datasets":["order-detail"],"pii":false,"detailLevel":"order"}'::jsonb, CURRENT_TIMESTAMP),
  ('lemiex.operations.audit', 'lemiex-ai', 'Audit Lemiex AI', 'Run, tool call, token và lỗi trong Lemiex AI.', '{"datasets":["agent-runs","tool-calls","usage"],"pii":false}'::jsonb, CURRENT_TIMESTAMP);
