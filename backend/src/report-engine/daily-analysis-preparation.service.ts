import { Injectable } from "@nestjs/common";
import { Prisma, ReportRunStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { WorkshopMetricsService } from "../metrics/workshop-metrics.service";
import { ReportEngineService } from "./report-engine.service";

@Injectable()
export class DailyAnalysisPreparationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: WorkshopMetricsService,
    private readonly reports: ReportEngineService
  ) {}

  async prepare(reportDateValue: string): Promise<void> {
    const reportDate = new Date(`${reportDateValue}T00:00:00.000Z`);
    const existing = await this.prisma.dailyReportRun.findUnique({
      where: { reportDate }
    });
    const attempt = (existing?.attempt ?? 0) + 1;
    const run = await this.prisma.dailyReportRun.upsert({
      where: { reportDate },
      create: {
        reportDate,
        correlationId: `workshop-daily-${reportDateValue}`,
        status: ReportRunStatus.EXTRACTING,
        attempt,
        startedAt: new Date()
      },
      update: {
        status: ReportRunStatus.EXTRACTING,
        attempt,
        lastError: null,
        startedAt: new Date(),
        completedAt: null
      }
    });

    const snapshot = await this.metrics.calculateDaily(reportDateValue);
    await this.prisma.$transaction(async (tx) => {
      await tx.auditEvent.create({
        data: {
          runId: run.id,
          fromState: existing?.status,
          toState: ReportRunStatus.EXTRACTING,
          attempt,
          detail: { trigger: "manual_analysis" }
        }
      });
      await tx.dailyReportRun.update({
        where: { id: run.id },
        data: { status: ReportRunStatus.VALIDATING }
      });
      await tx.metricSnapshot.upsert({
        where: { runId: run.id },
        create: {
          runId: run.id,
          specVersion: snapshot.meta.specVersion,
          windowStartUtc: new Date(snapshot.meta.windowStartUtc),
          windowEndUtc: new Date(snapshot.meta.windowEndUtc),
          sourceFreshness: snapshot.sourceFreshness as Prisma.InputJsonValue,
          metrics: snapshot as unknown as Prisma.InputJsonValue,
          validation: snapshot.dataQuality as Prisma.InputJsonValue
        },
        update: {
          specVersion: snapshot.meta.specVersion,
          windowStartUtc: new Date(snapshot.meta.windowStartUtc),
          windowEndUtc: new Date(snapshot.meta.windowEndUtc),
          sourceFreshness: snapshot.sourceFreshness as Prisma.InputJsonValue,
          metrics: snapshot as unknown as Prisma.InputJsonValue,
          validation: snapshot.dataQuality as Prisma.InputJsonValue
        }
      });
      await tx.dailyReportRun.update({
        where: { id: run.id },
        data: { status: ReportRunStatus.SNAPSHOT_SAVED }
      });
      await tx.auditEvent.create({
        data: {
          runId: run.id,
          fromState: ReportRunStatus.VALIDATING,
          toState: ReportRunStatus.SNAPSHOT_SAVED,
          attempt,
          detail: { trigger: "manual_analysis" }
        }
      });
    });

    await this.reports.renderAndStore(run.id, attempt, snapshot);
  }
}
