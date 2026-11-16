import { Module } from "@nestjs/common";
import { AnthropicStructuredProvider } from "../ai/anthropic-structured.provider";
import { MetricsModule } from "../metrics/metrics.module";
import { ReportEngineModule } from "../report-engine/report-engine.module";
import { DailyOperationsReviewCapability } from "./capabilities/daily-operations-review.capability";
import { OperationsQuestionAnswerCapability } from "./capabilities/operations-question-answer.capability";
import { LEMIEX_CAPABILITIES } from "./capabilities/agent-capability";
import { LemiexAgentController } from "./lemiex-agent.controller";
import { LemiexAgentService } from "./lemiex-agent.service";
import { LemiexKnowledgeService } from "./knowledge/lemiex-knowledge.service";
import { AgentToolExecutorService } from "./tools/agent-tool-executor.service";
import { DailyReportTool } from "./tools/daily-report.tool";
import { DailySnapshotTool } from "./tools/daily-snapshot.tool";
import { LiveDailyMetricsTool } from "./tools/live-daily-metrics.tool";
import { LivePeriodMetricsTool } from "./tools/live-period-metrics.tool";
import { InventoryMetricsTool } from "./tools/inventory-metrics.tool";
import { SellerPricingMetricsTool } from "./tools/seller-pricing-metrics.tool";
import { SearchEngineService } from "./search/search-engine.service";
import { OrderLookupTool } from "./tools/order-lookup.tool";
import { ProductVisualIndexService } from "./search/product-visual-index.service";

@Module({
  imports: [MetricsModule, ReportEngineModule],
  controllers: [LemiexAgentController],
  providers: [
    AnthropicStructuredProvider,
    DailySnapshotTool,
    DailyReportTool,
    LiveDailyMetricsTool,
    LivePeriodMetricsTool,
    InventoryMetricsTool,
    SellerPricingMetricsTool,
    SearchEngineService,
    ProductVisualIndexService,
    OrderLookupTool,
    AgentToolExecutorService,
    LemiexKnowledgeService,
    DailyOperationsReviewCapability,
    OperationsQuestionAnswerCapability,
    {
      provide: LEMIEX_CAPABILITIES,
      useFactory: (
        dailyReview: DailyOperationsReviewCapability,
        operationsQuestionAnswer: OperationsQuestionAnswerCapability
      ) => [dailyReview, operationsQuestionAnswer],
      inject: [DailyOperationsReviewCapability, OperationsQuestionAnswerCapability]
    },
    LemiexAgentService
  ],
  exports: [LemiexAgentService, AnthropicStructuredProvider]
})
export class AgentsModule {}
