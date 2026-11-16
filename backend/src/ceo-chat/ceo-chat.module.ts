import { Module } from "@nestjs/common";
import { AgentsModule } from "../agents/agents.module";
import { KnowledgeModule } from "../knowledge/knowledge.module";
import { CeoChatController } from "./ceo-chat.controller";
import { CeoChatService } from "./ceo-chat.service";
import { CeoHrAnswerService } from "./ceo-hr-answer.service";
import { CeoMemoryService } from "./ceo-memory.service";
import { CeoAnswerCacheService } from "./ceo-answer-cache.service";

@Module({
  imports: [AgentsModule, KnowledgeModule],
  controllers: [CeoChatController],
  providers: [CeoChatService, CeoHrAnswerService, CeoMemoryService, CeoAnswerCacheService],
  exports: [CeoHrAnswerService, CeoMemoryService, CeoAnswerCacheService]
})
export class CeoChatModule {}
