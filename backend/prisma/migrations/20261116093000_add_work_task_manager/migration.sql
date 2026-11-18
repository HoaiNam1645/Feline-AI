CREATE TYPE "WorkTaskStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELED');
CREATE TYPE "WorkTaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "WorkTask" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "departmentCode" TEXT NOT NULL,
  "departmentName" TEXT NOT NULL,
  "agentId" TEXT,
  "priority" "WorkTaskPriority" NOT NULL DEFAULT 'NORMAL',
  "status" "WorkTaskStatus" NOT NULL DEFAULT 'DRAFT',
  "progressPercent" INTEGER NOT NULL DEFAULT 0,
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "blockedReason" TEXT,
  "completionNote" TEXT,
  "createdById" TEXT NOT NULL,
  "assigneeId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkTaskUpdate" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "message" TEXT,
  "fromStatus" "WorkTaskStatus",
  "toStatus" "WorkTaskStatus",
  "progressPercent" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkTaskUpdate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkTask_code_key" ON "WorkTask"("code");
CREATE INDEX "WorkTask_departmentCode_status_dueAt_idx" ON "WorkTask"("departmentCode", "status", "dueAt");
CREATE INDEX "WorkTask_assigneeId_status_dueAt_idx" ON "WorkTask"("assigneeId", "status", "dueAt");
CREATE INDEX "WorkTask_createdById_createdAt_idx" ON "WorkTask"("createdById", "createdAt");
CREATE INDEX "WorkTaskUpdate_taskId_createdAt_idx" ON "WorkTaskUpdate"("taskId", "createdAt");
CREATE INDEX "WorkTaskUpdate_actorUserId_createdAt_idx" ON "WorkTaskUpdate"("actorUserId", "createdAt");
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkTaskUpdate" ADD CONSTRAINT "WorkTaskUpdate_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkTaskUpdate" ADD CONSTRAINT "WorkTaskUpdate_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
