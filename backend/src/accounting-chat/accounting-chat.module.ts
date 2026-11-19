import { Module } from "@nestjs/common";
import { AgentsModule } from "../agents/agents.module";
import { CeoChatModule } from "../ceo-chat/ceo-chat.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { AccountingChatController } from "./accounting-chat.controller";
import { AccountingChatService } from "./accounting-chat.service";
import { AccountingKnowledgeAnswerService } from "./accounting-knowledge-answer.service";
import { AccountingDataModule } from "../accounting-data/accounting-data.module";

@Module({
  imports: [AgentsModule, KnowledgeModule, CeoChatModule, AccountingDataModule],
  controllers: [AccountingChatController],
  providers: [AccountingChatService, AccountingKnowledgeAnswerService],
  exports: [AccountingKnowledgeAnswerService]
})
export class AccountingChatModule {}
