import { Global, Module } from "@nestjs/common";
import { AnthropicStructuredProvider } from "../ai/anthropic-structured.provider";
import { TiktokDataAnswerService } from "./tiktok-data-answer.service";
import { TiktokMysqlService } from "./tiktok-mysql.service";
import { TiktokQuestionRouterService } from "./tiktok-question-router.service";
import { TiktokScopeService } from "./tiktok-scope.service";
import { TiktokToolExecutorService } from "./tiktok-tool-executor.service";
import { TiktokDesignTool, TiktokFinanceTool, TiktokFulfillmentTool, TiktokOrdersTool, TiktokOverviewTool, TiktokStoresTool, TiktokTeamTool } from "./tiktok-tools";
import { TiktokScopeCatalogSyncService } from "./tiktok-scope-catalog-sync.service";
import { TiktokDashboardController } from "./tiktok-dashboard.controller";
import { TiktokDashboardService } from "./tiktok-dashboard.service";

@Global()
@Module({
  controllers: [TiktokDashboardController],
  providers: [
    AnthropicStructuredProvider, TiktokMysqlService, TiktokScopeService, TiktokQuestionRouterService,
    TiktokOverviewTool, TiktokOrdersTool, TiktokFinanceTool, TiktokTeamTool,
    TiktokStoresTool, TiktokFulfillmentTool, TiktokDesignTool,
    TiktokToolExecutorService, TiktokDataAnswerService, TiktokScopeCatalogSyncService, TiktokDashboardService
  ],
  exports: [TiktokMysqlService, TiktokScopeService, TiktokQuestionRouterService, TiktokDataAnswerService]
})
export class TiktokDataModule {}
