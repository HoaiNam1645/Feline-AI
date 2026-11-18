CREATE TABLE "WorkTaskChecklistItem" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTaskChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkTaskChecklistItem_taskId_position_idx" ON "WorkTaskChecklistItem"("taskId", "position");
CREATE INDEX "WorkTaskChecklistItem_completedById_idx" ON "WorkTaskChecklistItem"("completedById");

ALTER TABLE "WorkTaskChecklistItem"
ADD CONSTRAINT "WorkTaskChecklistItem_taskId_fkey"
FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkTaskChecklistItem"
ADD CONSTRAINT "WorkTaskChecklistItem_completedById_fkey"
FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
