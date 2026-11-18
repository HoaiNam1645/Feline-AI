ALTER TABLE "WorkTask"
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "departmentCode", "status"
      ORDER BY "dueAt" ASC NULLS LAST, "createdAt" ASC
    ) - 1 AS next_position
  FROM "WorkTask"
)
UPDATE "WorkTask" AS task
SET "position" = ranked.next_position
FROM ranked
WHERE task."id" = ranked."id";

CREATE INDEX "WorkTask_departmentCode_status_position_idx"
  ON "WorkTask"("departmentCode", "status", "position");
