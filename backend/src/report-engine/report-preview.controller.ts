import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param
} from "@nestjs/common";
import { RequireAgentAccess } from "../auth/access-control";
import { PrismaService } from "../database/prisma.service";
import { reportWindow } from "../metrics/report-window";
import { WorkshopDailyMetrics } from "../metrics/workshop-metrics.service";
import { ReportRendererService } from "./report-renderer.service";

@Controller("reports/workshop/daily")
export class ReportPreviewController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: ReportRendererService
  ) {}

  @RequireAgentAccess({
    agentId: "lemiex-ai",
    action: "view",
    dataScopeIds: ["lemiex.operations.basic"]
  })
  @Get(":date")
  async getReport(@Param("date") date: string) {
    try {
      reportWindow(date);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid report date"
      );
    }
    const run = await this.prisma.dailyReportRun.findUnique({
      where: { reportDate: new Date(`${date}T00:00:00.000Z`) },
      include: { snapshot: true, artifact: true }
    });
    if (!run?.snapshot) {
      throw new NotFoundException(`No metric snapshot for ${date}`);
    }

    const content = run.artifact?.content ?? this.renderer.render(
      run.snapshot.metrics as unknown as WorkshopDailyMetrics
    );
    return {
      reportDate: date,
      status: run.status,
      templateVersion: run.artifact?.promptVersion
        ?? ReportRendererService.TEMPLATE_VERSION,
      characterCount: content.length,
      content
    };
  }
}
