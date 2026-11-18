CREATE TYPE "TeamDailyReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED');

CREATE TABLE "TeamDailyReport" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "departmentCode" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "reportDate" DATE NOT NULL,
    "status" "TeamDailyReportStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT NOT NULL,
    "completedWork" TEXT NOT NULL,
    "inProgressWork" TEXT NOT NULL,
    "blockers" TEXT NOT NULL,
    "nextPlan" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "submittedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamDailyReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamDailyReportComment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamDailyReportComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamDailyReport_teamId_reportDate_key" ON "TeamDailyReport"("teamId", "reportDate");
CREATE INDEX "TeamDailyReport_departmentId_reportDate_idx" ON "TeamDailyReport"("departmentId", "reportDate");
CREATE INDEX "TeamDailyReport_teamId_reportDate_idx" ON "TeamDailyReport"("teamId", "reportDate");
CREATE INDEX "TeamDailyReport_status_reportDate_idx" ON "TeamDailyReport"("status", "reportDate");
CREATE INDEX "TeamDailyReportComment_reportId_createdAt_idx" ON "TeamDailyReportComment"("reportId", "createdAt");
CREATE INDEX "TeamDailyReportComment_actorUserId_createdAt_idx" ON "TeamDailyReportComment"("actorUserId", "createdAt");

ALTER TABLE "TeamDailyReport" ADD CONSTRAINT "TeamDailyReport_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamDailyReport" ADD CONSTRAINT "TeamDailyReport_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "OrganizationTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamDailyReport" ADD CONSTRAINT "TeamDailyReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamDailyReport" ADD CONSTRAINT "TeamDailyReport_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamDailyReport" ADD CONSTRAINT "TeamDailyReport_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamDailyReportComment" ADD CONSTRAINT "TeamDailyReportComment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "TeamDailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamDailyReportComment" ADD CONSTRAINT "TeamDailyReportComment_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
