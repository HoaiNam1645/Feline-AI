import { Module } from "@nestjs/common";
import { AgentsModule } from "../agents/agents.module";
import { CeoChatModule } from "../ceo-chat/ceo-chat.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { TiktokChatController } from "./tiktok-chat.controller";
import { TiktokChatService } from "./tiktok-chat.service";
import { TiktokKnowledgeAnswerService } from "./tiktok-knowledge-answer.service";
import { TiktokDataModule } from "../tiktok-data/tiktok-data.module";

@Module({
  imports: [AgentsModule, KnowledgeModule, CeoChatModule, TiktokDataModule],
  controllers: [TiktokChatController],
  providers: [TiktokChatService, TiktokKnowledgeAnswerService],
  exports: [TiktokKnowledgeAnswerService]
})
export class TiktokChatModule {}
