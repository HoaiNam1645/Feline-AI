import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { RequireAgentAccess } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { ChatService } from "./chat.service";
import { ChatAttachmentService } from "./chat-attachment.service";
import { recordRequestError } from "../observability/request-log";

const VIEW_ACCESS = {
  agentId: "lemiex-ai",
  action: "view" as const,
  dataScopeIds: ["lemiex.operations.basic"]
};

const RUN_ACCESS = {
  agentId: "lemiex-ai",
  action: "run" as const,
  capabilityId: "lemiex.operations.ask",
  dataScopeIds: ["lemiex.operations.basic"]
};

@Controller("chat/lemiex")
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly attachments: ChatAttachmentService
  ) {}

  @RequireAgentAccess(RUN_ACCESS)
  @Post("conversations/:id/attachments")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  uploadAttachment(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.attachments.upload(request.auth!.user.id, id, file);
  }

  @RequireAgentAccess(VIEW_ACCESS)
  @Get("attachments/:attachmentId/content")
  async attachmentContent(
    @Req() request: AuthenticatedRequest,
    @Param("attachmentId") attachmentId: string,
    @Res() response: Response
  ): Promise<void> {
    const content = await this.attachments.content(request.auth!.user.id, attachmentId);
    response.setHeader("Content-Type", content.mimeType);
    response.setHeader("Content-Length", String(content.buffer.length));
    response.setHeader("Cache-Control", "private, max-age=3600");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.send(content.buffer);
  }

  @RequireAgentAccess(RUN_ACCESS)
  @Delete("attachments/:attachmentId")
  async deleteAttachment(
    @Req() request: AuthenticatedRequest,
    @Param("attachmentId") attachmentId: string
  ) {
    await this.attachments.remove(request.auth!.user.id, attachmentId);
    return { success: true };
  }

  @RequireAgentAccess(VIEW_ACCESS)
  @Get("conversations")
  list(@Req() request: AuthenticatedRequest) {
    return this.chat.listConversations(request.auth!.user.id);
  }

  @RequireAgentAccess(VIEW_ACCESS)
  @Post("conversations")
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>
  ) {
    return this.chat.createConversation(request.auth!.user.id, body.title);
  }

  @RequireAgentAccess(VIEW_ACCESS)
  @Get("conversations/:id")
  get(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string
  ) {
    return this.chat.getConversationWithUsage(
      request.auth!.user.id,
      id,
      request.auth!.user.role === UserRole.ADMIN
    );
  }

  @RequireAgentAccess(VIEW_ACCESS)
  @Patch("conversations/:id")
  rename(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.chat.renameConversation(request.auth!.user.id, id, body.title);
  }

  @RequireAgentAccess(VIEW_ACCESS)
  @Delete("conversations/:id")
  remove(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string
  ) {
    return this.chat.deleteConversation(request.auth!.user.id, id);
  }

  @RequireAgentAccess(RUN_ACCESS)
  @Post("conversations/:id/messages/stream")
  async streamAnswer(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Res() response: Response
  ): Promise<void> {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-store, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.setHeader("Content-Encoding", "identity");
    response.socket?.setNoDelay(true);
    response.flushHeaders();
    const abortController = new AbortController();
    response.on("close", () => abortController.abort());
    const send = (event: string, data: unknown) => {
      if (response.writableEnded || response.destroyed) return;
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (response as Response & { flush?: () => void }).flush?.();
    };

    try {
      let streamedLength = 0;
      response.write(": stream-open\n\n");
      (response as Response & { flush?: () => void }).flush?.();
      send("status", { phase: "reading_data", message: "Lemiex AI đang đọc dữ liệu đã xác minh..." });
      const result = await this.chat.answer(
        request.auth!.user.id,
        id,
        body,
        abortController.signal,
        request.auth!.user.role === UserRole.ADMIN,
        request.auth!.user.role === UserRole.ADMIN
          || request.auth!.user.role === UserRole.MANAGER,
        request.auth!.user.role === UserRole.ADMIN
          || request.auth!.user.role === UserRole.MANAGER,
        request.auth!.user.role === UserRole.ADMIN
          || request.auth!.user.role === UserRole.MANAGER,
        request.auth!.user.role === UserRole.ADMIN
          || request.auth!.user.role === UserRole.MANAGER,
        (text) => {
          streamedLength += text.length;
          send("delta", { text });
        }
      );
      send("meta", {
        userMessage: result.userMessage,
        assistantMessageId: result.assistantMessage.id,
        reportDate: result.assistantMessage.reportDate,
        runId: result.runId,
        sources: result.output.sources
      });
      if (streamedLength === 0) {
        send("delta", { text: result.output.markdown });
      } else if (streamedLength < result.output.markdown.length) {
        send("delta", { text: result.output.markdown.slice(streamedLength) });
      }
      send("done", { assistantMessage: result.assistantMessage });
    } catch (error) {
      recordRequestError(request, error);
      if (!abortController.signal.aborted) {
        send("error", {
          message: error instanceof Error ? error.message : "Không thể hoàn tất câu trả lời"
        });
      }
    } finally {
      response.end();
    }
  }

}
