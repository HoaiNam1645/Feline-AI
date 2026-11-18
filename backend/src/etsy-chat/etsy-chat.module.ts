import { Module } from "@nestjs/common";
import { AgentsModule } from "../agents/agents.module";
import { CeoChatModule } from "../ceo-chat/ceo-chat.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { EtsyChatController } from "./etsy-chat.controller";
import { EtsyChatService } from "./etsy-chat.service";
import { EtsyKnowledgeAnswerService } from "./etsy-knowledge-answer.service";
import { EtsyDataModule } from "../etsy-data/etsy-data.module";

@Module({
  imports: [AgentsModule, KnowledgeModule, CeoChatModule, EtsyDataModule],
  controllers: [EtsyChatController],
  providers: [EtsyChatService, EtsyKnowledgeAnswerService],
  exports: [EtsyKnowledgeAnswerService]
})
export class EtsyChatModule {}
