import { Module } from "@nestjs/common";
import { CeoChatModule } from "../../ceo-chat/ceo-chat.module";
import { TiktokChatModule } from "../../tiktok-chat/tiktok-chat.module";
import { KnowledgeDelegationController } from "./knowledge-delegation.controller";
import { KnowledgeDelegationService } from "./knowledge-delegation.service";

@Module({
  imports: [CeoChatModule, TiktokChatModule],
  controllers: [KnowledgeDelegationController],
  providers: [KnowledgeDelegationService]
})
export class KnowledgeDelegationModule {}
