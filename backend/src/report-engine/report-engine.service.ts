import { Injectable } from "@nestjs/common";
import { ReportRunStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { WorkshopDailyMetrics } from "../metrics/workshop-metrics.service";
import { ReportRendererService } from "./report-renderer.service";

@Injectable()
export class ReportEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: ReportRendererService
  ) {}

  async renderAndStore(
    runId: string,
    attempt: number,
    metrics: WorkshopDailyMetrics
  ): Promise<string> {
    await this.prisma.$transaction([
      this.prisma.dailyReportRun.update({
        where: { id: runId },
        data: { status: ReportRunStatus.RENDERING }
      }),
      this.prisma.auditEvent.create({
        data: {
          runId,
          fromState: ReportRunStatus.SNAPSHOT_SAVED,
          toState: ReportRunStatus.RENDERING,
          attempt
        }
      })
    ]);

    const content = this.renderer.render(metrics);

    await this.prisma.$transaction([
      this.prisma.reportArtifact.upsert({
        where: { runId },
        create: {
          runId,
          content,
          promptVersion: ReportRendererService.TEMPLATE_VERSION
        },
        update: {
          content,
          promptVersion: ReportRendererService.TEMPLATE_VERSION,
          model: null,
          inputTokens: null,
          outputTokens: null,
          estimatedCostUsd: null
        }
      }),
      this.prisma.dailyReportRun.update({
        where: { id: runId },
        data: { status: ReportRunStatus.READY_TO_SEND }
      }),
      this.prisma.auditEvent.create({
        data: {
          runId,
          fromState: ReportRunStatus.RENDERING,
          toState: ReportRunStatus.READY_TO_SEND,
          attempt,
          detail: {
            templateVersion: ReportRendererService.TEMPLATE_VERSION,
            characterCount: content.length
          }
        }
      })
    ]);

    return content;
  }
}
