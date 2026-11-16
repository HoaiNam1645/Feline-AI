import { Logger } from "@nestjs/common";
import {
  OnWorkerEvent,
  Processor,
  WorkerHost
} from "@nestjs/bullmq";
import { Prisma, ReportRunStatus } from "@prisma/client";
import { Job } from "bullmq";
import { LemiexAgentService } from "../agents/lemiex-agent.service";
import { PrismaService } from "../database/prisma.service";
import { WorkshopMetricsService } from "../metrics/workshop-metrics.service";
import { ReportEngineService } from "../report-engine/report-engine.service";
import {
  GENERATE_DAILY_REPORT_JOB,
  REPORT_QUEUE
} from "./report.constants";

interface DailyReportJobData {
  reportDate: string;
  timeZone: string;
}

@Processor(REPORT_QUEUE)
export class ReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: WorkshopMetricsService,
    private readonly reportEngine: ReportEngineService,
    private readonly lemiexAi: LemiexAgentService
  ) {
    super();
  }

  async process(job: Job<DailyReportJobData>): Promise<void> {
    if (job.name !== GENERATE_DAILY_REPORT_JOB) {
      throw new Error(`Unsupported job: ${job.name}`);
    }

    const reportDate = new Date(`${job.data.reportDate}T00:00:00.000Z`);
    const correlationId = `workshop-daily-${job.data.reportDate}`;
    const existing = await this.prisma.dailyReportRun.findUnique({
      where: { reportDate }
    });

    if (
      existing?.status === ReportRunStatus.SENT ||
      existing?.status === ReportRunStatus.SENT_DEGRADED
    ) {
      this.logger.log(`Report ${job.data.reportDate} already sent`);
      return;
    }

    const run = await this.prisma.dailyReportRun.upsert({
      where: { reportDate },
      create: {
        reportDate,
        correlationId,
        status: ReportRunStatus.EXTRACTING,
        attempt: job.attemptsMade + 1,
        startedAt: new Date()
      },
      update: {
        status: ReportRunStatus.EXTRACTING,
        attempt: job.attemptsMade + 1,
        lastError: null,
        startedAt: existing?.startedAt ?? new Date()
      }
    });

    await this.prisma.auditEvent.create({
      data: {
        runId: run.id,
        fromState: existing?.status,
        toState: ReportRunStatus.EXTRACTING,
        attempt: job.attemptsMade + 1
      }
    });

    const snapshot = await this.metrics.calculateDaily(job.data.reportDate);

    await this.prisma.$transaction(async (tx) => {
      await tx.dailyReportRun.update({
        where: { id: run.id },
        data: { status: ReportRunStatus.VALIDATING }
      });
      await tx.auditEvent.create({
        data: {
          runId: run.id,
          fromState: ReportRunStatus.EXTRACTING,
          toState: ReportRunStatus.VALIDATING,
          attempt: job.attemptsMade + 1
        }
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
          attempt: job.attemptsMade + 1
        }
      });
    });

    this.logger.log(`Metric snapshot saved for ${job.data.reportDate}`);
    const content = await this.reportEngine.renderAndStore(
      run.id,
      job.attemptsMade + 1,
      snapshot
    );
    this.logger.log(
      `Report artifact ready for ${job.data.reportDate} (${content.length} chars)`
    );
    if (this.lemiexAi.isEnabled()) {
      try {
        await this.lemiexAi.run("lemiex.operations.daily-review", {
          reportDate: job.data.reportDate
        });
        this.logger.log(`Lemiex AI review completed for ${job.data.reportDate}`);
      } catch (error) {
        this.logger.error(
          `Lemiex AI review failed; deterministic report remains ready: ${
            error instanceof Error ? error.message : "unknown error"
          }`
        );
      }
    } else {
      this.logger.log("Lemiex AI is disabled; deterministic report remains ready");
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<DailyReportJobData> | undefined, error: Error) {
    if (!job?.data.reportDate) return;

    const reportDate = new Date(`${job.data.reportDate}T00:00:00.000Z`);
    const finalAttempt = job.attemptsMade >= Number(job.opts.attempts ?? 1);
    const status = finalAttempt
      ? ReportRunStatus.FAILED_ALERTED
      : ReportRunStatus.RETRY_WAIT;

    const current = await this.prisma.dailyReportRun.findUnique({
      where: { reportDate }
    });
    if (!current) return;

    const run = await this.prisma.dailyReportRun.update({
      where: { reportDate },
      data: { status, lastError: error.message.slice(0, 1000) }
    });
    await this.prisma.auditEvent.create({
      data: {
        runId: run.id,
        fromState: current.status,
        toState: status,
        attempt: job.attemptsMade,
        detail: { message: error.message.slice(0, 1000) }
      }
    });
  }
}
