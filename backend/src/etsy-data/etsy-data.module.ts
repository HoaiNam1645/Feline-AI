import { Global, Module } from "@nestjs/common";
import { EtsyDashboardController } from "./etsy-dashboard.controller";
import { EtsyDashboardService } from "./etsy-dashboard.service";
import { EtsyScopeCatalogSyncService } from "./etsy-scope-catalog-sync.service";
import { EtsyScopeService } from "./etsy-scope.service";
import { EtsySourceService } from "./etsy-source.service";
import { AnthropicStructuredProvider } from "../ai/anthropic-structured.provider";
import { EtsyQuestionRouterService } from "./etsy-question-router.service";
import { EtsyDataAnswerService } from "./etsy-data-answer.service";

@Global()
@Module({
  controllers: [EtsyDashboardController],
  providers: [AnthropicStructuredProvider, EtsySourceService, EtsyScopeService, EtsyDashboardService, EtsyScopeCatalogSyncService, EtsyQuestionRouterService, EtsyDataAnswerService],
  exports: [EtsySourceService, EtsyScopeService, EtsyDashboardService, EtsyQuestionRouterService, EtsyDataAnswerService]
})
export class EtsyDataModule {}
