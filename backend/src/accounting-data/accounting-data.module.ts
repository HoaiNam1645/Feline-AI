import { Global, Module } from "@nestjs/common";
import { AnthropicStructuredProvider } from "../ai/anthropic-structured.provider";
import { AccountingDashboardController } from "./accounting-dashboard.controller";
import { AccountingDataAnswerService } from "./accounting-data-answer.service";
import { AccountingQuestionRouterService } from "./accounting-question-router.service";
import { AccountingSourceService } from "./accounting-source.service";

@Global()
@Module({
  controllers: [AccountingDashboardController],
  providers: [AnthropicStructuredProvider, AccountingSourceService, AccountingQuestionRouterService, AccountingDataAnswerService],
  exports: [AccountingSourceService, AccountingQuestionRouterService, AccountingDataAnswerService]
})
export class AccountingDataModule {}
