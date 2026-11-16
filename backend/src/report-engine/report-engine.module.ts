import { Module } from "@nestjs/common";
import { MetricsModule } from "../metrics/metrics.module";
import { DailyAnalysisPreparationService } from "./daily-analysis-preparation.service";
import { ReportEngineService } from "./report-engine.service";
import { ReportPreviewController } from "./report-preview.controller";
import { ReportRendererService } from "./report-renderer.service";

@Module({
  imports: [MetricsModule],
  controllers: [ReportPreviewController],
  providers: [ReportRendererService, ReportEngineService, DailyAnalysisPreparationService],
  exports: [ReportRendererService, ReportEngineService, DailyAnalysisPreparationService]
})
export class ReportEngineModule {}
