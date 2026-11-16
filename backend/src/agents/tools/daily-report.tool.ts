import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { reportWindow } from "../../metrics/report-window";
import { AgentTool } from "./agent-tool";

export interface DailyReportToolOutput {
  templateVersion: string | null;
  content: string;
}

@Injectable()
export class DailyReportTool implements AgentTool<
  { reportDate: string },
  DailyReportToolOutput
> {
  readonly id = "lemiex.reports.daily-artifact";
  readonly description = "Đọc báo cáo deterministic đã được Report Engine tạo từ snapshot KPI.";

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: { reportDate: string }): Promise<DailyReportToolOutput> {
    reportWindow(input.reportDate);
    const artifact = await this.prisma.reportArtifact.findFirst({
      where: {
        run: { reportDate: new Date(`${input.reportDate}T00:00:00.000Z`) }
      }
    });
    if (!artifact) {
      throw new NotFoundException(`No report artifact for ${input.reportDate}`);
    }
    return {
      templateVersion: artifact.promptVersion,
      content: artifact.content
    };
  }
}
