CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "agentId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationTeam" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "externalSource" TEXT,
  "externalId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationTeam_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User"
  ADD COLUMN "departmentId" TEXT,
  ADD COLUMN "teamId" TEXT,
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalUserId" TEXT,
  ADD COLUMN "employeeCode" TEXT,
  ADD COLUMN "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WorkTask" ADD COLUMN "teamId" TEXT;

CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");
CREATE INDEX "Department_isActive_name_idx" ON "Department"("isActive", "name");
CREATE UNIQUE INDEX "OrganizationTeam_departmentId_code_key" ON "OrganizationTeam"("departmentId", "code");
CREATE UNIQUE INDEX "OrganizationTeam_externalSource_externalId_key" ON "OrganizationTeam"("externalSource", "externalId");
CREATE INDEX "OrganizationTeam_departmentId_isActive_name_idx" ON "OrganizationTeam"("departmentId", "isActive", "name");
CREATE UNIQUE INDEX "User_externalSource_externalUserId_key" ON "User"("externalSource", "externalUserId");
CREATE INDEX "User_departmentId_teamId_status_idx" ON "User"("departmentId", "teamId", "status");
CREATE INDEX "WorkTask_teamId_status_dueAt_idx" ON "WorkTask"("teamId", "status", "dueAt");

ALTER TABLE "OrganizationTeam" ADD CONSTRAINT "OrganizationTeam_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "OrganizationTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "OrganizationTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Department" ("id", "code", "name", "agentId", "updatedAt")
VALUES ('dept_tiktok', 'TIKTOK', 'Phòng Sell TikTok', 'tiktok-ai', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "OrganizationTeam" ("id", "departmentId", "code", "name", "externalSource", "externalId", "updatedAt")
SELECT 'team_tiktok_g9b', "id", 'G9B', 'G9B', 'tiktok-mysql', '24', CURRENT_TIMESTAMP
FROM "Department" WHERE "code" = 'TIKTOK'
ON CONFLICT ("departmentId", "code") DO NOTHING;

UPDATE "User"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "code" = 'TIKTOK')
WHERE "departmentCode" = 'TIKTOK' AND "departmentId" IS NULL;
