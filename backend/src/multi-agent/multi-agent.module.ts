import { Module } from "@nestjs/common";
import { AgentsModule } from "../agents/agents.module";
import { CeoChatModule } from "../ceo-chat/ceo-chat.module";
import { EtsyChatModule } from "../etsy-chat/etsy-chat.module";
import { EtsyDataModule } from "../etsy-data/etsy-data.module";
import { TiktokChatModule } from "../tiktok-chat/tiktok-chat.module";
import { TiktokDataModule } from "../tiktok-data/tiktok-data.module";
import { MultiAgentController } from "./multi-agent.controller";
import { MultiAgentOrchestratorService } from "./multi-agent-orchestrator.service";
import { MultiAgentRouterService } from "./multi-agent-router.service";

@Module({
  imports: [AgentsModule, CeoChatModule, TiktokChatModule, EtsyChatModule, TiktokDataModule, EtsyDataModule],
  controllers: [MultiAgentController],
  providers: [MultiAgentRouterService, MultiAgentOrchestratorService],
  exports: [MultiAgentOrchestratorService]
})
export class MultiAgentModule {}
