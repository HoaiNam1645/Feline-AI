ALTER TABLE "WorkTask"
  ADD COLUMN "estimatedMinutes" INTEGER,
  ADD COLUMN "activeTimeSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "activeTimerStartedAt" TIMESTAMP(3);

INSERT INTO "OrganizationTeam" ("id", "departmentId", "code", "name", "externalSource", "externalId", "updatedAt")
SELECT 'team_etsy_tuyen', "id", 'TUYEN', 'Tuyen', 'manager-felineez', 'seller-team-tuyen', CURRENT_TIMESTAMP
FROM "Department"
WHERE "code" = 'ETSY'
ON CONFLICT ("departmentId", "code") DO NOTHING;
