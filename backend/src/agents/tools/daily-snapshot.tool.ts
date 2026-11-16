import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { reportWindow } from "../../metrics/report-window";
import { WorkshopDailyMetrics } from "../../metrics/workshop-metrics.service";
import { AgentTool } from "./agent-tool";

export interface DailySnapshotToolOutput {
  snapshotId: string;
  metrics: Omit<
    WorkshopDailyMetrics,
    "source" | "sourceFreshness" | "provisionalCosts"
  >;
}

@Injectable()
export class DailySnapshotTool implements AgentTool<
  { reportDate: string },
  DailySnapshotToolOutput
> {
  readonly id = "lemiex.metrics.daily-snapshot";
  readonly description = "Đọc snapshot KPI xưởng đã được Metrics Engine lưu và loại dữ liệu không dành cho AI.";

  constructor(private readonly prisma: PrismaService) {}

  async execute(input: { reportDate: string }): Promise<DailySnapshotToolOutput> {
    reportWindow(input.reportDate);
    const snapshot = await this.prisma.metricSnapshot.findFirst({
      where: {
        run: { reportDate: new Date(`${input.reportDate}T00:00:00.000Z`) }
      }
    });
    if (!snapshot) {
      throw new NotFoundException(`No metric snapshot for ${input.reportDate}`);
    }

    const full = snapshot.metrics as unknown as WorkshopDailyMetrics;
    return {
      snapshotId: snapshot.id,
      metrics: {
        meta: full.meta,
        intake: full.intake,
        workflow: full.workflow,
        shipout: full.shipout,
        backlog: full.backlog,
        events: full.events,
        remakes: full.remakes,
        dataQuality: full.dataQuality
      }
    };
  }
}
