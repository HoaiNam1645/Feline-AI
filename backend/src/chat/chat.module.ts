import { Module } from "@nestjs/common";
import { AgentsModule } from "../agents/agents.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { ChatAttachmentService } from "./chat-attachment.service";

@Module({
  imports: [AgentsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatAttachmentService]
})
export class ChatModule {}
