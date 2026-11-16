import { Injectable } from "@nestjs/common";
import { reportWindow } from "../../metrics/report-window";
import {
  WorkshopDailyMetrics,
  WorkshopMetricsService
} from "../../metrics/workshop-metrics.service";
import { AgentTool } from "./agent-tool";

export interface LiveDailyMetricsToolOutput {
  metrics: Omit<
    WorkshopDailyMetrics,
    "source" | "sourceFreshness" | "provisionalCosts"
  >;
  source: {
    id: "shop-test";
    access: "read-only";
    generatedAtUtc: string;
    dataUpdatedAtUtc: string;
  };
  financialSummary?: {
    calculatedFulfillmentFees: number;
    confirmedFulfillmentRevenue: number;
    basis: string;
    currency: "USD";
  };
}

@Injectable()
export class LiveDailyMetricsTool implements AgentTool<
  { reportDate: string; includeFinancials?: boolean },
  LiveDailyMetricsToolOutput
> {
  readonly id = "lemiex.metrics.live-daily";
  readonly description = "Tính metric vận hành theo ngày từ nguồn shop-test chỉ đọc và loại dữ liệu nhạy cảm khỏi ngữ cảnh AI.";

  constructor(private readonly metrics: WorkshopMetricsService) {}

  async execute(input: {
    reportDate: string;
    includeFinancials?: boolean;
  }): Promise<LiveDailyMetricsToolOutput> {
    reportWindow(input.reportDate);
    const full = await this.metrics.calculateDaily(input.reportDate);
    const freshnessTimes = full.sourceFreshness.flatMap((row) => {
      const value = row.maxUpdatedAt;
      if (typeof value !== "string" || !value) return [];
      const parsed = new Date(`${value.replace(" ", "T")}Z`);
      return Number.isNaN(parsed.getTime()) ? [] : [parsed.getTime()];
    });
    const dataUpdatedAtUtc = freshnessTimes.length
      ? new Date(Math.max(...freshnessTimes)).toISOString()
      : full.meta.generatedAtUtc;
    return {
      metrics: {
        meta: full.meta,
        intake: full.intake,
        workflow: full.workflow,
        shipout: full.shipout,
        backlog: full.backlog,
        events: full.events,
        remakes: full.remakes,
        dataQuality: full.dataQuality
      },
      source: {
        id: "shop-test",
        access: "read-only",
        generatedAtUtc: full.meta.generatedAtUtc,
        dataUpdatedAtUtc
      },
      ...(input.includeFinancials ? {
        financialSummary: {
          calculatedFulfillmentFees: full.provisionalCosts.totalCost,
          confirmedFulfillmentRevenue: full.provisionalCosts.paidCost,
          basis: "Các đơn hợp lệ được tạo trong kỳ; doanh thu đã chốt dùng paid_cost, không phải dòng tiền ledger theo thời điểm thanh toán.",
          currency: "USD" as const
        }
      } : {})
    };
  }
}
