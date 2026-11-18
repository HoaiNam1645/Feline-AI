ALTER TABLE "WorkTask"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedById" TEXT;

CREATE INDEX "WorkTask_archivedAt_status_completedAt_idx"
  ON "WorkTask"("archivedAt", "status", "completedAt");

CREATE TABLE "WorkTaskTimeEntry" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkTaskTimeEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkTaskTimeEntry_taskId_startedAt_idx"
  ON "WorkTaskTimeEntry"("taskId", "startedAt");
CREATE INDEX "WorkTaskTimeEntry_actorUserId_startedAt_idx"
  ON "WorkTaskTimeEntry"("actorUserId", "startedAt");
CREATE INDEX "WorkTaskTimeEntry_taskId_endedAt_idx"
  ON "WorkTaskTimeEntry"("taskId", "endedAt");

ALTER TABLE "WorkTaskTimeEntry"
  ADD CONSTRAINT "WorkTaskTimeEntry_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkTaskTimeEntry"
  ADD CONSTRAINT "WorkTaskTimeEntry_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the active timer already running before this migration as its first session.
INSERT INTO "WorkTaskTimeEntry" (
  "id", "taskId", "actorUserId", "startedAt", "createdAt", "updatedAt"
)
SELECT
  CONCAT('backfill_', "id"),
  "id",
  COALESCE("assigneeId", "createdById"),
  "activeTimerStartedAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "WorkTask"
WHERE "activeTimerStartedAt" IS NOT NULL;
